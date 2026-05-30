import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant.store'
import { inventoryService } from '@/services/inventory/inventory.service'
import { productsService } from '@/services/products/products.service'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td, Btn, Empty, Spinner } from '@/components/ui'
import { IconInventory, IconSearch } from '@/components/icons'
import StockBar from '@/features/inventory/StockBar'
import AdjustmentModal from '@/features/inventory/AdjustmentModal'
import StockHistoryModal from '@/features/inventory/StockHistoryModal'
import type { InventoryItem } from '@/shared/types'

export default function InventoryScreen() {
  const { selectedBranch, availableBranches } = useTenantStore()
  const [search, setSearch]               = useState('')
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const [historyItem, setHistoryItem]     = useState<InventoryItem | null>(null)
  const [stockSort, setStockSort]         = useState<'asc' | 'desc'>('asc')

  // Inventory is a management view — always follows the globally selected branch.
  // The POS cashier session is irrelevant here (that's operational, not reporting).
  const branchId   = selectedBranch?.id ?? ''
  const branchName = availableBranches.find(b => b.id === branchId)?.name ?? selectedBranch?.name ?? null

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn:  () => inventoryService.getBranchInventory(branchId, { page_size: 500 }),
    enabled:  !!branchId,
    staleTime: 0,
    refetchInterval: 30_000,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn:  () => productsService.list({ page_size: 500, is_active: true }),
    staleTime: 5 * 60 * 1000,
  })

  const productMap = useMemo(() => {
    const m = new Map<string, { name: string; sku: string }>()
    for (const p of productsData?.items ?? []) {
      m.set(p.id, { name: p.name, sku: p.sku })
    }
    return m
  }, [productsData])

  const items = data?.items ?? []

  const filtered = items
    .filter(item => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const product = productMap.get(item.product_id)
      return (
        (product?.name ?? '').toLowerCase().includes(q) ||
        (product?.sku ?? '').toLowerCase().includes(q) ||
        item.product_id.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const diff = parseFloat(a.quantity_available) - parseFloat(b.quantity_available)
      return stockSort === 'asc' ? diff : -diff
    })

  const outOfStock  = items.filter(i => parseFloat(i.quantity_on_hand) === 0).length
  const lowStock    = items.filter(i => {
    const qty = parseFloat(i.quantity_on_hand)
    return i.reorder_point != null && qty > 0 && qty <= i.reorder_point
  }).length
  const totalValue  = items.reduce((s, i) => s + parseFloat(i.quantity_on_hand), 0)

  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3 p-6">
        <IconInventory width="48" height="48" className="text-zinc-700" />
        <p className="text-zinc-400 font-medium">No branch selected</p>
        <p className="text-zinc-600 text-sm text-center max-w-xs">
          Select a branch from the sidebar to view inventory.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="text-base font-semibold text-zinc-100 flex-shrink-0">Inventory</h2>
          {branchName && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              {branchName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh inventory"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <svg
              width="14" height="14" viewBox="0 0 16 16" fill="none"
              className={isFetching ? 'animate-spin' : ''}
            >
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 1v3.5L10.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="relative flex-1 sm:flex-none">
            <IconSearch width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all
                py-2 pl-8 pr-4 w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 overflow-auto h-full">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Items"  value={items.length} />
          <StatCard label="Out of Stock" value={outOfStock} />
          <StatCard label="Low Stock"    value={lowStock} />
          <StatCard label="Total Units"  value={Math.round(totalValue)} accent />
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto flex flex-col flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th right>Sold</Th>
                  <Th right>Available</Th>
                  <Th>
                    <button
                      onClick={() => setStockSort(s => s === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1 hover:text-amber-400 transition-colors group"
                      title={stockSort === 'asc' ? 'Sorted: Low → High (click for High → Low)' : 'Sorted: High → Low (click for Low → High)'}
                    >
                      Stock Level
                      <span className="text-zinc-500 group-hover:text-amber-400 transition-colors">
                        {stockSort === 'asc' ? '↑' : '↓'}
                      </span>
                    </button>
                  </Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Empty icon={<IconInventory width="40" height="40" />} title="No inventory found" subtitle="Adjust your search or check the branch" />
                    </td>
                  </tr>
                ) : filtered.map(item => {
                  const available = parseFloat(item.quantity_available)
                  const sold      = parseFloat(item.quantity_sold ?? '0')
                  const reorderPt = item.reorder_point ?? 0
                  const isOut = available === 0
                  const isLow = reorderPt > 0 && available > 0 && available <= reorderPt
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <Td>
                        <div>
                          <p className="text-sm text-zinc-200">{productMap.get(item.product_id)?.name ?? '—'}</p>
                          <p className="text-xs text-zinc-500 font-mono">{productMap.get(item.product_id)?.sku ?? item.product_id.slice(0, 8) + '…'}</p>
                        </div>
                      </Td>
                      <Td right mono muted>{Math.round(sold)}</Td>
                      <Td right mono>{Math.round(available)}</Td>
                      <Td className="min-w-[140px]">
                        <StockBar available={available} sold={sold} reorderPoint={reorderPt} />
                      </Td>
                      <Td>
                        {isOut
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400">Out</span>
                          : isLow
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-400">Low</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 border border-green-800 text-green-400">OK</span>
                        }
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Btn variant="outline" size="xs" onClick={() => setAdjustingItem(item)}>
                            Adjust
                          </Btn>
                          <Btn variant="ghost" size="xs" onClick={() => setHistoryItem(item)}>
                            History
                          </Btn>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
          <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
            <p className="text-xs text-zinc-500">{filtered.length} of {items.length} items</p>
          </div>
        </div>
      </div>

      {adjustingItem && (
        <AdjustmentModal
          item={adjustingItem}
          branchId={branchId}
          productName={productMap.get(adjustingItem.product_id)?.name ?? ''}
          productSku={productMap.get(adjustingItem.product_id)?.sku ?? ''}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => { setAdjustingItem(null); refetch() }}
        />
      )}

      {historyItem && (
        <StockHistoryModal
          item={historyItem}
          branchId={branchId}
          productName={productMap.get(historyItem.product_id)?.name ?? historyItem.product_id}
          productSku={productMap.get(historyItem.product_id)?.sku ?? ''}
          onClose={() => setHistoryItem(null)}
        />
      )}

    </div>
  )
}
