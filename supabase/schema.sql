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

-- ---------------------------------------------------------------------------
-- Stage 3: workout logs
-- One row per calendar date + program + part. part_index = -1 is the whole
-- workout (the "done" mark). Keyed by date, not workout uid, because loop
-- repeats reuse the same uid.
-- ---------------------------------------------------------------------------

create table if not exists public.logs (
  id         uuid          primary key default gen_random_uuid(),
  user_id    uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  date       date          not null,
  program    text          not null,                -- 'BUILD' | 'SHRED'
  part_index integer       not null check (part_index >= -1),
  weight_kg  numeric(7, 2) check (weight_kg is null or weight_kg > 0),
  reps       integer       check (reps is null or reps between 1 and 100),
  comment    text,
  done       boolean       not null default false,  -- used by the part_index = -1 row
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now()
);

create unique index if not exists logs_user_slot_idx on public.logs (user_id, date, program, part_index);

alter table public.logs enable row level security;

drop policy if exists "logs_select_own" on public.logs;
drop policy if exists "logs_insert_own" on public.logs;
drop policy if exists "logs_update_own" on public.logs;
drop policy if exists "logs_delete_own" on public.logs;

create policy "logs_select_own" on public.logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "logs_insert_own" on public.logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "logs_update_own" on public.logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "logs_delete_own" on public.logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Stage 5: gym plans (a rotation of workouts A, B, C... from the coach's xlsx)
-- Nothing here touches the tables above, so the PushPress side keeps working.
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null,
  start_date date        not null,
  months     integer     not null check (months between 1 and 24),
  rest_days  integer[]   not null default '{}',          -- weekdays without training, 0 = Sunday ... 6 = Saturday
  days       jsonb       not null default '[]'::jsonb,   -- [{ label, tag, items: [{ kind, name, sets, reps }] }]
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

-- One active plan per user. Older plans stay (inactive) with their logs.
create unique index if not exists plans_one_active_idx on public.plans (user_id) where active;

create table if not exists public.set_logs (
  id         uuid          primary key default gen_random_uuid(),
  user_id    uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id    uuid          not null references public.plans (id) on delete cascade,
  date       date          not null,
  day_index  integer       not null check (day_index >= 0),   -- position of the workout in plans.days
  item_index integer       not null check (item_index >= 0),  -- position of the exercise in that workout
  set_index  integer       not null check (set_index >= 0),
  exercise   text          not null,                          -- normalised exercise name, for "last time" across plans
  weight_kg  numeric(7, 2) check (weight_kg is null or weight_kg >= 0),
  reps       integer       check (reps is null or reps between 0 and 200),
  updated_at timestamptz   not null default now()
);

create unique index if not exists set_logs_slot_idx on public.set_logs (user_id, plan_id, date, day_index, item_index, set_index);
create index if not exists set_logs_exercise_idx on public.set_logs (user_id, exercise, date);

create table if not exists public.plan_sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id    uuid        not null references public.plans (id) on delete cascade,
  date       date        not null,
  day_index  integer     not null check (day_index >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists plan_sessions_slot_idx on public.plan_sessions (user_id, plan_id, date, day_index);

alter table public.plans enable row level security;
alter table public.set_logs enable row level security;
alter table public.plan_sessions enable row level security;

drop policy if exists "plans_select_own" on public.plans;
drop policy if exists "plans_insert_own" on public.plans;
drop policy if exists "plans_update_own" on public.plans;
drop policy if exists "plans_delete_own" on public.plans;

create policy "plans_select_own" on public.plans
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "plans_insert_own" on public.plans
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "plans_update_own" on public.plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "plans_delete_own" on public.plans
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "set_logs_select_own" on public.set_logs;
drop policy if exists "set_logs_insert_own" on public.set_logs;
drop policy if exists "set_logs_update_own" on public.set_logs;
drop policy if exists "set_logs_delete_own" on public.set_logs;

create policy "set_logs_select_own" on public.set_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "set_logs_insert_own" on public.set_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "set_logs_update_own" on public.set_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "set_logs_delete_own" on public.set_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "plan_sessions_select_own" on public.plan_sessions;
drop policy if exists "plan_sessions_insert_own" on public.plan_sessions;
drop policy if exists "plan_sessions_update_own" on public.plan_sessions;
drop policy if exists "plan_sessions_delete_own" on public.plan_sessions;

create policy "plan_sessions_select_own" on public.plan_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "plan_sessions_insert_own" on public.plan_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "plan_sessions_update_own" on public.plan_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "plan_sessions_delete_own" on public.plan_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);
