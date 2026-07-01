import { fmt } from '../lib/format'

/**
 * A labelled target-vs-consumed progress bar.
 * `overGood` flips the colour logic: for net carbs, exceeding the limit is bad
 * (turns red); for protein, meeting/exceeding is fine.
 */
export default function MacroBar({
  label,
  consumed,
  target,
  unit = 'g',
  overIsBad = false,
  accent = 'bg-keto-600',
}) {
  const hasTarget = target != null && target > 0
  const pct = hasTarget ? Math.min(100, (consumed / target) * 100) : 0
  const over = hasTarget && consumed > target
  const remaining = hasTarget ? target - consumed : null

  const barColor = over ? (overIsBad ? 'bg-red-500' : accent) : accent

  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          <span className={over && overIsBad ? 'text-red-600 font-semibold' : ''}>
            {fmt(consumed, 1)}
          </span>
          {hasTarget && (
            <span className="text-slate-400"> / {fmt(target)} {unit}</span>
          )}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hasTarget && (
        <div className="text-xs text-slate-400 mt-0.5">
          {remaining >= 0
            ? `${fmt(remaining, 1)} ${unit} remaining`
            : `${fmt(Math.abs(remaining), 1)} ${unit} over`}
        </div>
      )}
    </div>
  )
}
