// =============================================================================
// Saved custom foods ("My Foods").
//
// A custom food is a user-entered product whose nutrition is stored ONCE (as
// per-100g values) and reused. Because it uses the same per-100g shape as USDA
// and Open Food Facts results, it flows through the exact same scaling logic
// (scaleToPortion) — so logging "2 tbsp of my peanut butter" is calculated,
// never re-typed.
// =============================================================================

import { supabase } from './supabase'

/** Fetch all of the current user's saved foods, newest first. */
export async function listCustomFoods(userId) {
  const { data, error } = await supabase
    .from('custom_foods')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

/** Insert a new custom food. `payload` already holds per-100g values. */
export async function createCustomFood(userId, payload) {
  const { data, error } = await supabase
    .from('custom_foods')
    .insert({ ...payload, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomFood(id, patch) {
  const { data, error } = await supabase
    .from('custom_foods')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCustomFood(id) {
  const { error } = await supabase.from('custom_foods').delete().eq('id', id)
  if (error) throw error
}

/**
 * Normalise a custom_foods row into the shared "food" shape used by the logger
 * and scaleToPortion(), so saved foods behave exactly like API results.
 */
export function customToFood(cf) {
  return {
    id: `custom-${cf.id}`,
    name: cf.name,
    brand: cf.brand || null,
    source: 'custom',
    servingSize: cf.serving_g != null ? Number(cf.serving_g) : null,
    servingLabel: cf.serving_g != null ? `${cf.serving_g} g` : null,
    density: cf.density_g_per_ml != null ? Number(cf.density_g_per_ml) : null,
    per100g: {
      calories: Number(cf.calories) || 0,
      protein: Number(cf.protein) || 0,
      fat: Number(cf.fat) || 0,
      total_carbs: Number(cf.total_carbs) || 0,
      fiber: Number(cf.fiber) || 0,
      sugar: Number(cf.sugar) || 0,
    },
  }
}

/**
 * Convert nutrition values entered for an arbitrary reference amount into the
 * per-100g values we store. E.g. a label reading "per 30 g serving" → ×100/30.
 */
export function toPer100g(values, referenceGrams) {
  const ref = Number(referenceGrams) || 100
  const factor = 100 / ref
  const scale = (v) => Math.round(((Number(v) || 0) * factor) * 100) / 100
  return {
    calories: scale(values.calories),
    protein: scale(values.protein),
    fat: scale(values.fat),
    total_carbs: scale(values.total_carbs),
    fiber: scale(values.fiber),
    sugar: scale(values.sugar),
  }
}
