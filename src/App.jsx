import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Weight from './pages/Weight'
import MyFoods from './pages/MyFoods'
import { isSupabaseConfigured } from './lib/supabase'

export default function App() {
  const { user, loading } = useAuth()

  // Friendly banner if the app was deployed without Supabase env vars.
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-lg p-6 space-y-3">
          <h1 className="text-xl font-semibold text-keto-800">
            Keto Tracker needs configuration
          </h1>
          <p className="text-sm text-slate-600">
            Supabase environment variables are missing. Copy{' '}
            <code className="bg-slate-100 px-1 rounded">.env.example</code> to{' '}
            <code className="bg-slate-100 px-1 rounded">.env</code> and set{' '}
            <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code>{' '}
            and{' '}
            <code className="bg-slate-100 px-1 rounded">
              VITE_SUPABASE_ANON_KEY
            </code>
            , then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {user && <Navbar />}
      <Routes>
        {/* Public auth routes */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/" replace /> : <Signup />}
        />

        {/* Protected app routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/weight"
          element={
            <ProtectedRoute>
              <Weight />
            </ProtectedRoute>
          }
        />
        <Route
          path="/foods"
          element={
            <ProtectedRoute>
              <MyFoods />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
