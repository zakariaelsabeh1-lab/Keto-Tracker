import { useEffect, useState } from 'react'
import {
  searchFoods,
  lookupBarcode,
  scaleToPortion,
  hasIncompleteData,
} from '../lib/nutrition'
import { fmt, MEAL_LABELS, MEAL_TYPES } from '../lib/format'
import { netCarbs } from '../lib/calculations'
import { toGrams, availableUnits, UNITS, isApproxConversion } from '../lib/units'
import { listCustomFoods, customToFood } from '../lib/customFoods'
import { useAuth } from '../context/AuthContext'

// Ways to add a food: saved custom foods, text search (USDA + OFF), barcode
// (OFF), or a one-off manual entry. Manual and custom are flagged user-entered.
const MODES = [
  { id: 'search', label: 'Search' },
  { id: 'saved', label: 'Saved' },
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
      {mode === 'saved' && (
        <SavedMode defaultMeal={defaultMeal} onAdd={onAdd} />
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
    custom: { label: 'Saved', cls: 'bg-keto-100 text-keto-800' },
  }
  const s = map[source] || map.manual
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Shared: once a food is selected, choose an amount + unit + meal and add it.
// The amount/unit is converted to grams and every nutrient is scaled from the
// food's per-100g values. Shows a live preview before adding.
// ---------------------------------------------------------------------------
function PortionForm({ food, defaultMeal, onAdd, onCancel }) {
  // Default to "1 serving" when we know a serving weight, else "100 g".
  const [amount, setAmount] = useState(food.servingSize ? 1 : 100)
  const [unit, setUnit] = useState(food.servingSize ? 'serving' : 'g')
  const [meal, setMeal] = useState(defaultMeal)

  const units = availableUnits(food)
  const grams = toGrams(amount, unit, {
    density: food.density ?? 1,
    serving_g: food.servingSize,
  })
  const approx = isApproxConversion(unit, food.density)
  const gramsValid = grams != null && grams > 0

  // All nutrients are scaled from the resolved grams — no guessing.
  const scaled = gramsValid ? scaleToPortion(food, grams) : null
  const incomplete = hasIncompleteData(food)

  const handleAdd = () => {
    if (!gramsValid) return
    onAdd({
      meal_type: meal,
      food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
      source: food.source,
      quantity_g: Math.round(grams * 10) / 10,
      ...scaled,
      // Custom (saved) and manual foods use user-entered nutrition data.
      is_manual_entry: food.source === 'manual' || food.source === 'custom',
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

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Amount</label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="input"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {UNITS[u].label}
              </option>
            ))}
          </select>
        </div>
        <div>
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

      {/* Resolved grams + honesty note about approximate volume conversions */}
      <p className="text-xs text-slate-400">
        {gramsValid ? `= ${fmt(grams, 1)} g` : 'Enter a valid amount'}
        {food.servingLabel && ` · serving: ${food.servingLabel}`}
        {approx && gramsValid && (
          <span className="text-amber-600">
            {' '}· ≈ approx (volume assumes water density)
          </span>
        )}
      </p>

      {/* Live preview of scaled nutrients for this exact portion */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <Preview label="Cal" value={scaled?.calories ?? 0} />
        <Preview label="Protein" value={scaled?.protein ?? 0} unit="g" />
        <Preview label="Fat" value={scaled?.fat ?? 0} unit="g" />
        <Preview label="Net carbs" value={scaled?.net_carbs ?? 0} unit="g" highlight />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!gramsValid}
          className="btn-primary flex-1"
        >
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
// Saved mode — pick from the user's own saved custom foods and log any amount.
// ---------------------------------------------------------------------------
function SavedMode({ defaultMeal, onAdd }) {
  const { user } = useAuth()
  const [foods, setFoods] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let active = true
    listCustomFoods(user.id)
      .then((rows) => active && setFoods(rows.map(customToFood)))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user.id])

  const visible = foods.filter((f) =>
    `${f.name} ${f.brand || ''}`.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) return <p className="text-sm text-slate-400">Loading saved foods…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-3">
      {foods.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved foods yet. Create reusable products on the{' '}
          <a href="/foods" className="text-keto-700 underline font-medium">
            My Foods
          </a>{' '}
          page.
        </p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Filter your saved foods…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input"
          />
          {selected ? (
            <PortionForm
              food={selected}
              defaultMeal={defaultMeal}
              onAdd={(log) => {
                onAdd(log)
                setSelected(null)
              }}
              onCancel={() => setSelected(null)}
            />
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {visible.map((food) => (
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
                  <SourceBadge source="custom" />
                </button>
              ))}
            </div>
          )}
        </>
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
