import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { resellersService } from '@/services/resellers/resellers.service'
import type { ResellerAssignmentUpdateRequest } from '@/shared/types'

const ALL_PERMISSIONS = [
  'view_revenue', 'view_profit', 'view_analytics', 'view_inventory',
  'view_customers', 'view_staff', 'view_exports', 'view_procurement',
  'view_subscription_status', 'view_branch_reports',
]

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<{
    notes: string
    access_starts_at: string
    access_expires_at: string
    restricted_permissions: string[]
    allowed_branch_ids_raw: string
    is_active: boolean
  } | null>(null)

  const assignmentQuery = useQuery({
    queryKey: ['reseller', 'assignment', id],
    queryFn: () => resellersService.getAssignment(id!),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: ResellerAssignmentUpdateRequest) =>
      resellersService.updateAssignment(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'assignment', id] })
      toast.success('Assignment updated')
      setIsEditing(false)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => resellersService.deleteAssignment(id!),
    onSuccess: () => {
      toast.success('Assignment revoked')
      navigate('/super-admin/resellers')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const assignment = assignmentQuery.data

  function startEdit() {
    if (!assignment) return
    setForm({
      notes: assignment.notes ?? '',
      access_starts_at: assignment.access_starts_at ? assignment.access_starts_at.split('T')[0] : '',
      access_expires_at: assignment.access_expires_at ? assignment.access_expires_at.split('T')[0] : '',
      restricted_permissions: [...assignment.restricted_permissions],
      allowed_branch_ids_raw: assignment.allowed_branch_ids.join(', '),
      is_active: assignment.is_active,
    })
    setIsEditing(true)
  }

  function saveEdit() {
    if (!form) return
    updateMutation.mutate({
      notes: form.notes || undefined,
      access_starts_at: form.access_starts_at ? new Date(form.access_starts_at).toISOString() : undefined,
      access_expires_at: form.access_expires_at ? new Date(form.access_expires_at).toISOString() : undefined,
      restricted_permissions: form.restricted_permissions,
      allowed_branch_ids: form.allowed_branch_ids_raw
        ? form.allowed_branch_ids_raw.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      is_active: form.is_active,
    })
  }

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button
          onClick={() => navigate('/super-admin/resellers')}
          className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">Reseller Assignment</h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">{id}</p>
        </div>
        {assignment && !isEditing && (
          <div className="flex gap-2 flex-shrink-0">
            <Btn variant="secondary" size="sm" onClick={startEdit}>Edit</Btn>
            <Btn
              variant="danger"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => confirm('Revoke this assignment?') && deleteMutation.mutate()}
            >
              Revoke
            </Btn>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {assignmentQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : assignmentQuery.error ? (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">Assignment not found or access denied.</p>
          </div>
        ) : assignment ? (
          <div className="max-w-xl space-y-4">
            {!isEditing ? (
              <>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assignment Details</h3>
                    <Badge variant={assignment.is_active ? 'success' : 'default'} size="xs">
                      {assignment.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <dl className="space-y-3">
                    {[
                      { label: 'Reseller ID', value: <span className="font-mono text-xs">{assignment.reseller_id}</span> },
                      { label: 'Tenant ID', value: <span className="font-mono text-xs">{assignment.tenant_id}</span> },
                      { label: 'Access Starts', value: assignment.access_starts_at ? fmtDate(assignment.access_starts_at) : '—' },
                      { label: 'Access Expires', value: assignment.access_expires_at ? fmtDate(assignment.access_expires_at) : 'No expiry' },
                      { label: 'Notes', value: assignment.notes ?? '—' },
                      { label: 'Created', value: fmtDate(assignment.created_at) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-4">
                        <dt className="text-xs text-zinc-500 w-28 flex-shrink-0 pt-0.5">{label}</dt>
                        <dd className="text-sm text-zinc-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Branch Visibility</h3>
                  {assignment.allowed_branch_ids.length === 0 ? (
                    <p className="text-sm text-zinc-400">All branches (no restriction)</p>
                  ) : (
                    <div className="space-y-1">
                      {assignment.allowed_branch_ids.map(bid => (
                        <p key={bid} className="text-xs font-mono text-zinc-300 bg-zinc-800 rounded px-2 py-1">{bid}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Restricted Permissions</h3>
                  {assignment.restricted_permissions.length === 0 ? (
                    <p className="text-sm text-zinc-400">No restrictions (full access)</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.restricted_permissions.map(p => (
                        <Badge key={p} variant="danger" size="xs">{p.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : form ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Edit Assignment</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Access Starts</label>
                    <input type="date" value={form.access_starts_at} onChange={e => setForm(p => p ? { ...p, access_starts_at: e.target.value } : p)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Access Expires</label>
                    <input type="date" value={form.access_expires_at} onChange={e => setForm(p => p ? { ...p, access_expires_at: e.target.value } : p)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Allowed Branch IDs (comma-separated, empty = all)</label>
                  <input value={form.allowed_branch_ids_raw} onChange={e => setForm(p => p ? { ...p, allowed_branch_ids_raw: e.target.value } : p)} className={inputCls} placeholder="uuid1, uuid2, …" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Restricted Permissions</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_PERMISSIONS.map(perm => (
                      <label key={perm} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.restricted_permissions.includes(perm)}
                          onChange={() => setForm(p => {
                            if (!p) return p
                            const perms = p.restricted_permissions.includes(perm)
                              ? p.restricted_permissions.filter(x => x !== perm)
                              : [...p.restricted_permissions, perm]
                            return { ...p, restricted_permissions: perms }
                          })}
                          className="rounded"
                        />
                        <span>{perm.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                  <input value={form.notes} onChange={e => setForm(p => p ? { ...p, notes: e.target.value } : p)} className={inputCls} />
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => p ? { ...p, is_active: e.target.checked } : p)} className="rounded" />
                  Assignment is active
                </label>
                <div className="flex gap-2 justify-end pt-2">
                  <Btn variant="secondary" size="sm" onClick={() => setIsEditing(false)}>Cancel</Btn>
                  <Btn size="sm" disabled={updateMutation.isPending} onClick={saveEdit}>
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Btn>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
