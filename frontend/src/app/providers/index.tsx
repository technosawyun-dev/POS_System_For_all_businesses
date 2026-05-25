import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { type ReactNode, useEffect } from 'react'
import { queryClient } from '@/lib/queryClient'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { tenantService } from '@/services/tenant/tenant.service'

function OnlineDetector() {
  const { setOnline } = useUIStore()
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setOnline])
  return null
}

// Loads the authenticated user's branches into tenant store.
// Uses the same query key as branch management pages so that creating/editing
// a branch automatically refreshes availableBranches via cache invalidation.
function TenantLoader() {
  const { user, isAuthenticated } = useAuthStore()
  const { setAvailableBranches, setSelectedBranch, selectedBranch } = useTenantStore()

  const { data } = useQuery({
    queryKey: ['tenant', user?.tenant_id, 'branches'],
    queryFn: () => tenantService.getBranches(user!.tenant_id!, { page_size: 100 }),
    enabled: isAuthenticated && !!user?.tenant_id,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!data) return
    const branches = data.items
      .filter(b => b.status === 'ACTIVE')
      .map(b => ({ id: b.id, name: b.name, code: b.code }))
    setAvailableBranches(branches)
    // Auto-select primary branch if nothing chosen yet, or if stored branch was removed
    const stored = selectedBranch
    const stillExists = stored && branches.some(b => b.id === stored.id)
    if (!stillExists && branches.length > 0) {
      const primary = branches.find(b => b.id === user?.primary_branch_id) ?? branches[0]
      setSelectedBranch(primary)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <OnlineDetector />
      <TenantLoader />
      {children}
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: {
            background: '#18181B',
            border: '1px solid #3F3F46',
            color: '#E4E4E7',
            fontSize: '13px',
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
