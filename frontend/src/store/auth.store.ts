import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tokenStorage } from '@/app/lib/axios'
import { authService } from '@/services/auth/auth.service'
import { queryClient } from '@/lib/queryClient'
import { useSessionStore } from '@/store/session.store'
import { useTenantStore } from '@/store/tenant.store'
import type { User, LoginRequest } from '@/shared/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (creds: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  clearError: () => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (creds) => {
        set({ isLoading: true, error: null })
        try {
          const tokens = await authService.login(creds)
          tokenStorage.setTokens(tokens.access_token, tokens.refresh_token)
          const user = await authService.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (err: unknown) {
          const message = extractErrorMessage(err) ?? 'Login failed'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      logout: async () => {
        const refreshToken = tokenStorage.getRefresh()
        try {
          if (refreshToken) {
            await authService.logout({ refresh_token: refreshToken })
          }
        } catch {
          // logout best-effort
        } finally {
          tokenStorage.clear()
          set({ user: null, isAuthenticated: false, error: null })
          // Clear all cross-user state so the next login gets a clean slate
          queryClient.clear()
          useSessionStore.getState().clearSession()
          useTenantStore.getState().clearTenant()
        }
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const user = await authService.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          tokenStorage.clear()
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'nexuspos-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)

function extractErrorMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { response?: { data?: { error?: { message?: string }; detail?: string } }; message?: string }
  return (
    e.response?.data?.error?.message ??
    e.response?.data?.detail ??
    e.message ??
    null
  )
}
