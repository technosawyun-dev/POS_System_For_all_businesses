import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Branch {
  id: string
  name: string
  code: string
}

interface Business {
  id: string
  name: string
  slug: string
}

interface TenantState {
  selectedBusiness: Business | null
  selectedBranch: Branch | null
  availableBusinesses: Business[]
  availableBranches: Branch[]

  setSelectedBusiness: (business: Business | null) => void
  setSelectedBranch: (branch: Branch | null) => void
  setAvailableBusinesses: (businesses: Business[]) => void
  setAvailableBranches: (branches: Branch[]) => void
  clearTenant: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      selectedBusiness: null,
      selectedBranch: null,
      availableBusinesses: [],
      availableBranches: [],

      setSelectedBusiness: (selectedBusiness) => set({ selectedBusiness, selectedBranch: null }),
      setSelectedBranch:   (selectedBranch) => set({ selectedBranch }),
      setAvailableBusinesses: (availableBusinesses) => set({ availableBusinesses }),
      setAvailableBranches:   (availableBranches) => set({ availableBranches }),
      clearTenant: () => set({
        selectedBusiness: null,
        selectedBranch: null,
        availableBusinesses: [],
        availableBranches: [],
      }),
    }),
    {
      name: 'nexuspos-tenant',
      partialize: (s) => ({
        selectedBusiness: s.selectedBusiness,
        selectedBranch: s.selectedBranch,
      }),
    },
  ),
)
