import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { devicesService } from '@/services/devices/devices.service'
import { tenantService } from '@/services/tenant/tenant.service'

const PLATFORM_LABELS: Record<string, string> = {
  WEB: 'Web', ANDROID: 'Android', IOS: 'iOS',
  WINDOWS: 'Windows', MACOS: 'macOS', LINUX: 'Linux',
}

export default function DevicesPage() {
  const qc = useQueryClient()
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [applied, setApplied] = useState(false)

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants', 'all'],
    queryFn: () => tenantService.listTenants({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['tenant', selectedTenantId, 'branches'],
    queryFn: () => tenantService.getBranches(selectedTenantId, { page: 1, page_size: 100 }),
    enabled: !!selectedTenantId,
    staleTime: 60_000,
  })

  const devicesQuery = useQuery({
    queryKey: ['admin', 'devices', selectedTenantId, selectedBranchId],
    queryFn: () => devicesService.list({
      tenant_id: selectedTenantId || undefined,
      branch_id: selectedBranchId || undefined,
      page: 1,
      page_size: 100,
    }),
    enabled: applied && !!selectedTenantId,
    retry: false,
  })

  const deactivateMutation = useMutation({
    mutationFn: (deviceId: string) => devicesService.deactivate(deviceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'devices'] })
      toast.success('Device deactivated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const tenants = tenantsQuery.data?.items ?? []
  const branches = branchesQuery.data?.items ?? []

  function handleTenantChange(tenantId: string) {
    setSelectedTenantId(tenantId)
    setSelectedBranchId('')
    setApplied(false)
  }

  function load() {
    if (!selectedTenantId) {
      toast.error('Please select a business first')
      return
    }
    setApplied(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Devices</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Registered POS devices by business</p>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedTenantId}
            onChange={e => handleTenantChange(e.target.value)}
            className="flex-1 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">Select a business…</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedTenantId && (
            <select
              value={selectedBranchId}
              onChange={e => { setSelectedBranchId(e.target.value); setApplied(false) }}
              className="flex-1 min-w-[150px] bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">All branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <Btn size="sm" onClick={load} disabled={!selectedTenantId}>Load</Btn>
          {applied && (
            <Btn variant="secondary" size="sm" onClick={() => { setApplied(false); setSelectedBranchId('') }}>
              Clear
            </Btn>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!selectedTenantId ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-zinc-500 text-sm">Select a business above to view its registered devices.</p>
          </div>
        ) : !applied ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-zinc-500 text-sm">Click Load to fetch devices.</p>
          </div>
        ) : devicesQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : devicesQuery.error ? (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">Failed to load devices for this business.</p>
          </div>
        ) : (devicesQuery.data?.items ?? []).length === 0 ? (
          <Empty title="No devices found" />
        ) : (
          <div className="max-w-4xl space-y-2">
            {(devicesQuery.data?.items ?? []).map(device => (
              <div key={device.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-100">{device.device_name}</p>
                    <Badge variant={device.is_active ? 'success' : 'default'} size="xs">
                      {device.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="default" size="xs">{PLATFORM_LABELS[device.platform] ?? device.platform}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 font-mono">{device.device_uuid}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {device.app_version && `v${device.app_version} · `}
                    Last seen: {device.last_seen_at ? fmtDate(device.last_seen_at) : 'Never'}
                    {' · '}Registered {fmtDate(device.created_at)}
                  </p>
                </div>
                {device.is_active && (
                  <Btn
                    variant="secondary"
                    size="xs"
                    disabled={deactivateMutation.isPending}
                    onClick={() => confirm(`Deactivate device ${device.device_name}?`) && deactivateMutation.mutate(device.id)}
                  >
                    Deactivate
                  </Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
