"""
BookQuick theatre-finder data collection.

For every now-showing movie (from now_showing_movies) in every tracked
city, fetches today's combined buytickets page and extracts one row per
cinema actually showing it today: formats, starting price, a coarse
seat-tier ("premium" vs "standard", the agreed proxy for view quality —
BookMyShow publishes no real per-row seat geometry), and BookMyShow's own
popularity rank for that venue (used as the default sort — their
"distance" field turned out to be a constant, not real per-venue
proximity, so it's not used here).

Runs every 30 minutes via .github/workflows/theatres.yml — pricing/format
availability shifts more than the daily discovery data, but doesn't need
5-minute granularity like booking-open detection.
"""

import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import requests

import bmscraper

ROOT = Path(__file__).parent
bmscraper.load_dotenv(ROOT / ".env")

CITIES = [
    "bengaluru",
    "mumbai",
    "delhi-ncr",
    "hyderabad",
    "chennai",
    "pune",
    "kolkata",
]

REDIRECTION_URL_RE = re.compile(r'"redirectionUrl":"([^"]+)"')
POPULARITY_RANK_RE = re.compile(r'"popularityRank":\{"value":(\d+)')

# Canonical presentation formats to surface as filter options — the raw
# "format" field also carries screen-tech names (DOLBY 7.1, KOTAK INSIGNIA)
# and bare seat-category labels (GOLD, Couple Seats) mixed in, which would
# make a noisy/confusing filter list if used unfiltered.
KNOWN_FORMATS = [
    "IMAX 3D", "IMAX 2D", "IMAX", "4DX 3D", "4DX", "DOLBY CINEMA 3D",
    "DOLBY CINEMA 2D", "DOLBY CINEMA", "EPIQ", "MX4D", "ICE", "3D", "2D",
]
PREMIUM_MARKERS = ["IMAX", "4DX", "DOLBY", "RECLINER", "GOLD PRIME", "EPIQ", "MX4D"]


def extract_formats(block: str) -> list[str]:
    found = set()
    for raw in bmscraper.FORMAT_RE.findall(block):
        upper = raw.upper()
        for known in KNOWN_FORMATS:
            if known in upper:
                found.add(known)
                break
    return sorted(found) or ["2D"]


def extract_min_price(block: str) -> float | None:
    prices = []
    for raw in bmscraper.SEAT_COST_RE.findall(block):
        digits = re.sub(r"[^\d.]", "", raw)
        if digits:
            prices.append(float(digits))
    return min(prices) if prices else None


def parse_venues(text: str) -> list[dict]:
    markers = [m.start() for m in re.finditer(re.escape(bmscraper.VENUE_CARD_MARKER), text)]
    markers.append(len(text))

    venues = []
    for i in range(len(markers) - 1):
        block = text[markers[i] : markers[i + 1]]

        if not bmscraper.SHOWTIME_RE.search(block):
            continue  # listed but nothing bookable today — skip

        name_match = bmscraper.VENUE_NAME_RE.search(block)
        redirect_match = REDIRECTION_URL_RE.search(block)
        if not name_match or not redirect_match:
            continue

        formats = extract_formats(block)
        min_price = extract_min_price(block)
        rank_match = POPULARITY_RANK_RE.search(block)
        rank = int(rank_match.group(1)) if rank_match else None

        venues.append(
            {
                "venue_name": name_match.group(1),
                "redirection_url": redirect_match.group(1),
                "formats": formats,
                "seat_tier": "premium"
                if any(m in f for f in formats for m in PREMIUM_MARKERS)
                else "standard",
                "min_price": min_price,
                "rank": rank,
            }
        )
    return venues


def fetch_now_showing_movies() -> list[dict]:
    url, key = bmscraper.supabase_env()
    resp = requests.get(
        f"{url}/rest/v1/now_showing_movies",
        headers=bmscraper.supabase_headers(key),
        params={"select": "city,slug,et_code,name"},
        timeout=bmscraper.REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    url, key = bmscraper.supabase_env()
    if not url or not key:
        print(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — nothing to do.",
            file=sys.stderr,
        )
        return

    movies = fetch_now_showing_movies()
    today = date.today().isoformat()
    print(f"Fetching theatre data for {len(movies)} movies across {len(CITIES)} cities, {today}")

    rows = []
    for movie in movies:
        page_url = bmscraper.buytickets_url(
            {"city": movie["city"], "slug": movie["slug"], "et_code": movie["et_code"]},
            today,
        )
        try:
            resp = requests.get(page_url, headers=bmscraper.HEADERS, timeout=bmscraper.REQUEST_TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(f"  ! fetch failed for {movie['name']} ({movie['city']}): {exc}", file=sys.stderr)
            continue

        venues = parse_venues(resp.text)
        print(f"  [{movie['city']}] {movie['name']}: {len(venues)} cinemas today")

        for v in venues:
            rows.append(
                {
                    "movie_et_code": movie["et_code"],
                    "movie_name": movie["name"],
                    "city": movie["city"],
                    "date": today,
                    "venue_name": v["venue_name"],
                    "redirection_url": v["redirection_url"],
                    "formats": v["formats"],
                    "seat_tier": v["seat_tier"],
                    "min_price": v["min_price"],
                    "rank": v["rank"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )

    bmscraper.upsert("venue_snapshots", rows, on_conflict="movie_et_code,city,venue_name,date")
    print(f"Upserted {len(rows)} venue snapshots")


if __name__ == "__main__":
    main()
