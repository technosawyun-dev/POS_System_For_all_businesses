import Dexie, { type Table } from 'dexie'
import type { Product, Category, CartItem, SyncOperation, Sale, Session } from '@/types'

export class POSDatabase extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  cart!: Table<CartItem & { _id: string }, string>
  syncQueue!: Table<SyncOperation, string>
  sales!: Table<Sale & { date: string }, string>
  sessions!: Table<Session & { startTime: string; endTime?: string }, string>

  constructor() {
    super('nexuspos')
    this.version(1).stores({
      products:   'id, sku, barcode, category, name',
      categories: 'id',
      cart:       '_id, id',
      syncQueue:  'id, status, type, createdAt',
      sales:      'id, date, status, paymentMethod',
      sessions:   'id, status',
    })
  }
}

export const db = new POSDatabase()
// Seed helpers


export async function seedProducts(products: Product[]) {
  const count = await db.products.count()
  if (count === 0) await db.products.bulkPut(products)
}

export async function seedCategories(categories: Category[]) {
  const count = await db.categories.count()
  if (count === 0) await db.categories.bulkPut(categories)
}
// Cart helpers


export async function saveCartToDB(items: CartItem[]) {
  await db.cart.clear()
  await db.cart.bulkPut(items.map(item => ({ ...item, _id: item.id })))
}

export async function loadCartFromDB(): Promise<CartItem[]> {
  return db.cart.toArray()
}
// Sync queue helpers


export async function enqueueSyncOp(op: SyncOperation) {
  await db.syncQueue.put(op)
}

export async function getPendingSyncOps(): Promise<SyncOperation[]> {
  return db.syncQueue.where('status').equals('pending').toArray()
}

export async function removeSyncOp(id: string) {
  await db.syncQueue.delete(id)
}
