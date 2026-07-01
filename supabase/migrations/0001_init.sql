-- =============================================================================
-- Keto Tracker — initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once per project.
-- Every table has Row Level Security enabled and scoped to auth.uid() so each
-- user can only read/write their own rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per user with their body stats and computed targets
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  weight_kg     numeric,
  height_cm     numeric,
  age           integer,
  sex           text check (sex in ('male', 'female')),
  activity_level text check (activity_level in
                   ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal          text check (goal in ('lose_fat', 'maintain', 'gain_muscle')),
  -- Daily targets (kcal / grams). Stored so the daily view is fast and stable.
  calorie_target  numeric,
  protein_target  numeric,
  fat_target      numeric,
  net_carb_limit  numeric default 25,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- food_logs: every logged food, storing the ALREADY-SCALED per-portion values.
-- We persist computed numbers (not just a food id) so history stays accurate
-- even if the external nutrition database later changes its data.
-- ---------------------------------------------------------------------------
create table if not exists public.food_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  date          date not null,
  meal_type     text not null check (meal_type in
                   ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name     text not null,
  source        text not null check (source in ('usda', 'openfoodfacts', 'manual')),
  quantity_g    numeric not null,
  -- Computed per-portion values (already scaled by quantity):
  calories      numeric not null default 0,
  protein       numeric not null default 0,
  fat           numeric not null default 0,
  total_carbs   numeric not null default 0,
  fiber         numeric not null default 0,
  net_carbs     numeric not null default 0,
  sugar         numeric not null default 0,
  is_manual_entry boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx
  on public.food_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- weight_logs: one weight reading per user per date
-- ---------------------------------------------------------------------------
create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  weight_kg  numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists weight_logs_user_date_idx
  on public.weight_logs (user_id, date);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles    enable row level security;
alter table public.food_logs   enable row level security;
alter table public.weight_logs enable row level security;

-- profiles policies -----------------------------------------------------------
drop policy if exists "profiles are self-service" on public.profiles;
create policy "profiles are self-service"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- food_logs policies ----------------------------------------------------------
drop policy if exists "food logs are self-service" on public.food_logs;
create policy "food logs are self-service"
  on public.food_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- weight_logs policies --------------------------------------------------------
drop policy if exists "weight logs are self-service" on public.weight_logs;
create policy "weight logs are self-service"
  on public.weight_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- keep profiles.updated_at fresh
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
