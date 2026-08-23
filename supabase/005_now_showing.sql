-- Run this once in the SQL Editor (fifth migration).

create table public.now_showing_movies (
  id           uuid primary key default gen_random_uuid(),
  city         text not null,
  et_code      text not null,
  slug         text not null,
  name         text not null,
  poster_url   text,
  -- Both null when BookMyShow hasn't accumulated ratings for this title
  -- yet — shown as "not yet rated" on the website, never fabricated.
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
