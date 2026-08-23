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
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

import bmscraper

ROOT = Path(__file__).parent
bmscraper.load_dotenv(ROOT / ".env")

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY = bmscraper.supabase_env()
REQUEST_TIMEOUT = bmscraper.REQUEST_TIMEOUT


def supabase_headers() -> dict:
    return bmscraper.supabase_headers(SUPABASE_SERVICE_ROLE_KEY)


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
        resp = requests.get(url, headers=bmscraper.HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! fetch failed for {url}: {exc}", file=sys.stderr)
        return None
    return resp.text


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
        block = bmscraper.venue_block(text, cinema_name)
        if block is None:
            # that specific cinema isn't listed on the page yet at all
            return "coming_soon"
        scope = block

    target_format = watcher.get("format")
    if target_format:
        formats_in_scope = bmscraper.FORMAT_RE.findall(scope)
        if not any(target_format.strip().lower() in f.lower() for f in formats_in_scope):
            return "coming_soon"

    return "available" if bmscraper.SHOWTIME_RE.search(scope) else "coming_soon"


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
