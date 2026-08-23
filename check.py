"""
BookQuick checker.

Runs once per invocation: pulls every watcher row from Supabase, fetches
each target's booking status, and emails the watching user the moment it
flips from "not open" to "open". State (per-watcher status) and the watch
list itself live in Supabase, written to by the website — this script only
reads/updates rows, it never touches local files.

Designed to be triggered on a schedule (see .github/workflows/check.yml) —
it does not loop or sleep on its own.
"""

import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# BookMyShow's booking pages render real showtimes ("07:15 PM" etc.) as
# plain text once seats are on sale, and none at all beforehand — this is
# a far more reliable signal than any button label, which is present
# whether or not booking has actually opened.
SHOWTIME_RE = re.compile(r"\b\d{1,2}:\d{2}\s?(?:AM|PM)\b")

# A combined (whole-city) buytickets page embeds one JSON "venue-card" per
# cinema; slicing between consecutive markers isolates just that cinema's
# own showtimes/format data, so a watcher scoped to one cinema doesn't
# fire when a *different* cinema opens first. Verified against a live
# page: each block's extracted formats/showtimes matched that cinema
# exactly, not neighboring ones.
VENUE_CARD_MARKER = '"type":"venue-card"'
VENUE_NAME_RE = re.compile(r'"venueName":"([^"]+)"')
FORMAT_RE = re.compile(r'"format":"([^"]*)"')

ROOT = Path(__file__).parent
ENV_FILE = ROOT / ".env"

REQUEST_TIMEOUT = 15


def load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external dependency) — local dev only.

    GitHub Actions injects env vars directly as job env, so this is a
    no-op there; it only matters when running check.py on your machine.
    Existing environment variables always win.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_dotenv(ENV_FILE)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_watchers() -> list[dict]:
    """All watchers across all users — the service-role key bypasses RLS."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/watchers",
        headers=supabase_headers(),
        params={
            "select": "id,user_id,movie,url,mode,open_marker,closed_marker,"
            "cinema_name,format,status"
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_profiles() -> dict[str, str]:
    """user_id -> email, so the checker doesn't need the auth admin API."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers=supabase_headers(),
        params={"select": "id,email"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return {row["id"]: row["email"] for row in resp.json()}


def update_watcher_status(watcher_id: str, status: str) -> None:
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/watchers",
        headers=supabase_headers(),
        params={"id": f"eq.{watcher_id}"},
        json={
            "status": status,
            "last_checked_at": datetime.now(timezone.utc).isoformat(),
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()


def fetch_page(url: str) -> str | None:
    """Raw page text, or None on failure. Cached per-URL by the caller so
    multiple watchers on the same movie/city/date share one request."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! fetch failed for {url}: {exc}", file=sys.stderr)
        return None
    return resp.text


def venue_block(text: str, cinema_name: str) -> str | None:
    """The slice of `text` belonging to one named cinema, or None if that
    cinema isn't listed on the page at all (not yet announced there)."""
    markers = [m.start() for m in re.finditer(re.escape(VENUE_CARD_MARKER), text)]
    markers.append(len(text))
    target = cinema_name.strip().lower()

    for i in range(len(markers) - 1):
        block = text[markers[i] : markers[i + 1]]
        name_match = VENUE_NAME_RE.search(block)
        if name_match and target in name_match.group(1).strip().lower():
            return block
    return None


def compute_status(text: str, watcher: dict) -> str:
    """Returns 'available', 'coming_soon', or 'unknown' from already-fetched
    page text, honoring this watcher's own cinema/format scoping."""
    if watcher.get("mode") != "showtime_regex":
        open_marker = watcher.get("open_marker")
        closed_marker = watcher.get("closed_marker")
        has_open = bool(open_marker) and open_marker.lower() in text.lower()
        has_closed = bool(closed_marker) and closed_marker.lower() in text.lower()
        if has_open and not has_closed:
            return "available"
        if has_closed:
            return "coming_soon"
        if has_open:
            return "available"
        return "unknown"

    scope = text
    cinema_name = watcher.get("cinema_name")
    if cinema_name:
        block = venue_block(text, cinema_name)
        if block is None:
            # that specific cinema isn't listed on the page yet at all
            return "coming_soon"
        scope = block

    target_format = watcher.get("format")
    if target_format:
        formats_in_scope = FORMAT_RE.findall(scope)
        if not any(target_format.strip().lower() in f.lower() for f in formats_in_scope):
            return "coming_soon"

    return "available" if SHOWTIME_RE.search(scope) else "coming_soon"


RESEND_API_URL = "https://api.resend.com/emails"


def send_email(to_addr: str, subject: str, body: str) -> None:
    """Sends via Resend's HTTP API — just an API key, no SMTP/2FA setup."""
    api_key = os.environ.get("RESEND_API_KEY")
    from_addr = os.environ.get("ALERT_FROM")

    if not api_key or not from_addr:
        print(
            "  ! RESEND_API_KEY/ALERT_FROM not set — skipping email, "
            f"would have alerted {to_addr}: {subject}",
            file=sys.stderr,
        )
        return

    resp = requests.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": from_addr, "to": [to_addr], "subject": subject, "text": body},
        timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        print(f"  ! Resend send failed ({resp.status_code}): {resp.text}", file=sys.stderr)
        resp.raise_for_status()


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — nothing to do.",
            file=sys.stderr,
        )
        return

    watchers = fetch_watchers()
    if not watchers:
        print("No watchers in Supabase — nothing to do.")
        return

    profiles = fetch_profiles()

    # Multiple watchers (different users, or the same user with different
    # cinema/format scoping) can share a URL — fetch each unique URL once
    # per run, then compute each watcher's own status from the cached text.
    page_cache: dict[str, str | None] = {}

    for watcher in watchers:
        url = watcher["url"]
        previous = watcher.get("status", "coming_soon")

        if url not in page_cache:
            # small jitter so a batch of distinct targets doesn't hammer
            # the same platform in one synchronized burst
            time.sleep(random.uniform(0.2, 1.0))
            page_cache[url] = fetch_page(url)

        text = page_cache[url]
        status = "unknown" if text is None else compute_status(text, watcher)

        print(f"[{watcher['movie']}] {previous} -> {status}")

        if status == "unknown":
            # don't overwrite a known state with an inconclusive fetch
            continue

        if status == "available" and previous != "available":
            to_addr = profiles.get(watcher["user_id"])
            if to_addr:
                scope_bits = [b for b in (watcher.get("cinema_name"), watcher.get("format")) if b]
                scope_note = f" ({' · '.join(scope_bits)})" if scope_bits else ""
                send_email(
                    to_addr=to_addr,
                    subject=f"Booking open: {watcher['movie']}{scope_note}",
                    body=f"Tickets are now bookable for {watcher['movie']}{scope_note}.\n\n{url}",
                )
                print(f"  -> alert sent to {to_addr}")
            else:
                print(f"  ! no profile/email found for user {watcher['user_id']}", file=sys.stderr)

        if status != previous:
            update_watcher_status(watcher["id"], status)


if __name__ == "__main__":
    main()
