import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Btn } from '@/components/ui'
import { resellersService } from '@/services/resellers/resellers.service'

const ALL_PERMISSIONS = [
  'view_revenue', 'view_profit', 'view_analytics', 'view_inventory',
  'view_customers', 'view_staff', 'view_exports', 'view_procurement',
  'view_subscription_status', 'view_branch_reports',
]

function CreateAssignmentModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    reseller_id: '',
    tenant_id: '',
    notes: '',
    access_starts_at: '',
    access_expires_at: '',
    restricted_permissions: [] as string[],
    allowed_branch_ids_raw: '',
  })

  const mutation = useMutation({
    mutationFn: () =>
      resellersService.createAssignment({
        reseller_id: form.reseller_id.trim(),
        tenant_id: form.tenant_id.trim(),
        notes: form.notes || undefined,
        access_starts_at: form.access_starts_at ? new Date(form.access_starts_at).toISOString() : undefined,
        access_expires_at: form.access_expires_at ? new Date(form.access_expires_at).toISOString() : undefined,
        restricted_permissions: form.restricted_permissions.length > 0 ? form.restricted_permissions : undefined,
        allowed_branch_ids: form.allowed_branch_ids_raw
          ? form.allowed_branch_ids_raw.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['reseller', 'assignment'] })
      toast.success('Assignment created')
      onClose()
      navigate(`/super-admin/resellers/${data.id}`)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create assignment'),
  })

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  function togglePerm(perm: string) {
    setForm(p => ({
      ...p,
      restricted_permissions: p.restricted_permissions.includes(perm)
        ? p.restricted_permissions.filter(x => x !== perm)
        : [...p.restricted_permissions, perm],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">New Reseller Assignment</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reseller User ID *</label>
            <input value={form.reseller_id} onChange={e => setForm(p => ({ ...p, reseller_id: e.target.value }))} className={inputCls} placeholder="UUID of the reseller user" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Tenant ID *</label>
            <input value={form.tenant_id} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value }))} className={inputCls} placeholder="UUID of the business to assign" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Access Starts</label>
              <input type="date" value={form.access_starts_at} onChange={e => setForm(p => ({ ...p, access_starts_at: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Access Expires</label>
              <input type="date" value={form.access_expires_at} onChange={e => setForm(p => ({ ...p, access_expires_at: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Allowed Branch IDs (comma-separated, empty = all)</label>
            <input value={form.allowed_branch_ids_raw} onChange={e => setForm(p => ({ ...p, allowed_branch_ids_raw: e.target.value }))} className={inputCls} placeholder="uuid1, uuid2, …" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Restricted Permissions</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.restricted_permissions.includes(perm)}
                    onChange={() => togglePerm(perm)}
                    className="rounded"
                  />
                  <span>{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-1">Checked = denied to this reseller</p>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            size="sm"
            disabled={!form.reseller_id || !form.tenant_id || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Creating…' : 'Create Assignment'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function ResellersPage() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [lookupId, setLookupId] = useState('')

  return (
    <>
      {showModal && <CreateAssignmentModal onClose={() => setShowModal(false)} />}

      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Resellers</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Manage reseller assignments</p>
          </div>
          <Btn size="sm" onClick={() => setShowModal(true)}>+ New Assignment</Btn>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Backend gap notice */}
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-400 font-medium">Backend gap — reseller listing</p>
            <p className="text-xs text-amber-300/70 mt-1">
              No API endpoint exists to list all resellers or their assignments. The backend only supports per-assignment CRUD operations.
              To view or edit an existing assignment, enter the assignment ID below.
              To list users with the RESELLER role, use the Users page.
            </p>
          </div>

          {/* Assignment lookup */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">Look Up Assignment</h3>
            <div className="flex gap-2">
              <input
                value={lookupId}
                onChange={e => setLookupId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupId.trim() && navigate(`/super-admin/resellers/${lookupId.trim()}`)}
                placeholder="Paste assignment ID…"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
              />
              <Btn
                variant="secondary"
                size="sm"
                disabled={!lookupId.trim()}
                onClick={() => navigate(`/super-admin/resellers/${lookupId.trim()}`)}
              >
                View
              </Btn>
            </div>
          </div>

          {/* Reseller permission matrix */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">Available Permissions</h3>
            <p className="text-xs text-zinc-500 mb-3">These permissions can be restricted when creating or editing a reseller assignment.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map(perm => (
                <div key={perm} className="bg-zinc-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-300 capitalize">{perm.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Go to users */}
          <div className="flex justify-center">
            <Btn variant="secondary" size="sm" onClick={() => navigate('/super-admin/users')}>
              View All Users (filter by Reseller role)
            </Btn>
          </div>
        </div>
      </div>
    </>
  )
}
