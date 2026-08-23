-- BookQuick: accounts + DB schema.
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).

-- One row per signed-up user, kept in sync with auth.users so the
-- checker script (which uses the service-role key, not a logged-in
-- session) can read emails without calling the admin API.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Keeps profiles in sync automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- One row per movie/cinema a user is watching.
create table public.watchers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  movie          text not null,
  url            text not null,
  mode           text not null default 'showtime_regex'
                   check (mode in ('showtime_regex', 'marker')),
  open_marker    text,
  closed_marker  text,
  status         text not null default 'coming_soon'
                   check (status in ('coming_soon', 'available', 'unknown')),
  poster_url     text,
  -- Both optional: unset means "any cinema" / "any format" (the original
  -- whole-city behavior). When set, check.py isolates that cinema's own
  -- block of the buytickets page before checking for showtimes/format,
  -- so an unrelated cinema opening first doesn't trigger a false alert.
  cinema_name    text,
  format         text,
  last_checked_at timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.watchers enable row level security;

-- Users can fully manage only their own watchers. The checker script
-- bypasses RLS entirely by using the service-role key.
create policy "users manage own watchers"
  on public.watchers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index watchers_user_id_idx on public.watchers (user_id);

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
  poster_url     text,
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

-- Currently-showing movies + audience ratings, refreshed daily by
-- nowshowing.py (same Python-only pattern as discovered_movies).
create table public.now_showing_movies (
  id           uuid primary key default gen_random_uuid(),
  city         text not null,
  et_code      text not null,
  slug         text not null,
  name         text not null,
  poster_url   text,
  rating       numeric,
  rating_label text,
  updated_at   timestamptz not null default now(),
  unique (city, et_code)
);

alter table public.now_showing_movies enable row level security;

create policy "signed-in users can read now-showing movies"
  on public.now_showing_movies for select
  to authenticated
  using (true);

create index now_showing_movies_city_idx on public.now_showing_movies (city);

-- One row per (movie, city, cinema, date) actually showing bookable
-- showtimes today, refreshed every 30 min by theatres.py. "rank" is
-- BookMyShow's own popularity ranking for that venue (their "distance"
-- field turned out to be a constant, not real per-venue distance).
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
