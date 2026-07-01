-- =============================================================================
-- Keto Tracker — saved custom foods ("My Foods") + unit support
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
-- =============================================================================

-- Allow 'custom' as a food_logs source (foods logged from the saved library).
alter table public.food_logs drop constraint if exists food_logs_source_check;
alter table public.food_logs
  add constraint food_logs_source_check
  check (source in ('usda', 'openfoodfacts', 'manual', 'custom'));

-- ---------------------------------------------------------------------------
-- custom_foods: reusable, user-entered products. Nutrition stored per 100 g.
-- Optional serving_g / density_g_per_ml enable accurate serving and volume
-- (tsp/tbsp/cup) conversions for the user's own products.
-- ---------------------------------------------------------------------------
create table if not exists public.custom_foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  brand         text,
  -- per-100 g nutrition
  calories      numeric not null default 0,
  protein       numeric not null default 0,
  fat           numeric not null default 0,
  total_carbs   numeric not null default 0,
  fiber         numeric not null default 0,
  sugar         numeric not null default 0,
  serving_g         numeric, -- grams in one serving (optional)
  density_g_per_ml  numeric, -- for exact volume conversions (optional)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists custom_foods_user_idx
  on public.custom_foods (user_id);

-- Row Level Security: each user only sees their own saved foods.
alter table public.custom_foods enable row level security;

drop policy if exists "custom foods are self-service" on public.custom_foods;
create policy "custom foods are self-service"
  on public.custom_foods
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- keep updated_at fresh (reuses the function created in 0001_init.sql)
drop trigger if exists custom_foods_set_updated_at on public.custom_foods;
create trigger custom_foods_set_updated_at
  before update on public.custom_foods
  for each row execute function public.set_updated_at();
