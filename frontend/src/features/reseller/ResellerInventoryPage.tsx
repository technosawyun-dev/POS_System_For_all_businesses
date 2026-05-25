import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmt } from '@/lib/utils'
import { Badge, Btn, Input, Spinner } from '@/components/ui'
import { inventoryService } from '@/services/inventory/inventory.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'

function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">📦</div>
      <div>
        <p className="text-zinc-200 font-semibold">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a business from the sidebar to view inventory.</p>
      </div>
    </div>
  )
}

function NoBranch() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl">🏪</div>
      <div>
        <p className="text-zinc-200 font-semibold">Select a Branch</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a branch from the sidebar to view inventory.</p>
      </div>
    </div>
  )
}

function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <span className="text-4xl">🔒</span>
      <div>
        <p className="text-zinc-300 font-medium">No Inventory Access</p>
        <p className="text-zinc-600 text-sm mt-1">You do not have permission to view inventory.</p>
      </div>
    </div>
  )
}

function InventoryContent({ branchId }: { branchId: string }) {
  const perms = useResellerPermissions()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-inventory', branchId, { search, page, lowStockOnly }],
    queryFn: () => inventoryService.getBranchInventory(branchId, {
      page,
      page_size: 20,
      low_stock: lowStockOnly || undefined,
    }),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  })

  const { data: valuation } = useQuery({
    queryKey: ['reseller-inventory', 'valuation', branchId],
    queryFn: () => inventoryService.getBranchValuation(branchId),
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 mb-1">Total SKUs</p>
          <p className="text-2xl font-bold text-zinc-100">{total}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 mb-1">Cost Value</p>
          <p className="text-2xl font-bold text-zinc-100 tabular-nums">{fmt((valuation as {total_cost_value?: number} | undefined)?.total_cost_value)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 mb-1">Retail Value</p>
          <p className="text-2xl font-bold text-zinc-100 tabular-nums">{fmt((valuation as {total_retail_value?: number} | undefined)?.total_retail_value)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 mb-1">Low Stock</p>
          <p className="text-2xl font-bold text-red-400">{(valuation as {low_stock_count?: number} | undefined)?.low_stock_count ?? 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Filter products…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <button
          onClick={() => { setLowStockOnly(v => !v); setPage(1) }}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            lowStockOnly
              ? 'bg-red-950 border-red-800 text-red-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          {lowStockOnly ? '⚠ Low Stock Only' : 'All Items'}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">No inventory items found.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cost Price</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Retail Value</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  {perms.canAdjustInventory() && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {items.map(item => {
                  const qty = Number(item.quantity_on_hand ?? 0)
                  const reorderPt = item.reorder_point ?? 0
                  const isLow = qty > 0 && qty <= reorderPt
                  const isOut = qty <= 0
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-zinc-200 font-medium font-mono text-xs">{item.product_id.slice(0, 16)}…</p>
                        <p className="text-zinc-600 text-xs">{item.branch_id.slice(0, 12)}…</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={isOut ? 'text-red-400 font-bold' : isLow ? 'text-amber-400 font-medium' : 'text-zinc-200'}>
                          {qty}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-400">—</td>
                      <td className="px-5 py-3 text-right text-zinc-400 tabular-nums">—</td>
                      <td className="px-5 py-3 text-center">
                        <Badge
                          variant={isOut ? 'danger' : isLow ? 'warning' : 'success'}
                          size="xs"
                          dot
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </td>
                      {perms.canAdjustInventory() && (
                        <td className="px-5 py-3 text-right">
                          <Btn variant="ghost" size="xs">Adjust</Btn>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{total} items</span>
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

export default function ResellerInventoryPage() {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  const selectedBranchId = useResellerStore(s => s.selectedBranchId)
  const perms = useResellerPermissions()

  if (!selectedTenantId) return <NoBusiness />
  if (!perms.canViewInventory()) return <PermissionDenied />
  if (!selectedBranchId) return <NoBranch />

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Inventory</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Branch {selectedBranchId.slice(0, 12)}…
          {perms.canAdjustInventory() && (
            <span className="ml-2 text-orange-400 text-xs">(Adjust allowed)</span>
          )}
        </p>
      </div>
      <InventoryContent branchId={selectedBranchId} />
    </div>
  )
}
