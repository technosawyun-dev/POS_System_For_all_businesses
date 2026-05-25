import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { ROLE_HOME } from '@/shared/constants/rbac'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  function goHome() {
    const home = user ? (ROLE_HOME[user.role] ?? '/app/pos') : '/login'
    navigate(home)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 bg-zinc-950">
      <div className="w-16 h-16 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center mb-4">
        <span className="text-2xl">🔒</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Access Denied</h1>
      <p className="text-zinc-500 text-sm mb-6 max-w-sm">
        You don't have permission to access this page.
      </p>
      <button
        onClick={goHome}
        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-colors"
      >
        Go to my dashboard
      </button>
    </div>
  )
}
