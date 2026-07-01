# 🥑 Keto Tracker

A multi-user keto & macro tracking web app. Log the foods you eat each day and
get **accurate calorie and macro totals pulled from real nutrition databases** —
never estimated or hardcoded values. Every account is private (Supabase Row
Level Security), so multiple people can use the same deployment.

## Core principle: real numbers, not assumptions

All nutrition values come from **live API data**:

- **USDA FoodData Central** — primary source for whole foods & generic
  ingredients.
- **Open Food Facts** — secondary source for packaged/branded products and
  barcode (UPC) lookup.

Databases return values per 100 g. The app scales them by the **exact portion**
you logged (e.g. 150 g of chicken = per-100 g value × 1.5). If a food can't be
found you can enter values manually, and the entry is clearly **flagged as
user-entered**. Nothing is ever invented or round-guessed.

## Tracked per food & per day

Calories · Protein (g) · Fat (g) · Total carbs (g) · Fiber (g) ·
**Net carbs (g) = total carbs − fiber** · Sugar (g)

Net carbs and remaining calories are shown prominently on the daily view.

## Features

- Email + password auth (Supabase), multiple private accounts via RLS.
- Profile with weight/height/age/sex/activity/goal → daily targets computed with
  the **Mifflin-St Jeor** BMR × activity factor (TDEE), adjusted for the goal.
- Keto macro split with **editable protein grams and net-carb limit**; fat fills
  the remaining calories.
- Daily logging by date and meal (breakfast/lunch/dinner/snack) with combined,
  de-duplicated, source-labelled search results.
- Edit quantity or remove logged items (nutrients re-scale automatically).
- Weight tracking with a line chart over time.
- Barcode/UPC lookup via Open Food Facts (manual number entry).

## Tech stack

React + Vite + Tailwind CSS · Supabase (Auth + Postgres + RLS) · Recharts ·
deploys to Vercel.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable                 | Where to get it                                                   |
| ------------------------ | ----------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API                                 |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon public key)               |
| `VITE_USDA_API_KEY`      | Free key: https://fdc.nal.usda.gov/api-key-signup.html            |

Open Food Facts needs no key.

### 3. Set up the database

In your Supabase project open **SQL Editor** and run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This
creates the `profiles`, `food_logs`, and `weight_logs` tables and enables Row
Level Security keyed to `auth.uid()`.

> **Auth tip:** for quick local testing you can disable email confirmation in
> Supabase → Authentication → Providers → Email. With it on, new sign-ups must
> confirm via email before signing in.

### 4. Run

```bash
npm run dev
```

Open http://localhost:5173, sign up, fill in your profile, and start logging.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel (framework preset: **Vite**).
3. Add the three `VITE_*` environment variables in the Vercel project settings.
4. Deploy. `vercel.json` already sets the build command, output directory, and
   SPA rewrites.

## Database schema

| Table         | Key columns                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`    | `user_id`, `weight_kg`, `height_cm`, `age`, `sex`, `activity_level`, `goal`, `calorie_target`, `protein_target`, `fat_target`, `net_carb_limit` |
| `food_logs`   | `id`, `user_id`, `date`, `meal_type`, `food_name`, `source`, `quantity_g`, `calories`, `protein`, `fat`, `total_carbs`, `fiber`, `net_carbs`, `sugar`, `is_manual_entry` |
| `weight_logs` | `id`, `user_id`, `date`, `weight_kg`                                                                                              |

`food_logs` stores the **already-scaled per-portion values** so history stays
accurate even if an external database later changes its data.

## Security note

Keep API keys in `.env` (gitignored) and in Vercel env vars — never commit them.
If a key is ever exposed, rotate it.
