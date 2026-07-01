// Small shared formatting helpers.

/** Round to a fixed number of decimals and strip trailing zeros. */
export function fmt(value, decimals = 0) {
  const n = Number(value) || 0
  return Number(n.toFixed(decimals)).toString()
}

/** Today's date as a YYYY-MM-DD string in the user's local timezone. */
export function todayISO() {
  const d = new Date()
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d - tzOffset).toISOString().slice(0, 10)
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}
