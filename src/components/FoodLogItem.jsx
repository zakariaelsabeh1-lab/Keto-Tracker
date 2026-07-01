import { useState } from 'react'
import { fmt } from '../lib/format'

/**
 * A single logged food row. Supports inline editing of the quantity (which
 * re-scales all stored nutrients proportionally) and removal.
 *
 * Because food_logs stores per-portion values, editing quantity scales every
 * nutrient by newGrams / oldGrams — keeping the numbers internally consistent
 * without re-querying the API.
 */
export default function FoodLogItem({ item, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [grams, setGrams] = useState(item.quantity_g)

  const saveEdit = () => {
    const newGrams = Number(grams)
    if (!newGrams || newGrams <= 0 || newGrams === item.quantity_g) {
      setEditing(false)
      return
    }
    const factor = newGrams / item.quantity_g
    onUpdate(item.id, {
      quantity_g: newGrams,
      calories: round1(item.calories * factor),
      protein: round1(item.protein * factor),
      fat: round1(item.fat * factor),
      total_carbs: round1(item.total_carbs * factor),
      fiber: round1(item.fiber * factor),
      net_carbs: round1(item.net_carbs * factor),
      sugar: round1(item.sugar * factor),
    })
    setEditing(false)
  }

  return (
    <div className="py-2 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-800 truncate">
            {item.food_name}
          </span>
          {item.is_manual_entry && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium shrink-0">
              Manual
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          {fmt(item.calories)} cal · {fmt(item.protein, 1)}p ·{' '}
          {fmt(item.fat, 1)}f ·{' '}
          <span className="text-keto-700 font-medium">
            {fmt(item.net_carbs, 1)}g net carbs
          </span>
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="input w-20 py-1"
            autoFocus
          />
          <span className="text-xs text-slate-400">g</span>
          <button onClick={saveEdit} className="btn-primary py-1 px-2 text-xs">
            Save
          </button>
          <button
            onClick={() => {
              setGrams(item.quantity_g)
              setEditing(false)
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-slate-500 hover:text-keto-700"
          >
            {fmt(item.quantity_g)}g
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="text-slate-300 hover:text-red-500 text-sm"
            title="Remove"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}
