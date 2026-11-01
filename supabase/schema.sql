-- Workouts app schema. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.

create table if not exists public.workouts (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  uid        text        not null,              -- PushPress workout uid, used to dedupe imports
  date       date        not null,
  weekday    text,
  program    text        not null,              -- 'BUILD' | 'SHRED'
  parts      jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, uid)
);

create index if not exists workouts_user_date_idx on public.workouts (user_id, date);

alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_select_own" on public.workouts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "workouts_insert_own" on public.workouts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "workouts_update_own" on public.workouts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "workouts_delete_own" on public.workouts
  for delete to authenticated
  using ((select auth.uid()) = user_id);
