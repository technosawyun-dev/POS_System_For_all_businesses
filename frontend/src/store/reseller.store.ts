import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ResellerState {
  selectedTenantId: string | null
  selectedBranchId: string | null
  setSelectedTenant: (tenantId: string | null) => void
  setSelectedBranch: (branchId: string | null) => void
  clearReseller: () => void
}

export const useResellerStore = create<ResellerState>()(
  persist(
    (set) => ({
      selectedTenantId: null,
      selectedBranchId: null,

      setSelectedTenant: (tenantId) =>
        set({ selectedTenantId: tenantId, selectedBranchId: null }),

      setSelectedBranch: (branchId) =>
        set({ selectedBranchId: branchId }),

      clearReseller: () =>
        set({ selectedTenantId: null, selectedBranchId: null }),
    }),
    {
      name: 'nexuspos-reseller',
      partialize: (s) => ({
        selectedTenantId: s.selectedTenantId,
        selectedBranchId: s.selectedBranchId,
      }),
    },
  ),
)
