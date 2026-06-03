import { create } from 'zustand'

interface SubscriptionStore {
  isExpiredOrSuspended: boolean
  markExpired: () => void
  clearExpired: () => void
}

export const useSubscriptionStore = create<SubscriptionStore>(set => ({
  isExpiredOrSuspended: false,
  markExpired: () => set({ isExpiredOrSuspended: true }),
  clearExpired: () => set({ isExpiredOrSuspended: false }),
}))
