import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RecentItemType = 'customer' | 'product' | 'purchase_order' | 'supplier'
export type FavoriteItemType = 'customer' | 'product' | 'report' | 'page'

export interface RecentItem {
  type: RecentItemType
  id: string
  label: string
  sub?: string
  path: string
  viewedAt: string
}

export interface FavoriteItem {
  type: FavoriteItemType
  id: string
  label: string
  sub?: string
  path: string
  pinnedAt: string
}

interface WorkspaceState {
  recentItems: RecentItem[]
  favorites: FavoriteItem[]
  addRecent: (item: Omit<RecentItem, 'viewedAt'>) => void
  clearRecent: () => void
  addFavorite: (item: Omit<FavoriteItem, 'pinnedAt'>) => void
  removeFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      recentItems: [],
      favorites: [],

      addRecent: (item) =>
        set(s => ({
          recentItems: [
            { ...item, viewedAt: new Date().toISOString() },
            ...s.recentItems.filter(i => !(i.id === item.id && i.type === item.type)),
          ].slice(0, 20),
        })),

      clearRecent: () => set({ recentItems: [] }),

      addFavorite: (item) =>
        set(s => ({
          favorites: [
            ...s.favorites.filter(i => i.id !== item.id),
            { ...item, pinnedAt: new Date().toISOString() },
          ],
        })),

      removeFavorite: (id) =>
        set(s => ({ favorites: s.favorites.filter(i => i.id !== id) })),

      isFavorite: (id) => get().favorites.some(i => i.id === id),
    }),
    { name: 'nexuspos-workspace' },
  ),
)
