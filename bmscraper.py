"""
Shared BookMyShow parsing helpers used by discover.py, nowshowing.py,
theatres.py, and check.py.

Everything here reads BookMyShow's own public/server-rendered HTML with
plain `requests` — no headless browser, no auth bypass. Node/Vercel gets
403'd by BookMyShow's bot protection on the same requests; plain Python
`requests` doesn't, which is why all scraping lives in scripts like this
one rather than in the website itself.
"""

import json
import os
import re
import sys
from pathlib import Path

import requests

REQUEST_TIMEOUT = 15

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

JSON_LD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
MOVIE_URL_RE = re.compile(r"/([^/]+)/movies/([^/]+)/(ET\d+)", re.I)
POSTER_RE = re.compile(
    r"https://assets-in\.bmscdn\.com/iedb/movies/images/mobile/thumbnail/xlarge/[\w-]+\.jpg"
)
RATING_RE = re.compile(r'"aggregatedRating":([\d.]+)')
RATING_STRING_RE = re.compile(r'"aggregatedRatingString":"([^"]*)"')

# BookMyShow's booking pages render real showtimes ("07:15 PM" etc.) as
# plain text once seats are on sale, and none at all beforehand — this is
# a far more reliable signal than any button label, which is present
# whether or not booking has actually opened.
SHOWTIME_RE = re.compile(r"\b\d{1,2}:\d{2}\s?(?:AM|PM)\b")

# A combined (whole-city) buytickets page embeds one JSON "venue-card" per
# cinema; slicing between consecutive markers isolates just that cinema's
# own showtimes/format/price data, so logic scoped to one cinema doesn't
# pick up a different cinema's data. Verified against a live page.
VENUE_CARD_MARKER = '"type":"venue-card"'
VENUE_NAME_RE = re.compile(r'"venueName":"([^"]+)"')
FORMAT_RE = re.compile(r'"format":"([^"]*)"')
SEAT_COST_RE = re.compile(r'"seatCost":"([^"]*)"')
DISTANCE_RE = re.compile(r'"distance":\{"value":(\d+)')


def load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external dependency) — local dev only.

    GitHub Actions injects env vars directly as job env, so this is a
    no-op there; it only matters when running a script on your machine.
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


def supabase_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return url, key


def supabase_headers(service_role_key: str) -> dict:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


def extract_json_ld(html: str, ld_type: str) -> list[dict]:
    blocks = []
    for match in JSON_LD_RE.finditer(html):
        try:
            parsed = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if parsed.get("@type") == ld_type:
            blocks.append(parsed)
    return blocks


def fetch_movie_list(list_url: str, label: str) -> list[dict]:
    """Movies from a BookMyShow explore page's schema.org ItemList — used
    for both the upcoming-movies and now-showing-movies listings, which
    share the same JSON-LD shape."""
    try:
        resp = requests.get(list_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! failed to fetch {label}: {exc}", file=sys.stderr)
        return []

    lists = extract_json_ld(resp.text, "ItemList")
    items = lists[0].get("itemListElement", []) if lists else []

    movies = []
    for item in items:
        m = MOVIE_URL_RE.search(item.get("url", ""))
        if not m:
            continue
        movies.append(
            {
                "name": item["name"],
                "city": m.group(1),
                "slug": m.group(2),
                "et_code": m.group(3),
            }
        )
    return movies


def fetch_movie_details(movie: dict) -> dict:
    """release_date, poster_url, rating, rating_label from the movie's own
    page — any field is None if not found or the fetch failed."""
    result = {"release_date": None, "poster_url": None, "rating": None, "rating_label": None}

    url = f"https://in.bookmyshow.com/{movie['city']}/movies/{movie['slug']}/{movie['et_code']}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! failed to fetch details for {movie['name']}: {exc}", file=sys.stderr)
        return result

    for block in extract_json_ld(resp.text, "Movie"):
        if block.get("datePublished"):
            result["release_date"] = block["datePublished"]
            break

    poster_match = POSTER_RE.search(resp.text)
    result["poster_url"] = poster_match.group(0) if poster_match else None

    rating_match = RATING_RE.search(resp.text)
    if rating_match and float(rating_match.group(1)) > 0:
        # BookMyShow stores this on a 0-100 scale internally but always
        # labels it out of 10 (e.g. raw 98 -> "9.8/10") — normalize to
        # match what's actually shown, confirmed against rating_label.
        result["rating"] = round(float(rating_match.group(1)) / 10, 1)
        label_match = RATING_STRING_RE.search(resp.text)
        result["rating_label"] = label_match.group(1) if label_match else None

    return result


def buytickets_url(movie: dict, date_iso: str) -> str:
    date_code = date_iso.replace("-", "")
    return (
        f"https://in.bookmyshow.com/movies/{movie['city']}/{movie['slug']}"
        f"/buytickets/{movie['et_code']}/{date_code}"
    )


def venue_block(text: str, cinema_name: str) -> str | None:
    """The slice of `text` belonging to one named cinema, or None if that
    cinema isn't listed on the page at all."""
    markers = [m.start() for m in re.finditer(re.escape(VENUE_CARD_MARKER), text)]
    markers.append(len(text))
    target = cinema_name.strip().lower()

    for i in range(len(markers) - 1):
        block = text[markers[i] : markers[i + 1]]
        name_match = VENUE_NAME_RE.search(block)
        if name_match and target in name_match.group(1).strip().lower():
            return block
    return None


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    url, key = supabase_env()
    resp = requests.post(
        f"{url}/rest/v1/{table}",
        headers={**supabase_headers(key), "Prefer": "resolution=merge-duplicates"},
        params={"on_conflict": on_conflict},
        json=rows,
        timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        print(f"  ! Supabase upsert to {table} failed ({resp.status_code}): {resp.text}", file=sys.stderr)
        resp.raise_for_status()
