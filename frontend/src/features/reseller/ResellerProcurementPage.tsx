import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, fmt, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'
import type { PurchaseOrderSummary } from '@/shared/types'

function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">🛒</div>
      <div>
        <p className="text-zinc-200 font-semibold">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a business from the sidebar to view procurement.</p>
      </div>
    </div>
  )
}

function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <span className="text-4xl">🔒</span>
      <div>
        <p className="text-zinc-300 font-medium">No Procurement Access</p>
        <p className="text-zinc-600 text-sm mt-1">You do not have permission to view procurement for this business.</p>
      </div>
    </div>
  )
}

const PO_STATUS_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT:     'default',
  SUBMITTED: 'info',
  APPROVED:  'success',
  RECEIVED:  'success',
  CANCELLED: 'danger',
  PARTIAL:   'warning',
}

function ProcurementContent({ tenantId }: { tenantId: string }) {
  const perms = useResellerPermissions()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-procurement', tenantId, { page, status: statusFilter }],
    queryFn: () => procurementService.listOrders({
      page,
      page_size: 20,
      status: statusFilter || undefined,
      tenant_id: tenantId,
    } as never),
    enabled: perms.canViewProcurement(),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approveOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller-procurement'] })
      toast.success('Purchase order approved')
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Approval failed'),
  })

  const orders = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner size={28} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">No purchase orders found.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">PO Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  {perms.canApprovePO() && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-zinc-200 font-medium font-mono text-xs">{order.po_number}</p>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs font-mono">{order.supplier_id.slice(0, 12)}…</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">{fmtDate(order.created_at)}</td>
                    <td className="px-5 py-3 text-right text-zinc-200 tabular-nums font-medium">
                      {fmt(order.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={PO_STATUS_VARIANT[order.status] ?? 'default'} size="xs">
                        {order.status}
                      </Badge>
                    </td>
                    {perms.canApprovePO() && (
                      <td className="px-5 py-3 text-right">
                        {order.status === 'SUBMITTED' && (
                          <Btn
                            variant="success"
                            size="xs"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(order.id)}
                          >
                            Approve
                          </Btn>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{total} orders</span>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
                <Btn variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResellerProcurementPage() {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  const perms = useResellerPermissions()

  if (!selectedTenantId) return <NoBusiness />
  if (!perms.canViewProcurement()) return <PermissionDenied />

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Procurement</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {perms.canApprovePO() && <span className="text-orange-400">Approval enabled · </span>}
              {perms.canCreatePO() && <span className="text-orange-400">Create PO enabled</span>}
            </p>
          </div>
        </div>
      </div>
      <ProcurementContent tenantId={selectedTenantId} />
    </div>
  )
}
