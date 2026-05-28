import { useQuery } from '@tanstack/react-query'
import { inventoryService } from '@/services/inventory/inventory.service'
import { Modal, Spinner, Empty } from '@/components/ui'
import { fmtDateTime } from '@/lib/utils'
import type { InventoryItem, StockMovement, PaginatedResponse } from '@/shared/types'

interface Props {
  item: InventoryItem
  branchId: string
  productName: string
  productSku: string
  onClose: () => void
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  SALE:                { label: 'Sale',            color: 'text-red-400'    },
  REFUND:              { label: 'Cash Refund',     color: 'text-blue-400'   },
  REPLACEMENT:         { label: 'Replacement',     color: 'text-violet-400' },
  PURCHASE:            { label: 'Purchase',        color: 'text-green-400'  },
  PURCHASE_RECEIPT:    { label: 'Purchase',        color: 'text-green-400'  },
  MANUAL_CORRECTION:   { label: 'Manual Adjust',   color: 'text-amber-400'  },
  OPENING_STOCK:       { label: 'Opening Stock',   color: 'text-purple-400' },
  TRANSFER_IN:         { label: 'Transfer In',     color: 'text-cyan-400'   },
  TRANSFER_OUT:        { label: 'Transfer Out',    color: 'text-orange-400' },
  ADJUSTMENT_INCREASE: { label: 'Adjustment +',   color: 'text-amber-400'  },
  ADJUSTMENT_DECREASE: { label: 'Adjustment −',   color: 'text-amber-400'  },
  DAMAGE:              { label: 'Damage',          color: 'text-red-400'    },
  RETURN_TO_SUPPLIER:  { label: 'Return',          color: 'text-orange-400' },
  LOSS:                { label: 'Loss',            color: 'text-red-400'    },
}

const OUTBOUND_TYPES = new Set([
  'SALE', 'REPLACEMENT', 'TRANSFER_OUT', 'DAMAGE',
  'ADJUSTMENT_DECREASE', 'RETURN_TO_SUPPLIER', 'LOSS',
])

function typeInfo(t: string) {
  return TYPE_LABEL[t] ?? { label: t.replace(/_/g, ' '), color: 'text-zinc-400' }
}

export default function StockHistoryModal({ item, branchId, productName, productSku, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', branchId, item.product_id],
    queryFn: () =>
      inventoryService.getBranchMovements(branchId, {
        product_id: item.product_id,
        page_size: 200,
      }) as Promise<PaginatedResponse<StockMovement>>,
    staleTime: 0,
  })

  const movements: StockMovement[] = data?.items ?? []

  return (
    <Modal open onClose={onClose} title="Stock History" size="lg">
      {/* Product header */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{productName}</p>
          <p className="text-xs font-mono text-zinc-500">{productSku}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Available now</p>
          <p className="text-sm font-mono font-bold text-amber-400">
            {Math.round(parseFloat(item.quantity_available))}
          </p>
        </div>
      </div>

      {/* Movements list */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner size={28} /></div>
      ) : movements.length === 0 ? (
        <Empty title="No history found" subtitle="Stock movements for this product will appear here" />
      ) : (
        <div className="flex flex-col divide-y divide-zinc-800 max-h-[420px] overflow-y-auto -mx-6 px-6">
          {movements.map(mv => {
            const qty        = parseFloat(mv.quantity)
            const prevQty    = parseFloat(mv.previous_quantity)
            const newQty     = parseFloat(mv.new_quantity)
            const isOutbound = OUTBOUND_TYPES.has(mv.movement_type)
            const info       = typeInfo(mv.movement_type)
            return (
              <div key={mv.id} className="py-3 flex gap-3">
                {/* Delta badge */}
                <div className={`flex-shrink-0 w-14 text-center rounded-lg px-1 py-1 text-xs font-mono font-bold border ${
                  isOutbound
                    ? 'bg-red-950 border-red-800 text-red-400'
                    : 'bg-green-950 border-green-800 text-green-400'
                }`}>
                  {isOutbound ? '−' : '+'}{Math.round(qty)}
                </div>

                {/* Detail */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                    {mv.reference_type && (
                      <span className="text-[10px] text-zinc-600 font-mono">{mv.reference_type}</span>
                    )}
                  </div>
                  {/* Stock level change */}
                  <p className="text-xs text-zinc-500 mt-0.5">
                    <span className="font-mono">{Math.round(prevQty)}</span>
                    <span className="mx-1 text-zinc-700">→</span>
                    <span className="font-mono font-semibold text-zinc-300">{Math.round(newQty)}</span>
                  </p>
                  {mv.reason && (
                    <p className="text-xs text-zinc-400 mt-0.5">{mv.reason}</p>
                  )}
                  {mv.notes && (
                    <p className="text-xs text-zinc-500 mt-0.5 italic">"{mv.notes}"</p>
                  )}
                </div>

                {/* Date */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] text-zinc-600 whitespace-nowrap">{fmtDateTime(mv.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && movements.length > 0 && (
        <p className="text-xs text-zinc-600 mt-3 text-right">{movements.length} record{movements.length !== 1 ? 's' : ''}</p>
      )}
    </Modal>
  )
}
