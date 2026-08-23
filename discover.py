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

import sys
from datetime import date, datetime, timezone
from pathlib import Path

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


def main() -> None:
    url, key = bmscraper.supabase_env()
    if not url or not key:
        print(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — nothing to do.",
            file=sys.stderr,
        )
        return

    for city in CITIES:
        movies = bmscraper.fetch_movie_list(
            city,
            f"https://in.bookmyshow.com/explore/upcoming-movies-{city}",
            f"upcoming list for {city}",
        )
        print(f"[{city}] {len(movies)} upcoming movies")

        rows = []
        for movie in movies:
            details = bmscraper.fetch_movie_details(movie)
            release_date = details["release_date"] or date.today().isoformat()
            rows.append(
                {
                    "city": movie["city"],
                    "et_code": movie["et_code"],
                    "slug": movie["slug"],
                    "name": movie["name"],
                    "release_date": release_date,
                    "buytickets_url": bmscraper.buytickets_url(movie, release_date),
                    "poster_url": details["poster_url"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        bmscraper.upsert("discovered_movies", rows, on_conflict="city,et_code")


if __name__ == "__main__":
    main()
