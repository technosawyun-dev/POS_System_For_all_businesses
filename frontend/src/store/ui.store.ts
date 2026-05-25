import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  isOnline: boolean

  toggleSidebar: () => void
  closeSidebar: () => void
  setOnline: (online: boolean) => void
  toggleOnline: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  isOnline: navigator.onLine,

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),
  setOnline:     (isOnline) => set({ isOnline }),
  toggleOnline:  () => set(s => ({ isOnline: !s.isOnline })),
}))
