// =============================================================================
// Nutrition data layer.
//
// Core principle: every nutrient value comes from a live API response and is
// scaled by the EXACT portion the user logged. We never invent or round-guess
// values. All external results are normalised to a common "per 100 g" shape so
// the rest of the app can scale uniformly.
//
// A normalised food looks like:
//   {
//     id, name, brand, source ('usda' | 'openfoodfacts'),
//     servingSize (g|null), servingLabel (string|null),
//     per100g: { calories, protein, fat, total_carbs, fiber, sugar }
//   }
// Any nutrient the source did not provide is `null` (not 0) so the UI can flag
// incomplete data instead of pretending it was zero.
// =============================================================================

import { netCarbs } from './calculations'

const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE = 'https://world.openfoodfacts.org'

// USDA nutrient numbers we care about (stable identifiers in FoodData Central).
const USDA_NUTRIENT_NUMBERS = {
  calories: '208', // Energy (kcal)
  protein: '203', // Protein
  fat: '204', // Total lipid (fat)
  total_carbs: '205', // Carbohydrate, by difference
  fiber: '291', // Fiber, total dietary
  sugar: '269', // Sugars, total including NLEA
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// USDA FoodData Central
// ---------------------------------------------------------------------------
function mapUsdaFood(food) {
  // The search endpoint already returns an abridged foodNutrients array with
  // per-100g values for Foundation / SR Legacy / Branded foods.
  const byNumber = {}
  for (const n of food.foodNutrients || []) {
    const key = String(n.nutrientNumber ?? n.number ?? '')
    if (key) byNumber[key] = n.value
  }

  const per100g = {}
  for (const [field, code] of Object.entries(USDA_NUTRIENT_NUMBERS)) {
    per100g[field] = num(byNumber[code])
  }

  return {
    id: `usda-${food.fdcId}`,
    name: food.description || 'Unknown food',
    brand: food.brandOwner || food.brandName || null,
    source: 'usda',
    servingSize: num(food.servingSize) || null,
    servingLabel:
      food.servingSize && food.servingSizeUnit
        ? `${food.servingSize} ${food.servingSizeUnit}`
        : null,
    per100g,
  }
}

async function searchUsda(query) {
  if (!USDA_API_KEY || USDA_API_KEY === 'your-usda-api-key') return []
  const url =
    `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}` +
    `&query=${encodeURIComponent(query)}&pageSize=15` +
    `&dataType=Foundation,SR%20Legacy,Branded`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`)
  const data = await res.json()
  return (data.foods || []).map(mapUsdaFood)
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------
function mapOffProduct(product) {
  const n = product.nutriments || {}
  const per100g = {
    // OFF exposes energy-kcal_100g; fall back to converting kJ if needed.
    calories:
      num(n['energy-kcal_100g']) ??
      (num(n['energy_100g']) != null ? Math.round(num(n['energy_100g']) / 4.184) : null),
    protein: num(n['proteins_100g']),
    fat: num(n['fat_100g']),
    total_carbs: num(n['carbohydrates_100g']),
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
  }

  return {
    id: `off-${product.code}`,
    code: product.code, // barcode
    name:
      product.product_name ||
      product.generic_name ||
      product.product_name_en ||
      'Unknown product',
    brand: product.brands || null,
    source: 'openfoodfacts',
    servingSize: num(product.serving_quantity) || null,
    servingLabel: product.serving_size || null,
    per100g,
  }
}

async function searchOpenFoodFacts(query) {
  const url =
    `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=15` +
    `&fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`)
  const data = await res.json()
  return (data.products || [])
    .filter((p) => p.product_name || p.generic_name)
    .map(mapOffProduct)
}

/**
 * Look up a single product by barcode/UPC via Open Food Facts.
 * Returns a normalised food or null if not found.
 */
export async function lookupBarcode(barcode) {
  const code = String(barcode).trim()
  if (!code) return null
  const url =
    `${OFF_BASE}/api/v0/product/${encodeURIComponent(code)}.json` +
    `?fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`)
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  return mapOffProduct(data.product)
}

/**
 * Search BOTH sources in parallel, merge, and de-duplicate.
 * If one source errors we still return the other's results (and report which
 * source failed) so a single outage never blocks the user.
 */
export async function searchFoods(query) {
  const trimmed = query.trim()
  if (!trimmed) return { results: [], errors: [] }

  const [usda, off] = await Promise.allSettled([
    searchUsda(trimmed),
    searchOpenFoodFacts(trimmed),
  ])

  const results = []
  const errors = []

  if (usda.status === 'fulfilled') results.push(...usda.value)
  else errors.push(`USDA: ${usda.reason?.message || 'unavailable'}`)

  if (off.status === 'fulfilled') results.push(...off.value)
  else errors.push(`Open Food Facts: ${off.reason?.message || 'unavailable'}`)

  return { results: dedupeFoods(results), errors }
}

// De-duplicate by normalised name+brand, keeping the entry with the most
// complete nutrient data (USDA and OFF often list the same branded item).
function dedupeFoods(foods) {
  const seen = new Map()
  const completeness = (f) =>
    Object.values(f.per100g).filter((v) => v != null).length

  for (const food of foods) {
    const key = `${food.name}|${food.brand || ''}`.toLowerCase().trim()
    const existing = seen.get(key)
    if (!existing || completeness(food) > completeness(existing)) {
      seen.set(key, food)
    }
  }
  return Array.from(seen.values())
}

/**
 * Scale a normalised food's per-100g values to the portion the user logged.
 *
 * @param {object} food        normalised food (per100g values)
 * @param {number} quantity_g  grams eaten
 * @returns per-portion nutrient object ready to store in food_logs.
 *          Missing source values are treated as 0 for totals but the food
 *          should be flagged if key macros were absent.
 */
export function scaleToPortion(food, quantity_g) {
  const factor = (Number(quantity_g) || 0) / 100
  const p = food.per100g
  const total_carbs = (p.total_carbs ?? 0) * factor
  const fiber = (p.fiber ?? 0) * factor

  return {
    calories: round1((p.calories ?? 0) * factor),
    protein: round1((p.protein ?? 0) * factor),
    fat: round1((p.fat ?? 0) * factor),
    total_carbs: round1(total_carbs),
    fiber: round1(fiber),
    net_carbs: round1(netCarbs(total_carbs, fiber)),
    sugar: round1((p.sugar ?? 0) * factor),
  }
}

/** True when the source was missing any of the tracked macros. */
export function hasIncompleteData(food) {
  return Object.values(food.per100g).some((v) => v == null)
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}
