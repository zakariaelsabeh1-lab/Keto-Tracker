import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listCustomFoods,
  createCustomFood,
  updateCustomFood,
  deleteCustomFood,
  toPer100g,
} from '../lib/customFoods'
import { fmt } from '../lib/format'
import { netCarbs } from '../lib/calculations'

// A blank form. Nutrition is entered for a chosen reference amount (matching
// how nutrition labels read, e.g. "per 30 g"), then normalised to per-100g.
const EMPTY = {
  name: '',
  brand: '',
  reference_g: 100,
  calories: '',
  protein: '',
  fat: '',
  total_carbs: '',
  fiber: '',
  sugar: '',
  serving_g: '',
  density_g_per_ml: '',
}

export default function MyFoods() {
  const { user } = useAuth()
  const [foods, setFoods] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setFoods(await listCustomFoods(user.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const resetForm = () => {
    setForm(EMPTY)
    setEditingId(null)
    setError('')
  }

  const startEdit = (cf) => {
    // Existing values are stored per 100 g, so show them with reference = 100.
    setForm({
      name: cf.name,
      brand: cf.brand || '',
      reference_g: 100,
      calories: cf.calories,
      protein: cf.protein,
      fat: cf.fat,
      total_carbs: cf.total_carbs,
      fiber: cf.fiber,
      sugar: cf.sugar,
      serving_g: cf.serving_g ?? '',
      density_g_per_ml: cf.density_g_per_ml ?? '',
    })
    setEditingId(cf.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Please enter a name.')
      return
    }
    setSaving(true)
    setError('')
    // Convert the entered values (for reference_g grams) into per-100g values.
    const per100g = toPer100g(form, form.reference_g)
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      ...per100g,
      serving_g: form.serving_g === '' ? null : Number(form.serving_g),
      density_g_per_ml:
        form.density_g_per_ml === '' ? null : Number(form.density_g_per_ml),
    }
    try {
      if (editingId) await updateCustomFood(editingId, payload)
      else await createCustomFood(user.id, payload)
      resetForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this saved food?')) return
    try {
      await deleteCustomFood(id)
      if (editingId === id) resetForm()
      setFoods((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">My Foods</h1>
      <p className="text-sm text-slate-500">
        Save products you use often. Enter the nutrition once and reuse it from
        the <strong>Saved</strong> tab when logging — the app scales it to
        whatever amount and unit you pick.
      </p>

      {/* Create / edit form */}
      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">
            {editingId ? 'Edit food' : 'Add a food'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-ghost text-xs">
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Name">
            <input value={form.name} onChange={set('name')} className="input"
              placeholder="e.g. My peanut butter" />
          </Field>
          <Field label="Brand (optional)">
            <input value={form.brand} onChange={set('brand')} className="input" />
          </Field>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-slate-500">
            Enter the values exactly as they appear on the label, and set the
            amount they refer to:
          </p>
          <Field label="Values are per (grams)">
            <input type="number" min="1" step="any" value={form.reference_g}
              onChange={set('reference_g')} className="input w-32" />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <NumField label="Calories" value={form.calories} onChange={set('calories')} />
            <NumField label="Protein (g)" value={form.protein} onChange={set('protein')} />
            <NumField label="Fat (g)" value={form.fat} onChange={set('fat')} />
            <NumField label="Total carbs (g)" value={form.total_carbs} onChange={set('total_carbs')} />
            <NumField label="Fiber (g)" value={form.fiber} onChange={set('fiber')} />
            <NumField label="Sugar (g)" value={form.sugar} onChange={set('sugar')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Serving weight (g, optional)">
            <input type="number" min="0" step="any" value={form.serving_g}
              onChange={set('serving_g')} className="input"
              placeholder="e.g. 32 (enables 'serving' unit)" />
          </Field>
          <Field label="Density (g/ml, optional)">
            <input type="number" min="0" step="any" value={form.density_g_per_ml}
              onChange={set('density_g_per_ml')} className="input"
              placeholder="for exact tsp/tbsp/cup" />
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Density makes teaspoon/tablespoon/cup conversions exact for this
          product (e.g. oil ≈ 0.92, honey ≈ 1.42). Leave blank to use an
          approximate water-based conversion.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : editingId ? 'Update food' : 'Save food'}
        </button>
      </form>

      {/* Saved list */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-1">
          Saved foods ({foods.length})
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400 py-3">Loading…</p>
        ) : foods.length === 0 ? (
          <p className="text-sm text-slate-400 py-3">Nothing saved yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {foods.map((cf) => (
              <div key={cf.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-800 truncate">
                    {cf.name}
                    {cf.brand && (
                      <span className="text-slate-400"> · {cf.brand}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    per 100g: {fmt(cf.calories)} cal · {fmt(cf.protein, 1)}p ·{' '}
                    {fmt(cf.fat, 1)}f ·{' '}
                    <span className="text-keto-700">
                      {fmt(netCarbs(cf.total_carbs, cf.fiber), 1)}g net carbs
                    </span>
                    {cf.serving_g ? ` · serving ${fmt(cf.serving_g)}g` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(cf)}
                    className="text-xs text-slate-500 hover:text-keto-700">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(cf.id)}
                    className="text-slate-300 hover:text-red-500 text-sm" title="Delete">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function NumField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input type="number" min="0" step="any" value={value} onChange={onChange}
        className="input" />
    </Field>
  )
}
