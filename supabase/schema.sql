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
