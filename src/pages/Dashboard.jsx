import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DaySummary from '../components/DaySummary'
import FoodSearch from '../components/FoodSearch'
import FoodLogItem from '../components/FoodLogItem'
import { todayISO, MEAL_TYPES, MEAL_LABELS } from '../lib/format'

const EMPTY_TOTALS = {
  calories: 0,
  protein: 0,
  fat: 0,
  total_carbs: 0,
  fiber: 0,
  net_carbs: 0,
  sugar: 0,
}

export default function Dashboard() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [logs, setLogs] = useState([])
  const [targets, setTargets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load the profile targets once.
  useEffect(() => {
    supabase
      .from('profiles')
      .select('calorie_target, protein_target, fat_target, net_carb_limit')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setTargets(data))
  }, [user.id])

  // Load this date's logs whenever the date changes.
  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        setLogs(data || [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id, date])

  // Sum every nutrient across the day.
  const totals = useMemo(() => {
    return logs.reduce((acc, l) => {
      for (const k of Object.keys(EMPTY_TOTALS)) acc[k] += Number(l[k]) || 0
      return acc
    }, { ...EMPTY_TOTALS })
  }, [logs])

  const byMeal = useMemo(() => {
    const groups = Object.fromEntries(MEAL_TYPES.map((m) => [m, []]))
    for (const l of logs) (groups[l.meal_type] ||= []).push(l)
    return groups
  }, [logs])

  const addFood = async (entry) => {
    setError('')
    const row = { ...entry, user_id: user.id, date }
    const { data, error } = await supabase
      .from('food_logs')
      .insert(row)
      .select()
      .single()
    if (error) setError(error.message)
    else setLogs((prev) => [...prev, data])
  }

  const updateFood = async (id, patch) => {
    const { data, error } = await supabase
      .from('food_logs')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) setError(error.message)
    else setLogs((prev) => prev.map((l) => (l.id === id ? data : l)))
  }

  const removeFood = async (id) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id)
    if (error) setError(error.message)
    else setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Date picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Daily log</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input w-auto"
          />
          {date !== todayISO() && (
            <button onClick={() => setDate(todayISO())} className="btn-ghost text-sm">
              Today
            </button>
          )}
        </div>
      </div>

      {!targets && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set up your <a href="/profile" className="underline font-medium">profile</a>{' '}
          to see calorie and macro targets.
        </p>
      )}

      <DaySummary totals={totals} targets={targets} />

      <FoodSearch onAdd={addFood} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Logged foods grouped by meal */}
      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-center text-slate-400 py-6">
          No foods logged yet for this day.
        </p>
      ) : (
        MEAL_TYPES.filter((m) => byMeal[m].length > 0).map((meal) => (
          <div key={meal} className="card p-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-1">
              {MEAL_LABELS[meal]}
            </h2>
            <div className="divide-y divide-slate-100">
              {byMeal[meal].map((item) => (
                <FoodLogItem
                  key={item.id}
                  item={item}
                  onUpdate={updateFood}
                  onRemove={removeFood}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
