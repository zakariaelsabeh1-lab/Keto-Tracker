import { createClient } from '@supabase/supabase-js'

// Supabase connection details come from environment variables so no secrets
// are committed. See .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Surface a clear message during development if the app isn't configured yet,
// rather than failing with a cryptic error deep inside a request.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Keto Tracker] Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

// A single shared client for the whole app. Falls back to harmless placeholder
// values when unconfigured so imports don't throw at module load time.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
