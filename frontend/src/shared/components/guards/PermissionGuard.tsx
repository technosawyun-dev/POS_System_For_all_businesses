import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { canAccess } from '@/shared/constants/rbac'

interface PermissionGuardProps {
  children: ReactNode
  section: string
  fallback?: ReactNode
}

export default function PermissionGuard({ children, section, fallback = null }: PermissionGuardProps) {
  const { user } = useAuthStore()

  if (!user) return <>{fallback}</>
  if (!canAccess(user.role, section)) return <>{fallback}</>

  return <>{children}</>
}
