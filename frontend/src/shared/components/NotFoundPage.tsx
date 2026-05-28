import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl font-black text-zinc-800 font-mono mb-4">404</p>
        <h1 className="text-xl font-bold text-zinc-100 mb-2">Page not found</h1>
        <p className="text-zinc-500 text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
        >
          Go back
        </button>
      </div>
    </div>
  )
}
