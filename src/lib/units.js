// =============================================================================
// Portion unit definitions and conversion to grams.
//
// Everything in the app is ultimately scaled by GRAMS (per-100g nutrition), so
// each unit converts to grams. Weight units are exact. Volume units require a
// density (g/ml); when the food doesn't define one we assume water (1 g/ml) and
// the caller flags the value as approximate — we never silently pretend a
// volume conversion is exact.
// =============================================================================

export const UNITS = {
  g: { label: 'grams (g)', type: 'weight', grams: 1 },
  oz: { label: 'ounces (oz)', type: 'weight', grams: 28.3495 },
  lb: { label: 'pounds (lb)', type: 'weight', grams: 453.592 },
  ml: { label: 'millilitres (ml)', type: 'volume', ml: 1 },
  tsp: { label: 'teaspoon (tsp)', type: 'volume', ml: 4.92892 },
  tbsp: { label: 'tablespoon (tbsp)', type: 'volume', ml: 14.7868 },
  cup: { label: 'cup', type: 'volume', ml: 236.588 },
  serving: { label: 'serving', type: 'serving' },
}

/**
 * Convert an amount in the given unit to grams.
 * @param {number} amount
 * @param {string} unit    key of UNITS
 * @param {object} opts    { density (g/ml), serving_g (grams per serving) }
 * @returns {number|null}  grams, or null if the unit can't be resolved
 *                         (e.g. "serving" with no known serving weight).
 */
export function toGrams(amount, unit, { density = 1, serving_g = null } = {}) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return null
  const u = UNITS[unit]
  if (!u) return n
  if (u.type === 'weight') return n * u.grams
  if (u.type === 'volume') return n * u.ml * (Number(density) || 1)
  if (u.type === 'serving') return serving_g ? n * serving_g : null
  return n
}

/**
 * True when a volume unit is being converted without a known density, so the
 * gram figure (and therefore the nutrients) are only approximate.
 */
export function isApproxConversion(unit, density) {
  return UNITS[unit]?.type === 'volume' && !(Number(density) > 0 && density !== 1)
}

/**
 * Which units to offer for a given food.
 * "serving" is only offered when we know a serving's gram weight.
 */
export function availableUnits(food) {
  const keys = ['g', 'oz', 'lb', 'ml', 'tsp', 'tbsp', 'cup']
  if (food?.servingSize) keys.push('serving')
  return keys
}
