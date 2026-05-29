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
  const e = err as {
    code?: string
    response?: { status?: number; data?: { error?: { message?: string; code?: string }; detail?: string } }
    message?: string
  }

  // Network / timeout
  if (e.code === 'ECONNABORTED' || e.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.'
  }
  if (!e.response) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }

  const serverMsg = e.response.data?.error?.message ?? e.response.data?.detail ?? ''

  // Map raw backend messages to human-readable copy
  const lower = serverMsg.toLowerCase()
  if (lower.includes('invalid credentials') || lower.includes('invalid credential')) {
    return 'The email/phone or password you entered is incorrect. Please try again.'
  }
  if (lower.includes('user not found') || lower.includes('no account')) {
    return 'No account found with those details. Please check and try again, or register a new account.'
  }
  if (lower.includes('suspended')) {
    return 'This account has been suspended. Please contact support for help.'
  }
  if (lower.includes('inactive') || lower.includes('not active')) {
    return 'This account is no longer active. Please contact your administrator.'
  }
  if (lower.includes('business code') || lower.includes('tenant not found')) {
    return 'Business code not found. Please check the code given to you by your business owner.'
  }
  if (lower.includes('locked') || lower.includes('too many')) {
    return 'Too many failed attempts. Please wait a few minutes before trying again.'
  }

  // Fall back to the raw server message if it exists, otherwise generic
  return serverMsg || 'Something went wrong. Please try again.'
}
