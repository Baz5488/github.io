-- Workout Control cloud database
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight numeric(6,2),
  waist numeric(6,2),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  name text not null,
  type text,
  min_reps integer not null default 1,
  max_reps integer not null default 12,
  load numeric(7,2) not null default 0,
  unit text not null default 'kg',
  reps integer not null default 1,
  rir integer not null default 2,
  sets integer not null default 3,
  note text,
  updated_at timestamptz not null default now(),
  primary key(user_id, exercise_id)
);

create table if not exists public.workout_history (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.exercise_state enable row level security;
alter table public.workout_history enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Exercise state
create policy "exercise_select_own" on public.exercise_state for select using (auth.uid() = user_id);
create policy "exercise_insert_own" on public.exercise_state for insert with check (auth.uid() = user_id);
create policy "exercise_update_own" on public.exercise_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- History
create policy "history_select_own" on public.workout_history for select using (auth.uid() = user_id);
create policy "history_insert_own" on public.workout_history for insert with check (auth.uid() = user_id);
create policy "history_update_own" on public.workout_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "history_delete_own" on public.workout_history for delete using (auth.uid() = user_id);

-- Optional: automatic profile row after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
