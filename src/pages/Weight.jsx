import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { todayISO, fmt } from '../lib/format'

export default function Weight() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    if (error) setError(error.message)
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    const kg = Number(weight)
    if (!kg || kg <= 0) return
    // One reading per date: upsert on the (user_id, date) unique constraint.
    const { error } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, date, weight_kg: kg },
        { onConflict: 'user_id,date' }
      )
    if (error) {
      setError(error.message)
      return
    }
    setWeight('')
    load()
  }

  const removeEntry = async (id) => {
    const { error } = await supabase.from('weight_logs').delete().eq('id', id)
    if (error) setError(error.message)
    else setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const chartData = useMemo(
    () =>
      entries.map((e) => ({
        date: e.date,
        label: format(parseISO(e.date), 'MMM d'),
        weight_kg: Number(e.weight_kg),
      })),
    [entries]
  )

  const latest = entries[entries.length - 1]
  const first = entries[0]
  const change =
    latest && first ? Number(latest.weight_kg) - Number(first.weight_kg) : null

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Weight tracking</h1>

      {/* Log form */}
      <form onSubmit={handleSave} className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input w-auto"
          />
        </div>
        <div>
          <label className="label">Weight (kg)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="input w-32"
            placeholder="e.g. 82.4"
          />
        </div>
        <button type="submit" className="btn-primary">
          Log weight
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Summary + chart */}
      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-slate-400 py-6">
          No weight entries yet. Log your first weigh-in above.
        </p>
      ) : (
        <>
          <div className="card p-4">
            <div className="flex justify-around text-center mb-3">
              <Stat label="Latest" value={`${fmt(latest.weight_kg, 1)} kg`} />
              <Stat
                label="Change"
                value={`${change > 0 ? '+' : ''}${fmt(change, 1)} kg`}
                color={change < 0 ? 'text-keto-700' : change > 0 ? 'text-red-600' : ''}
              />
              <Stat label="Entries" value={entries.length} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(1)} kg`, 'Weight']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight_kg"
                    stroke="#047857"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#047857' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History list */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-1">History</h2>
            <div className="divide-y divide-slate-100">
              {[...entries].reverse().map((e) => (
                <div key={e.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm text-slate-700">
                    {format(parseISO(e.date), 'EEE, MMM d yyyy')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-800">
                      {fmt(e.weight_kg, 1)} kg
                    </span>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="text-slate-300 hover:text-red-500 text-sm"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color = '' }) {
  return (
    <div>
      <div className={`text-lg font-bold text-slate-800 ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
