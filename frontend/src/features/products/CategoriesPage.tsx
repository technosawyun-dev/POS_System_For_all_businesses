import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Btn, Spinner, Empty, Table, Th, Td, Badge } from '@/components/ui'
import { categoriesService } from '@/services/categories/categories.service'
import type { Category } from '@/shared/types'

function CategoryModal({ category, onClose }: { category?: Category; onClose: () => void }) {
  const qc = useQueryClient()
  const isEdit = !!category
  const [form, setForm] = useState({
    name: category?.name ?? '',
    description: category?.description ?? '',
  })

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? categoriesService.update(category!.id, { name: form.name.trim(), description: form.description.trim() || undefined })
        : categoriesService.create({ name: form.name.trim(), description: form.description.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(isEdit ? 'Category updated' : 'Category created')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">{isEdit ? 'Edit Category' : 'New Category'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name *</label>
            <input
              className={inp}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Beverages"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <input
              className={inp}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!form.name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; category?: Category }>({ open: false })
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['categories', page],
    queryFn: () => categoriesService.list({ page, page_size: 50 }),
    placeholderData: prev => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to delete'),
  })

  const categories = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <>
      {modal.open && <CategoryModal category={modal.category} onClose={() => setModal({ open: false })} />}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Sub-navigation */}
        <div className="flex-shrink-0 flex items-center gap-1 px-4 sm:px-6 pt-3 sm:pt-4 border-b border-zinc-800 pb-0">
          <Link to="/app/products" className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 border-b-2 border-transparent -mb-px transition-colors">Products</Link>
          <span className="px-3 py-1.5 text-xs font-semibold text-amber-400 border-b-2 border-amber-500 -mb-px">Categories</span>
          <Link to="/app/brands" className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 border-b-2 border-transparent -mb-px transition-colors">Brands</Link>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Categories</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{total} categor{total !== 1 ? 'ies' : 'y'}</p>
          </div>
          <Btn size="sm" onClick={() => setModal({ open: true })}>+ New Category</Btn>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : categories.length === 0 ? (
            <Empty
              title="No categories yet"
              subtitle="Create categories to organize your products and filter them in POS"
              action={<Btn size="sm" onClick={() => setModal({ open: true })}>+ New Category</Btn>}
            />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Description</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-zinc-800/40 transition-colors">
                      <Td><span className="font-medium text-zinc-100">{cat.name}</span></Td>
                      <Td muted>{cat.description ?? '—'}</Td>
                      <Td>
                        <Badge variant={cat.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'default'} size="xs">
                          {cat.status?.toLowerCase() === 'active' ? 'active' : cat.status?.toLowerCase() ?? '—'}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end">
                          <Btn variant="secondary" size="xs" onClick={() => setModal({ open: true, category: cat })}>Edit</Btn>
                          <Btn
                            variant="secondary"
                            size="xs"
                            disabled={deleteMutation.isPending}
                            onClick={() => confirm(`Delete category "${cat.name}"?`) && deleteMutation.mutate(cat.id)}
                          >
                            Delete
                          </Btn>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
              <span className="text-xs text-zinc-500 self-center">{page} / {totalPages}</span>
              <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
