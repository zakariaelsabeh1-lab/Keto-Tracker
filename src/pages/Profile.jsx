import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  calculateTargets,
  ACTIVITY_LABELS,
  GOAL_LABELS,
} from '../lib/calculations'
import { fmt } from '../lib/format'

// Blank starting form; numbers kept as strings for controlled inputs.
const EMPTY = {
  weight_kg: '',
  height_cm: '',
  age: '',
  sex: 'male',
  activity_level: 'moderate',
  goal: 'lose_fat',
  protein_target: '',
  net_carb_limit: '25',
}

export default function Profile() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Load existing profile once.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) setError(error.message)
      if (data) {
        setForm({
          weight_kg: data.weight_kg ?? '',
          height_cm: data.height_cm ?? '',
          age: data.age ?? '',
          sex: data.sex ?? 'male',
          activity_level: data.activity_level ?? 'moderate',
          goal: data.goal ?? 'lose_fat',
          protein_target: data.protein_target ?? '',
          net_carb_limit: data.net_carb_limit ?? '25',
        })
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [user.id])

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setSaved(false)
  }

  // Compute a live preview of targets whenever inputs are complete.
  const canCompute =
    form.weight_kg && form.height_cm && form.age && form.sex && form.activity_level
  const preview = canCompute
    ? calculateTargets(
        {
          weight_kg: Number(form.weight_kg),
          height_cm: Number(form.height_cm),
          age: Number(form.age),
          sex: form.sex,
          activity_level: form.activity_level,
          goal: form.goal,
        },
        {
          protein_target: form.protein_target || null,
          net_carb_limit: form.net_carb_limit || null,
        }
      )
    : null

  const handleSave = async (e) => {
    e.preventDefault()
    if (!preview) {
      setError('Please fill in weight, height, age, sex and activity level.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      user_id: user.id,
      weight_kg: Number(form.weight_kg),
      height_cm: Number(form.height_cm),
      age: Number(form.age),
      sex: form.sex,
      activity_level: form.activity_level,
      goal: form.goal,
      ...preview, // calorie_target, protein_target, fat_target, net_carb_limit
    }
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
    setSaving(false)
    if (error) setError(error.message)
    else setSaved(true)
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Loading profile…</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Profile &amp; targets</h1>

      <form onSubmit={handleSave} className="card p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Weight (kg)">
            <input type="number" step="any" min="0" value={form.weight_kg} onChange={set('weight_kg')} className="input" />
          </Field>
          <Field label="Height (cm)">
            <input type="number" step="any" min="0" value={form.height_cm} onChange={set('height_cm')} className="input" />
          </Field>
          <Field label="Age">
            <input type="number" min="0" value={form.age} onChange={set('age')} className="input" />
          </Field>
          <Field label="Sex">
            <select value={form.sex} onChange={set('sex')} className="input">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Goal">
            <select value={form.goal} onChange={set('goal')} className="input">
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Activity level">
          <select value={form.activity_level} onChange={set('activity_level')} className="input">
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-600 mb-2">
            Keto macro overrides
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein target (g) — optional">
              <input
                type="number"
                min="0"
                value={form.protein_target}
                onChange={set('protein_target')}
                className="input"
                placeholder="auto (1.6 g/kg)"
              />
            </Field>
            <Field label="Net carb limit (g)">
              <input
                type="number"
                min="0"
                value={form.net_carb_limit}
                onChange={set('net_carb_limit')}
                className="input"
              />
            </Field>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fat fills the remaining calories automatically (classic high-fat keto
            split).
          </p>
        </div>

        {/* Live computed targets */}
        {preview && (
          <div className="bg-keto-50 border border-keto-200 rounded-lg p-3">
            <p className="text-xs text-keto-800 font-medium mb-2">
              Your calculated daily targets
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Target label="Calories" value={fmt(preview.calorie_target)} />
              <Target label="Protein" value={`${fmt(preview.protein_target)}g`} />
              <Target label="Fat" value={`${fmt(preview.fat_target)}g`} />
              <Target label="Net carbs" value={`${fmt(preview.net_carb_limit)}g`} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {saved && <span className="text-sm text-keto-700">✓ Saved</span>}
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Target({ label, value }) {
  return (
    <div>
      <div className="text-lg font-bold text-keto-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
