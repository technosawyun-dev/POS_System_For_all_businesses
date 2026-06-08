import axios from 'axios'
import { toast } from 'sonner'
import { getPendingSyncOps, removeSyncOp, db } from '@/offline/db'
import { checkoutService } from '@/services/sales/sales.service'
import { useUIStore } from '@/store/ui.store'
import type { CheckoutRequest } from '@/shared/types'

let isProcessing = false

export async function processSyncQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const ops = await getPendingSyncOps()
    if (ops.length === 0) return

    const { setPendingSyncCount } = useUIStore.getState()
    setPendingSyncCount(ops.length)
    toast.info(`Syncing ${ops.length} saved transaction${ops.length > 1 ? 's' : ''}…`)

    let successCount = 0
    let failCount = 0

    for (const op of ops) {
      if (op.type !== 'SALE_CREATE') {
        // Unknown type — remove to avoid blocking queue
        await removeSyncOp(op.id)
        continue
      }

      try {
        await checkoutService.checkout(op.payload as CheckoutRequest)
        await removeSyncOp(op.id)
        successCount++
      } catch (err: unknown) {
        // API error (4xx/5xx) — the server rejected the payload; retrying won't help.
        if (axios.isAxiosError(err) && err.response) {
          await db.syncQueue.update(op.id, { status: 'failed', retries: (op.retries ?? 0) + 1 })
          failCount++
        } else {
          // Network error — retry up to 3 times before giving up.
          const newRetries = (op.retries ?? 0) + 1
          if (newRetries >= 3) {
            await db.syncQueue.update(op.id, { status: 'failed', retries: newRetries })
            failCount++
          } else {
            await db.syncQueue.update(op.id, { retries: newRetries })
          }
        }
      }
    }

    const remaining = await getPendingSyncOps()
    setPendingSyncCount(remaining.length)

    if (successCount > 0 && failCount === 0) {
      toast.success(`${successCount} transaction${successCount > 1 ? 's' : ''} synced successfully.`)
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`${successCount} synced, ${failCount} failed. Check your transactions.`)
    } else if (failCount > 0) {
      toast.error(`${failCount} transaction${failCount > 1 ? 's' : ''} failed to sync. Please review manually.`)
    }
  } finally {
    isProcessing = false
  }
}
