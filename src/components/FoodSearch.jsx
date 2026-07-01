import { useState } from 'react'
import {
  searchFoods,
  lookupBarcode,
  scaleToPortion,
  hasIncompleteData,
} from '../lib/nutrition'
import { fmt, MEAL_LABELS, MEAL_TYPES } from '../lib/format'
import { netCarbs } from '../lib/calculations'

// Three ways to add a food: text search (USDA + OFF), barcode (OFF), or a
// manual entry that is clearly flagged as user-entered.
const MODES = [
  { id: 'search', label: 'Search' },
  { id: 'barcode', label: 'Barcode' },
  { id: 'manual', label: 'Manual' },
]

export default function FoodSearch({ defaultMeal = 'breakfast', onAdd }) {
  const [mode, setMode] = useState('search')

  return (
    <div className="card p-4 space-y-4">
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-keto-100 text-keto-800'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'search' && (
        <SearchMode defaultMeal={defaultMeal} onAdd={onAdd} />
      )}
      {mode === 'barcode' && (
        <BarcodeMode defaultMeal={defaultMeal} onAdd={onAdd} />
      )}
      {mode === 'manual' && (
        <ManualMode defaultMeal={defaultMeal} onAdd={onAdd} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: source badge
// ---------------------------------------------------------------------------
function SourceBadge({ source }) {
  const map = {
    usda: { label: 'USDA', cls: 'bg-blue-100 text-blue-700' },
    openfoodfacts: { label: 'Open Food Facts', cls: 'bg-amber-100 text-amber-700' },
    manual: { label: 'Manual', cls: 'bg-slate-200 text-slate-600' },
  }
  const s = map[source] || map.manual
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Shared: once a food is selected, choose a portion (grams) + meal and add it.
// Shows a live preview of the scaled macros before adding.
// ---------------------------------------------------------------------------
function PortionForm({ food, defaultMeal, onAdd, onCancel }) {
  const [grams, setGrams] = useState(food.servingSize || 100)
  const [meal, setMeal] = useState(defaultMeal)

  const scaled = scaleToPortion(food, grams)
  const incomplete = hasIncompleteData(food)

  const handleAdd = () => {
    if (!grams || grams <= 0) return
    onAdd({
      meal_type: meal,
      food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
      source: food.source,
      quantity_g: Number(grams),
      ...scaled,
      is_manual_entry: food.source === 'manual',
    })
  }

  return (
    <div className="border border-keto-200 bg-keto-50 rounded-lg p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800 text-sm">{food.name}</div>
          {food.brand && (
            <div className="text-xs text-slate-500">{food.brand}</div>
          )}
        </div>
        <SourceBadge source={food.source} />
      </div>

      {incomplete && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠️ This source is missing some nutrient values (treated as 0). Consider
          Manual entry for full accuracy.
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Amount (grams)</label>
          <input
            type="number"
            min="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="input"
          />
          {food.servingLabel && (
            <p className="text-xs text-slate-400 mt-1">
              Serving: {food.servingLabel}
            </p>
          )}
        </div>
        <div className="flex-1">
          <label className="label">Meal</label>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            className="input"
          >
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live preview of scaled nutrients for this exact portion */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <Preview label="Cal" value={scaled.calories} />
        <Preview label="Protein" value={scaled.protein} unit="g" />
        <Preview label="Fat" value={scaled.fat} unit="g" />
        <Preview label="Net carbs" value={scaled.net_carbs} unit="g" highlight />
      </div>

      <div className="flex gap-2">
        <button onClick={handleAdd} className="btn-primary flex-1">
          Add to log
        </button>
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Preview({ label, value, unit = '', highlight = false }) {
  return (
    <div
      className={`rounded-lg py-1.5 ${
        highlight ? 'bg-keto-600 text-white' : 'bg-white border border-slate-200'
      }`}
    >
      <div className="font-semibold">
        {fmt(value, 1)}
        {unit}
      </div>
      <div className={highlight ? 'text-keto-100' : 'text-slate-400'}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search mode
// ---------------------------------------------------------------------------
function SearchMode({ defaultMeal, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState(null)

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSelected(null)
    setErrors([])
    try {
      const { results, errors } = await searchFoods(query)
      setResults(results)
      setErrors(errors)
    } catch (err) {
      setErrors([err.message])
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search foods (e.g. chicken breast, avocado)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {errors.length > 0 && (
        <p className="text-xs text-amber-700">
          Some sources were unavailable: {errors.join('; ')}
        </p>
      )}

      {selected && (
        <PortionForm
          food={selected}
          defaultMeal={defaultMeal}
          onAdd={(log) => {
            onAdd(log)
            setSelected(null)
          }}
          onCancel={() => setSelected(null)}
        />
      )}

      {!selected && (
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {results.map((food) => (
            <button
              key={food.id}
              onClick={() => setSelected(food)}
              className="w-full text-left py-2 px-1 hover:bg-slate-50 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-slate-800 truncate">
                  {food.name}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {food.brand ? `${food.brand} · ` : ''}
                  {fmt(food.per100g.calories, 0)} cal ·{' '}
                  {fmt(netCarbs(food.per100g.total_carbs, food.per100g.fiber), 1)}g
                  net carbs / 100g
                </div>
              </div>
              <SourceBadge source={food.source} />
            </button>
          ))}
          {searched && !loading && results.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">
              No matches found. Try the Manual tab to enter values yourself.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barcode mode (Open Food Facts UPC lookup)
// ---------------------------------------------------------------------------
function BarcodeMode({ defaultMeal, onAdd }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [food, setFood] = useState(null)

  const run = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setFood(null)
    try {
      const result = await lookupBarcode(code)
      if (!result) {
        setError('No product found for that barcode. Try Manual entry.')
      } else {
        setFood(result)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={run} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter UPC / barcode number…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '…' : 'Look up'}
        </button>
      </form>
      {error && <p className="text-sm text-amber-700">{error}</p>}
      {food && (
        <PortionForm
          food={food}
          defaultMeal={defaultMeal}
          onAdd={(log) => {
            onAdd(log)
            setFood(null)
            setCode('')
          }}
          onCancel={() => setFood(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual mode — user enters values directly; flagged is_manual_entry.
// Values are entered PER PORTION (the amount actually eaten), so no scaling.
// ---------------------------------------------------------------------------
const EMPTY_MANUAL = {
  food_name: '',
  quantity_g: 100,
  calories: '',
  protein: '',
  fat: '',
  total_carbs: '',
  fiber: '',
  sugar: '',
  meal_type: 'breakfast',
}

function ManualMode({ defaultMeal, onAdd }) {
  const [form, setForm] = useState({ ...EMPTY_MANUAL, meal_type: defaultMeal })

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.food_name.trim()) return
    const total_carbs = Number(form.total_carbs) || 0
    const fiber = Number(form.fiber) || 0
    onAdd({
      meal_type: form.meal_type,
      food_name: form.food_name.trim(),
      source: 'manual',
      quantity_g: Number(form.quantity_g) || 0,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      fat: Number(form.fat) || 0,
      total_carbs,
      fiber,
      net_carbs: netCarbs(total_carbs, fiber),
      sugar: Number(form.sugar) || 0,
      is_manual_entry: true,
    })
    setForm({ ...EMPTY_MANUAL, meal_type: form.meal_type })
  }

  return (
    <form onSubmit={handleAdd} className="space-y-3">
      <p className="text-xs text-slate-500">
        Enter the values for the exact amount you ate. This item is flagged as
        user-entered.
      </p>
      <div>
        <label className="label">Food name</label>
        <input
          value={form.food_name}
          onChange={set('food_name')}
          className="input"
          placeholder="e.g. Homemade fat bomb"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ManualField label="Amount (g)" value={form.quantity_g} onChange={set('quantity_g')} />
        <ManualField label="Calories" value={form.calories} onChange={set('calories')} />
        <ManualField label="Protein (g)" value={form.protein} onChange={set('protein')} />
        <ManualField label="Fat (g)" value={form.fat} onChange={set('fat')} />
        <ManualField label="Total carbs (g)" value={form.total_carbs} onChange={set('total_carbs')} />
        <ManualField label="Fiber (g)" value={form.fiber} onChange={set('fiber')} />
        <ManualField label="Sugar (g)" value={form.sugar} onChange={set('sugar')} />
        <div>
          <label className="label">Meal</label>
          <select value={form.meal_type} onChange={set('meal_type')} className="input">
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full">
        Add manual entry
      </button>
    </form>
  )
}

function ManualField({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={onChange}
        className="input"
      />
    </div>
  )
}
