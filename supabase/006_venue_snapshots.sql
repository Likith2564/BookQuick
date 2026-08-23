-- Run this once in the SQL Editor (sixth migration).

-- One row per (movie, city, cinema, date) actually showing bookable
-- showtimes today, refreshed every 30 min by theatres.py. "formats" is a
-- filterable array (2D/3D/IMAX/4DX/...); "rank" is BookMyShow's own
-- popularity ranking for that venue (used as the default sort — their
-- "distance" field turned out to be a constant, not real per-venue
-- distance, so there's no proximity data here).
create table public.venue_snapshots (
  id               uuid primary key default gen_random_uuid(),
  movie_et_code    text not null,
  movie_name       text not null,
  city             text not null,
  date             date not null,
  venue_name       text not null,
  redirection_url  text not null,
  formats          text[] not null default '{}',
  seat_tier        text not null default 'standard'
                     check (seat_tier in ('standard', 'premium')),
  min_price        numeric,
  rank             int,
  updated_at       timestamptz not null default now(),
  unique (movie_et_code, city, venue_name, date)
);

alter table public.venue_snapshots enable row level security;

create policy "signed-in users can read venue snapshots"
  on public.venue_snapshots for select
  to authenticated
  using (true);

create index venue_snapshots_movie_city_idx
  on public.venue_snapshots (movie_et_code, city, date);
