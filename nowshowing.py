"""
BookQuick now-showing script.

Fetches BookMyShow's currently-showing movie list per city (same
schema.org ItemList pattern as discover.py's upcoming-movies list, just a
different explore page) plus each movie's audience rating where
BookMyShow has one, and upserts into Supabase's now_showing_movies table.

Runs daily on its own GitHub Actions schedule (see
.github/workflows/nowshowing.yml) — ratings/posters don't change
minute to minute.
"""

import sys
from datetime import datetime, timezone
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
            f"https://in.bookmyshow.com/explore/movies-{city}",
            f"now-showing list for {city}",
        )
        print(f"[{city}] {len(movies)} now-showing movies")

        rows = []
        for movie in movies:
            details = bmscraper.fetch_movie_details(movie)
            rows.append(
                {
                    "city": movie["city"],
                    "et_code": movie["et_code"],
                    "slug": movie["slug"],
                    "name": movie["name"],
                    "poster_url": details["poster_url"],
                    "rating": details["rating"],
                    "rating_label": details["rating_label"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        bmscraper.upsert("now_showing_movies", rows, on_conflict="city,et_code")


if __name__ == "__main__":
    main()
