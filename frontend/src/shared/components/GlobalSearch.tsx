import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { canAccess } from '@/shared/constants/rbac'
import { productsService } from '@/services/products/products.service'
import { customersService } from '@/services/customers/customers.service'
import { procurementService } from '@/services/procurement/procurement.service'

type ResultGroup = {
  label: string
  icon: string
  results: { id: string; label: string; sub?: string; path: string }[]
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? 'CASHIER'

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  const trimmed = debouncedQuery
  const canSearch = trimmed.length >= 2

  const productsQuery = useQuery({
    queryKey: ['search', 'products', trimmed],
    queryFn: () => productsService.list({ search: trimmed, page: 1, page_size: 5 }),
    enabled: canSearch && canAccess(role, 'products'),
    staleTime: 10_000,
  })

  const customersQuery = useQuery({
    queryKey: ['search', 'customers', trimmed],
    queryFn: () => customersService.search(trimmed),
    enabled: canSearch && canAccess(role, 'customers'),
    staleTime: 10_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['search', 'suppliers', trimmed],
    queryFn: () => procurementService.listSuppliers({ page: 1, page_size: 5 }),
    enabled: canSearch && canAccess(role, 'procurement'),
    staleTime: 10_000,
  })

  const poQuery = useQuery({
    queryKey: ['search', 'pos', trimmed],
    queryFn: () => procurementService.listOrders({ page: 1, page_size: 5 }),
    enabled: canSearch && canAccess(role, 'procurement'),
    staleTime: 10_000,
  })

  const groups: ResultGroup[] = []

  const products = (productsQuery.data?.items ?? []).filter(p =>
    p.name.toLowerCase().includes(trimmed.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(trimmed.toLowerCase()),
  )
  if (products.length > 0) {
    groups.push({
      label: 'Products',
      icon: '📦',
      results: products.map(p => ({
        id: p.id,
        label: p.name,
        sub: p.sku ? `SKU: ${p.sku}` : undefined,
        path: `/app/products`,
      })),
    })
  }

  const customers = (Array.isArray(customersQuery.data) ? customersQuery.data : []).filter(c =>
    c.name.toLowerCase().includes(trimmed.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(trimmed.toLowerCase()) ||
    c.phone.includes(trimmed),
  )
  if (customers.length > 0) {
    groups.push({
      label: 'Customers',
      icon: '👤',
      results: customers.slice(0, 5).map(c => ({
        id: c.id,
        label: c.name,
        sub: c.email ?? c.phone,
        path: `/app/customers/${c.id}`,
      })),
    })
  }

  const suppliers = (suppliersQuery.data?.items ?? []).filter(s =>
    s.name.toLowerCase().includes(trimmed.toLowerCase()),
  )
  if (suppliers.length > 0) {
    groups.push({
      label: 'Suppliers',
      icon: '🏭',
      results: suppliers.slice(0, 5).map(s => ({
        id: s.id,
        label: s.name,
        sub: `Code: ${s.code}`,
        path: `/app/procurement/suppliers/${s.id}`,
      })),
    })
  }

  const pos = (poQuery.data?.items ?? []).filter(po =>
    po.po_number.toLowerCase().includes(trimmed.toLowerCase()),
  )
  if (pos.length > 0) {
    groups.push({
      label: 'Purchase Orders',
      icon: '🛒',
      results: pos.slice(0, 5).map(po => ({
        id: po.id,
        label: `PO ${po.po_number}`,
        sub: po.status,
        path: `/app/procurement/purchase-orders/${po.id}`,
      })),
    })
  }

  const flat = groups.flatMap(g => g.results)

  const navigate_to = useCallback((path: string) => {
    navigate(path)
    onClose()
    setQuery('')
  }, [navigate, onClose])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setFocused(0)
    }
  }, [open])

  useEffect(() => {
    setFocused(0)
  }, [query])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter' && flat[focused]) { navigate_to(flat[focused].path) }
      if (e.key === 'Escape') { onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, focused, navigate_to, onClose])

  if (!open) return null

  const isLoading = productsQuery.isFetching || customersQuery.isFetching

  let flatIdx = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
          <span className="text-zinc-500 text-lg flex-shrink-0">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products, customers, suppliers, orders…"
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none"
          />
          {isLoading && (
            <span className="text-zinc-600 text-xs animate-pulse flex-shrink-0">Searching…</span>
          )}
          <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center justify-center text-[10px] font-medium text-zinc-600 bg-zinc-800 border border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {!canSearch ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-600">Type at least 2 characters to search</p>
            </div>
          ) : groups.length === 0 && !isLoading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-600">No results for "{trimmed}"</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  {group.icon} {group.label}
                </p>
                {group.results.map(result => {
                  const idx = flatIdx++
                  return (
                    <button
                      key={result.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        idx === focused ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
                      )}
                      onMouseEnter={() => setFocused(idx)}
                      onClick={() => navigate_to(result.path)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{result.label}</p>
                        {result.sub && (
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{result.sub}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-4 text-[10px] text-zinc-600">
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">↵</kbd> open</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">ESC</kbd> close</span>
          {!canAccess(role, 'products') && (
            <span className="ml-auto text-amber-600">Limited to your role's accessible sections</span>
          )}
        </div>
      </div>
    </div>
  )
}
