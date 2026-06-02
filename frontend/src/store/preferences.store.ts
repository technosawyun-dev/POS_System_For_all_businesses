import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TimeFormat = '12h' | '24h'

interface PreferencesState {
  timeFormat: TimeFormat
  setTimeFormat: (fmt: TimeFormat) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      timeFormat: '12h' as TimeFormat,
      setTimeFormat: (timeFormat) => set({ timeFormat }),
    }),
    { name: 'nexuspos-prefs' },
  ),
)
