import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryService } from '@/services/inventory/inventory.service'
import { Modal, Btn, Input } from '@/components/ui'
import type { InventoryItem } from '@/shared/types'

interface AdjustmentModalProps {
  item: InventoryItem
  branchId: string
  productName: string
  productSku: string
  onClose: () => void
  onSuccess: () => void
}

type AdjustType = 'add' | 'remove'

export default function AdjustmentModal({ item, branchId, productName, productSku, onClose, onSuccess }: AdjustmentModalProps) {
  const [type, setType] = useState<AdjustType>('add')
  const [qty, setQty]   = useState('')
  const [notes, setNotes] = useState('')

  const currentQty = parseFloat(item.quantity_on_hand)
  const qtyNum     = parseInt(qty, 10) || 0
  const delta      = type === 'add' ? qtyNum : -qtyNum
  const newQty     = Math.max(0, currentQty + delta)

  const mutation = useMutation({
    mutationFn: () => inventoryService.createAdjustment({
      branch_id:       branchId,
      adjustment_type: 'MANUAL_CORRECTION',
      items: [{
        product_id:      item.product_id,
        variant_id:      item.variant_id ?? undefined,
        quantity_change: delta,
      }],
      reason: type === 'add' ? 'Manual Addition' : 'Manual Removal',
      notes:  notes || undefined,
    }),
    onSuccess: () => {
      toast.success(`Stock ${type === 'add' ? 'added' : 'removed'}: ${qtyNum} unit(s)`)
      onSuccess()
    },
    onError: () => toast.error('Failed to adjust stock'),
  })

  function handleApply() {
    if (!qtyNum || qtyNum <= 0) {
      toast.warning('Please enter a valid quantity.')
      return
    }
    if (type === 'remove' && qtyNum > currentQty) {
      toast.warning(`Cannot remove more than current stock (${Math.round(currentQty)}).`)
      return
    }
    mutation.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Stock Adjustment" size="md">
      <div className="flex flex-col gap-4">
        {/* Item info */}
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{productName || '—'}</p>
            {productSku && <p className="text-xs font-mono text-zinc-500 mt-0.5">{productSku}</p>}
            <p className="text-xs text-zinc-500 mt-1">Current stock: <span className="font-bold text-zinc-300">{Math.round(currentQty)}</span></p>
          </div>
          <div className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            currentQty === 0 ? 'bg-red-950 border-red-800 text-red-400' :
            currentQty <= 10 ? 'bg-amber-950 border-amber-800 text-amber-400' :
            'bg-green-950 border-green-800 text-green-400'
          }`}>
            {currentQty === 0 ? 'Out' : currentQty <= 10 ? 'Low' : 'OK'}
          </div>
        </div>

        {/* Add / Remove toggle */}
        <div className="flex rounded-xl overflow-hidden border border-zinc-700">
          <button
            onClick={() => setType('add')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${type === 'add' ? 'bg-green-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
          >
            + Add
          </button>
          <button
            onClick={() => setType('remove')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${type === 'remove' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
          >
            − Remove
          </button>
        </div>

        {/* Quantity */}
        <Input
          label="Quantity"
          type="number"
          min="1"
          placeholder="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
        />

        {/* Notes */}
        <Input
          label="Notes (optional)"
          type="text"
          placeholder="Add notes…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {/* Preview */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-zinc-500">New stock level</span>
          <span className="font-mono font-bold">
            <span className="text-zinc-400">{Math.round(currentQty)}</span>
            <span className="text-zinc-600 mx-1">→</span>
            <span className={newQty === 0 ? 'text-red-400' : newQty <= 10 ? 'text-amber-400' : 'text-green-400'}>{Math.round(newQty)}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-zinc-800">
          <Btn variant="secondary" fullWidth onClick={onClose} disabled={mutation.isPending}>Cancel</Btn>
          <Btn
            variant={type === 'add' ? 'success' : 'danger'}
            fullWidth
            onClick={handleApply}
            disabled={mutation.isPending || !qtyNum}
          >
            {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
