import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CashierSession } from '@/shared/types'

interface SessionState {
  activeSession: CashierSession | null
  setActiveSession: (session: CashierSession | null) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeSession: null,
      setActiveSession: (activeSession) => set({ activeSession }),
      clearSession: () => set({ activeSession: null }),
    }),
    { name: 'nexuspos-session' },
  ),
)
