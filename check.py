"""
BookQuick MVP checker.

Runs once per invocation: fetches every target in targets.yaml, compares its
booking status against the last known value in state.json, and emails
whoever's watching a target the moment it flips from "not open" to "open".

Designed to be triggered on a schedule (see .github/workflows/check.yml) —
it does not loop or sleep on its own.
"""

import json
import os
import random
import re
import sys
import time
from pathlib import Path

import requests
import yaml

# BookMyShow's booking pages render real showtimes ("07:15 PM" etc.) as
# plain text once seats are on sale, and none at all beforehand — this is
# a far more reliable signal than any button label, which is present
# whether or not booking has actually opened.
SHOWTIME_RE = re.compile(r"\b\d{1,2}:\d{2}\s?(?:AM|PM)\b")

ROOT = Path(__file__).parent
TARGETS_FILE = ROOT / "targets.yaml"
STATE_FILE = ROOT / "state.json"
ENV_FILE = ROOT / ".env"

REQUEST_TIMEOUT = 15


def load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external dependency) — local dev only.

    GitHub Actions injects SMTP_* directly as job env vars, so this is a
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


def load_targets() -> list[dict]:
    if not TARGETS_FILE.exists():
        return []
    with open(TARGETS_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    with open(STATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, sort_keys=True)
        f.write("\n")


def target_key(target: dict) -> str:
    return f"{target['movie']}::{target['url']}"


def fetch_status(target: dict) -> str:
    """Returns 'available', 'coming_soon', or 'unknown' based on page text."""
    try:
        resp = requests.get(target["url"], headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! fetch failed for {target['movie']}: {exc}", file=sys.stderr)
        return "unknown"

    text = resp.text

    if target.get("mode") == "showtime_regex":
        return "available" if SHOWTIME_RE.search(text) else "coming_soon"

    open_marker = target.get("open_marker")
    closed_marker = target.get("closed_marker")

    has_open_marker = bool(open_marker) and open_marker.lower() in text.lower()
    has_closed_marker = bool(closed_marker) and closed_marker.lower() in text.lower()

    if has_open_marker and not has_closed_marker:
        return "available"
    if has_closed_marker:
        return "coming_soon"
    if has_open_marker:
        return "available"
    return "unknown"


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
    targets = load_targets()
    state = load_state()

    if not targets:
        print("No targets configured in targets.yaml — nothing to do.")
        return

    for target in targets:
        key = target_key(target)
        previous = state.get(key, "coming_soon")

        # small jitter so a batch of targets doesn't hammer the same
        # platform in one synchronized burst
        time.sleep(random.uniform(0.2, 1.0))

        status = fetch_status(target)
        print(f"[{target['movie']}] {previous} -> {status}")

        if status == "unknown":
            # don't overwrite a known state with an inconclusive fetch
            continue

        if status == "available" and previous != "available":
            send_email(
                to_addr=target["email"],
                subject=f"Booking open: {target['movie']}",
                body=f"Tickets are now bookable for {target['movie']}.\n\n{target['url']}",
            )
            print(f"  -> alert sent to {target['email']}")

        state[key] = status

    save_state(state)


if __name__ == "__main__":
    main()
