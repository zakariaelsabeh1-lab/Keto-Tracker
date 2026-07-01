import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-keto-100 text-keto-800'
        : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-bold text-keto-800 mr-3">🥑 Keto Tracker</span>
          <NavLink to="/" className={linkClass} end>
            Today
          </NavLink>
          <NavLink to="/foods" className={linkClass}>
            My Foods
          </NavLink>
          <NavLink to="/weight" className={linkClass}>
            Weight
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            Profile
          </NavLink>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400">
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="btn-ghost text-sm">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
