import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { type ReactNode, useEffect } from 'react'
import { queryClient } from '@/lib/queryClient'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { tenantService } from '@/services/tenant/tenant.service'

const PING_INTERVAL_MS = 10_000
const PING_TIMEOUT_MS  = 5_000

async function pingServer(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
    const res = await fetch('/health', { method: 'GET', signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

function HealthPinger() {
  const { setOnline } = useUIStore()

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (cancelled) return
      const alive = await pingServer()
      if (cancelled) return
      setOnline(alive)

      // On every successful ping, process any queued sales (handles both
      // offline→online transitions and blink scenarios where we never
      // truly went "offline" but a checkout request failed mid-flight).
      if (alive) {
        try {
          const { getPendingSyncOps } = await import('@/offline/db')
          const pending = await getPendingSyncOps()
          if (pending.length > 0) {
            const { processSyncQueue } = await import('@/services/sync/syncService')
            await processSyncQueue()
          }
        } catch {
          // Sync check failed silently — will retry on next ping interval
        }
      }
    }

    check()
    const id = setInterval(check, PING_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
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
      <HealthPinger />
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
    </QueryClientProvider>
  )
}
