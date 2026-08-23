-- Run this once in the SQL Editor (fourth migration).

alter table public.watchers add column if not exists cinema_name text;
alter table public.watchers add column if not exists format text;
