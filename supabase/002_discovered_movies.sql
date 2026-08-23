-- Run this once in the SQL Editor, same as schema.sql was (this is a
-- second migration on top of it — you already have profiles/watchers).

-- Upcoming movies BookMyShow publishes as public metadata, refreshed daily
-- by discover.py (Python — Node/Vercel gets 403'd by BookMyShow's bot
-- protection, Python doesn't, so this table exists to keep that scraping
-- entirely server-side/Python and let the website just read pre-fetched
-- rows instead of calling BookMyShow itself).
create table public.discovered_movies (
  id             uuid primary key default gen_random_uuid(),
  city           text not null,
  et_code        text not null,
  slug           text not null,
  name           text not null,
  release_date   date,
  buytickets_url text not null,
  updated_at     timestamptz not null default now(),
  unique (city, et_code)
);

alter table public.discovered_movies enable row level security;

-- Not per-user data — any signed-in visitor can browse it. Only
-- discover.py (via the service-role key, bypassing RLS) writes to it.
create policy "signed-in users can read discovered movies"
  on public.discovered_movies for select
  to authenticated
  using (true);

create index discovered_movies_city_idx on public.discovered_movies (city);
