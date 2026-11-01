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

-- ---------------------------------------------------------------------------
-- Stage 2: lifts (with aliases) and tested records (PRs)
-- ---------------------------------------------------------------------------

create table if not exists public.lifts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null,
  aliases    text[]      not null default '{}',   -- other names used in workout text, e.g. 'BB Push Press'
  created_at timestamptz not null default now()
);

create unique index if not exists lifts_user_name_idx on public.lifts (user_id, lower(name));

create table if not exists public.records (
  id         uuid          primary key default gen_random_uuid(),
  user_id    uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  lift_id    uuid          not null references public.lifts (id) on delete cascade,
  reps       integer       not null check (reps between 1 and 30),
  weight_kg  numeric(7, 2) not null check (weight_kg > 0),
  date       date          not null default current_date,
  note       text,
  created_at timestamptz   not null default now()
);

create index if not exists records_user_lift_idx on public.records (user_id, lift_id, date);

alter table public.lifts enable row level security;
alter table public.records enable row level security;

drop policy if exists "lifts_select_own" on public.lifts;
drop policy if exists "lifts_insert_own" on public.lifts;
drop policy if exists "lifts_update_own" on public.lifts;
drop policy if exists "lifts_delete_own" on public.lifts;

create policy "lifts_select_own" on public.lifts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "lifts_insert_own" on public.lifts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "lifts_update_own" on public.lifts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "lifts_delete_own" on public.lifts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "records_insert_own" on public.records
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "records_update_own" on public.records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "records_delete_own" on public.records
  for delete to authenticated
  using ((select auth.uid()) = user_id);
