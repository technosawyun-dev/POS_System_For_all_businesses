import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { tokenStorage } from '@/app/lib/axios'
import type { UserRole } from '@/shared/types'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

export default function RoleGuard({ children, allowedRoles, redirectTo = '/login' }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()
  const hasToken = !!tokenStorage.getAccess()

  // No token and not authenticated
  if (!isAuthenticated && !hasToken) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Token exists but user is not loaded (should not happen in practice with persist,
  // but guards against a corrupted store state)
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Authenticated but role not allowed
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
