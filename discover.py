"""
BookQuick discovery script.

Fetches BookMyShow's publicly-published "upcoming movies" list (the
schema.org JSON-LD they embed for search engines — not their internal,
bot-protected discovery API) for each tracked city, and upserts the
results into Supabase's discovered_movies table.

Runs daily on its own GitHub Actions schedule (see
.github/workflows/discover.yml) — deliberately separate from check.py's
5-minute status-polling schedule, since this data doesn't change that
often. The website reads this table directly; it never calls BookMyShow
itself (Node/Vercel gets 403'd by BookMyShow's bot protection — Python
doesn't, which is why this stays server-side here).
"""

import json
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent
ENV_FILE = ROOT / ".env"
REQUEST_TIMEOUT = 15

CITIES = [
    "bengaluru",
    "mumbai",
    "delhi-ncr",
    "hyderabad",
    "chennai",
    "pune",
    "kolkata",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

JSON_LD_RE = re.compile(
    r'<script type="application/ld\+json">(.*?)</script>', re.S
)
MOVIE_URL_RE = re.compile(r"/([^/]+)/movies/([^/]+)/(ET\d+)", re.I)


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_dotenv(ENV_FILE)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
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


def fetch_upcoming_movies(city: str) -> list[dict]:
    try:
        resp = requests.get(
            f"https://in.bookmyshow.com/explore/upcoming-movies-{city}",
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! failed to fetch upcoming list for {city}: {exc}", file=sys.stderr)
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


def fetch_release_date(movie: dict) -> str | None:
    url = f"https://in.bookmyshow.com/{movie['city']}/movies/{movie['slug']}/{movie['et_code']}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! failed to fetch release date for {movie['name']}: {exc}", file=sys.stderr)
        return None

    for block in extract_json_ld(resp.text, "Movie"):
        published = block.get("datePublished")
        if published:
            return published
    return None


def buytickets_url(movie: dict, date_iso: str) -> str:
    date_code = date_iso.replace("-", "")
    return (
        f"https://in.bookmyshow.com/movies/{movie['city']}/{movie['slug']}"
        f"/buytickets/{movie['et_code']}/{date_code}"
    )


def upsert_movies(rows: list[dict]) -> None:
    if not rows:
        return
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/discovered_movies",
        headers={**supabase_headers(), "Prefer": "resolution=merge-duplicates"},
        params={"on_conflict": "city,et_code"},
        json=rows,
        timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        print(f"  ! Supabase upsert failed ({resp.status_code}): {resp.text}", file=sys.stderr)
        resp.raise_for_status()


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — nothing to do.",
            file=sys.stderr,
        )
        return

    for city in CITIES:
        movies = fetch_upcoming_movies(city)
        print(f"[{city}] {len(movies)} upcoming movies")

        rows = []
        for movie in movies:
            release_date = fetch_release_date(movie) or date.today().isoformat()
            rows.append(
                {
                    "city": movie["city"],
                    "et_code": movie["et_code"],
                    "slug": movie["slug"],
                    "name": movie["name"],
                    "release_date": release_date,
                    "buytickets_url": buytickets_url(movie, release_date),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        upsert_movies(rows)


if __name__ == "__main__":
    main()
