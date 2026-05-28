import { db } from '@/offline/db'
import { productsService } from '@/services/products/products.service'
import type { Product } from '@/shared/types'

export type ScanSource = 'cache' | 'api'

export type ScanResult =
  | { status: 'found'; product: Product; source: ScanSource }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

// Look up a product by SKU: check IndexedDB first, fall back to API if online.
export async function lookupProductBySku(sku: string): Promise<ScanResult> {
  const trimmed = sku.trim()
  if (!trimmed) return { status: 'not_found' }

  // Offline cache first
  try {
    const cached = await db.products.where('sku').equals(trimmed).first()
    if (cached) {
      return { status: 'found', product: cached as unknown as Product, source: 'cache' }
    }
  } catch {
    // IndexedDB unavailable — fall through to API
  }

  // Online fallback
  try {
    const product = await productsService.getBySku(trimmed)
    return { status: 'found', product, source: 'api' }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return { status: 'not_found' }
    return { status: 'error', message: 'Network error — check connection' }
  }
}

// Look up by barcode (for legacy barcode scanners)
export async function lookupProductByBarcode(barcode: string): Promise<ScanResult> {
  const trimmed = barcode.trim()
  if (!trimmed) return { status: 'not_found' }

  try {
    const cached = await db.products.where('barcode').equals(trimmed).first()
    if (cached) {
      return { status: 'found', product: cached as unknown as Product, source: 'cache' }
    }
  } catch {
    // fall through
  }

  try {
    const product = await productsService.getByBarcode(trimmed)
    return { status: 'found', product, source: 'api' }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return { status: 'not_found' }
    return { status: 'error', message: 'Network error — check connection' }
  }
}
