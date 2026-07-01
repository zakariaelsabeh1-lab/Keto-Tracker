import MacroBar from './MacroBar'
import { fmt } from '../lib/format'

/**
 * The day's headline numbers: remaining calories + net carbs front and centre
 * (keto-focused), then target-vs-consumed bars for every tracked macro.
 *
 * `totals` is the summed per-nutrient object for the day.
 * `targets` comes from the user's profile (may be null if not set up yet).
 */
export default function DaySummary({ totals, targets }) {
  const calTarget = targets?.calorie_target ?? null
  const caloriesRemaining =
    calTarget != null ? calTarget - totals.calories : null
  const netCarbLimit = targets?.net_carb_limit ?? null
  const netCarbsLeft =
    netCarbLimit != null ? netCarbLimit - totals.net_carbs : null

  return (
    <div className="card p-4 space-y-4">
      {/* Headline: calories remaining + net carbs */}
      <div className="grid grid-cols-2 gap-3">
        <Headline
          label="Calories remaining"
          value={caloriesRemaining != null ? fmt(caloriesRemaining) : fmt(totals.calories)}
          sub={
            calTarget != null
              ? `${fmt(totals.calories)} of ${fmt(calTarget)} eaten`
              : `${fmt(totals.calories)} eaten · set a target in Profile`
          }
          negative={caloriesRemaining != null && caloriesRemaining < 0}
        />
        <Headline
          label="Net carbs"
          value={fmt(totals.net_carbs, 1)}
          unit="g"
          sub={
            netCarbLimit != null
              ? netCarbsLeft >= 0
                ? `${fmt(netCarbsLeft, 1)}g under your ${fmt(netCarbLimit)}g limit`
                : `${fmt(Math.abs(netCarbsLeft), 1)}g OVER your ${fmt(netCarbLimit)}g limit`
              : 'set a net carb limit in Profile'
          }
          negative={netCarbsLeft != null && netCarbsLeft < 0}
          highlight
        />
      </div>

      {/* Macro progress bars */}
      <div className="space-y-3 pt-1">
        <MacroBar
          label="Net carbs"
          consumed={totals.net_carbs}
          target={netCarbLimit}
          overIsBad
          accent="bg-keto-600"
        />
        <MacroBar
          label="Protein"
          consumed={totals.protein}
          target={targets?.protein_target}
          accent="bg-blue-500"
        />
        <MacroBar
          label="Fat"
          consumed={totals.fat}
          target={targets?.fat_target}
          accent="bg-amber-500"
        />
        <MacroBar
          label="Calories"
          consumed={totals.calories}
          target={calTarget}
          unit="cal"
          accent="bg-keto-700"
        />
      </div>

      {/* Secondary totals */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-100">
        <Mini label="Total carbs" value={`${fmt(totals.total_carbs, 1)}g`} />
        <Mini label="Fiber" value={`${fmt(totals.fiber, 1)}g`} />
        <Mini label="Sugar" value={`${fmt(totals.sugar, 1)}g`} />
      </div>
    </div>
  )
}

function Headline({ label, value, unit = '', sub, negative, highlight }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight ? 'bg-keto-50 border border-keto-200' : 'bg-slate-50'
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-2xl font-bold ${
          negative ? 'text-red-600' : 'text-slate-800'
        }`}
      >
        {value}
        {unit && <span className="text-base font-medium">{unit}</span>}
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div className="pt-2">
      <div className="font-semibold text-slate-700">{value}</div>
      <div className="text-slate-400">{label}</div>
    </div>
  )
}
