import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  isOnline: boolean
  posFocusMode: boolean

  toggleSidebar: () => void
  closeSidebar: () => void
  setOnline: (online: boolean) => void
  toggleOnline: () => void
  togglePosFocusMode: () => void
  setPosFocusMode: (on: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  isOnline: navigator.onLine,
  posFocusMode: false,

  toggleSidebar:     () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:      () => set({ sidebarOpen: false }),
  setOnline:         (isOnline) => set({ isOnline }),
  toggleOnline:      () => set(s => ({ isOnline: !s.isOnline })),
  togglePosFocusMode: () => set(s => ({ posFocusMode: !s.posFocusMode })),
  setPosFocusMode:   (on) => set({ posFocusMode: on }),
}))
