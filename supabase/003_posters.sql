-- Run this once in the SQL Editor (third migration, on top of the first two).

alter table public.discovered_movies add column if not exists poster_url text;
alter table public.watchers add column if not exists poster_url text;
