import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { ROLE_HOME } from '@/shared/constants/rbac'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { user, isAuthenticated } = useAuthStore()

  // Already authenticated — redirect to role home
  if (isAuthenticated && user) {
    const home = ROLE_HOME[user.role] ?? '/app/pos'
    return <Navigate to={home} replace />
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#09090B' }}>
      {/* Grid pattern background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(217,119,6,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217,119,6,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Center content, but allow scroll when content is taller than viewport */}
      <div className="relative min-h-full flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
