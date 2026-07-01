// =============================================================================
// Body-metric and macro-target calculations.
// All values are derived from the user's profile — no hardcoded calorie guesses.
// =============================================================================

// Activity multipliers applied to BMR to estimate Total Daily Energy Expenditure
export const ACTIVITY_FACTORS = {
  sedentary: 1.2, // little or no exercise
  light: 1.375, // light exercise 1-3 days/week
  moderate: 1.55, // moderate exercise 3-5 days/week
  active: 1.725, // hard exercise 6-7 days/week
  very_active: 1.9, // very hard exercise / physical job
}

export const ACTIVITY_LABELS = {
  sedentary: 'Sedentary (little/no exercise)',
  light: 'Light (1-3 days/week)',
  moderate: 'Moderate (3-5 days/week)',
  active: 'Active (6-7 days/week)',
  very_active: 'Very active (athlete / physical job)',
}

export const GOAL_LABELS = {
  lose_fat: 'Lose fat',
  maintain: 'Maintain',
  gain_muscle: 'Gain muscle',
}

// Calorie adjustment applied to TDEE for each goal.
const GOAL_ADJUSTMENT = {
  lose_fat: -0.2, // 20% deficit
  maintain: 0,
  gain_muscle: 0.1, // 10% surplus
}

/**
 * Mifflin-St Jeor Basal Metabolic Rate (kcal/day).
 * men:   10*kg + 6.25*cm - 5*age + 5
 * women: 10*kg + 6.25*cm - 5*age - 161
 */
export function calculateBMR({ weight_kg, height_cm, age, sex }) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

/** Total Daily Energy Expenditure = BMR × activity factor. */
export function calculateTDEE(profile) {
  const bmr = calculateBMR(profile)
  const factor = ACTIVITY_FACTORS[profile.activity_level] ?? 1.2
  return bmr * factor
}

/**
 * Compute daily targets from a profile.
 *
 * Calories = TDEE adjusted for the goal.
 * Macros follow a keto layout:
 *   - Net carbs are capped by an editable limit (default 25g).
 *   - Protein defaults to 1.6 g per kg of body weight (a moderate, muscle-
 *     sparing keto amount) but the caller may override the grams.
 *   - Fat fills whatever calories remain (the classic high-fat keto remainder).
 *
 * Returns whole-number targets ready to store on the profile.
 * Pass `overrides` to respect a user-entered protein or net-carb value.
 */
export function calculateTargets(profile, overrides = {}) {
  const tdee = calculateTDEE(profile)
  const adjustment = GOAL_ADJUSTMENT[profile.goal] ?? 0
  const calorie_target = Math.round(tdee * (1 + adjustment))

  const net_carb_limit =
    overrides.net_carb_limit != null
      ? Number(overrides.net_carb_limit)
      : (profile.net_carb_limit != null ? Number(profile.net_carb_limit) : 25)

  const protein_target =
    overrides.protein_target != null
      ? Number(overrides.protein_target)
      : Math.round(1.6 * profile.weight_kg)

  // Fat = remaining calories after protein (4 kcal/g) and carbs (4 kcal/g).
  const remainingKcal =
    calorie_target - protein_target * 4 - net_carb_limit * 4
  const fat_target = Math.max(0, Math.round(remainingKcal / 9))

  return {
    calorie_target,
    protein_target: Math.round(protein_target),
    fat_target,
    net_carb_limit: Math.round(net_carb_limit),
  }
}

/** Net carbs = total carbs − fiber, never below zero. */
export function netCarbs(total_carbs, fiber) {
  return Math.max(0, (Number(total_carbs) || 0) - (Number(fiber) || 0))
}
