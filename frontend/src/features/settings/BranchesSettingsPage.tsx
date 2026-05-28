import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Badge, Spinner, Empty, Btn } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'
import type { BranchCreatePayload } from '@/services/tenant/tenant.service'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { Branch } from '@/shared/types'

function autoCode(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 8) || 'BR'
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors'
const LABEL = 'block text-xs text-zinc-400 mb-1'

function Field({
  label, value, onChange, required, readOnly, placeholder,
}: {
  label: string; value: string; onChange?: (v: string) => void
  required?: boolean; readOnly?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className={LABEL}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={e => onChange?.(e.target.value)}
        className={`${INPUT} ${readOnly ? 'opacity-50 cursor-default' : ''}`}
      />
    </div>
  )
}

// Add Branch Modal

function AddBranchModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<BranchCreatePayload>({
    name: '', code: '', address: '', city: '', phone: '',
    timezone: 'UTC', currency: 'MMK', is_main_branch: false,
  })

  function setName(name: string) {
    setForm(p => ({ ...p, name, code: autoCode(name) }))
  }

  const mutation = useMutation({
    mutationFn: () => tenantService.createBranch(tenantId, {
      ...form,
      address: form.address || null,
      city:    form.city    || null,
      phone:   form.phone   || null,
    }),
    onSuccess: () => {
      toast.success('Branch created')
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'branches'] })
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create branch'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">Add New Branch</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Branch Name" value={form.name} onChange={setName} required />

          {/* Auto-generated code — read-only display */}
          <div>
            <label className={LABEL}>Branch Code <span className="text-zinc-600">(auto-generated)</span></label>
            <div className="flex items-center gap-2">
              <input
                value={form.code}
                readOnly
                className={`${INPUT} opacity-50 cursor-default font-mono tracking-widest`}
              />
            </div>
          </div>

          <Field label="Address"  value={form.address ?? ''} onChange={v => setForm(p => ({ ...p, address: v }))} />
          <Field label="City"     value={form.city    ?? ''} onChange={v => setForm(p => ({ ...p, city: v }))} />
          <Field label="Phone"    value={form.phone   ?? ''} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+1 555 000 0000" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone" value={form.timezone ?? 'UTC'} onChange={v => setForm(p => ({ ...p, timezone: v }))} placeholder="UTC" />
            <Field label="Currency" value={form.currency ?? 'MMK'} onChange={v => setForm(p => ({ ...p, currency: v }))} placeholder="MMK" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            size="sm"
            disabled={!form.name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Creating…' : 'Create Branch'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// Edit Branch Modal
type EditForm = {
  name: string; address: string; city: string; phone: string; timezone: string; currency: string
}

function EditBranchModal({
  tenantId, branch, onClose,
}: {
  tenantId: string; branch: Branch; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<EditForm>({
    name:     branch.name,
    address:  branch.address  ?? '',
    city:     branch.city     ?? '',
    phone:    branch.phone    ?? '',
    timezone: branch.timezone ?? 'UTC',
    currency: branch.currency ?? 'MMK',
  })

  const set = (key: keyof EditForm) => (v: string) => setForm(p => ({ ...p, [key]: v }))

  const mutation = useMutation({
    mutationFn: () => tenantService.updateBranch(tenantId, branch.id, {
      name:     form.name     || undefined,
      address:  form.address  || null,
      city:     form.city     || null,
      phone:    form.phone    || null,
      timezone: form.timezone || undefined,
      currency: form.currency || undefined,
    }),
    onSuccess: () => {
      toast.success('Branch updated')
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'branches'] })
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update branch'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Edit Branch</h3>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono tracking-widest">{branch.code}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Branch Name" value={form.name}     onChange={set('name')}     required />
          <Field label="Address"     value={form.address}  onChange={set('address')}  />
          <Field label="City"        value={form.city}     onChange={set('city')}     />
          <Field label="Phone"       value={form.phone}    onChange={set('phone')}    placeholder="+1 555 000 0000" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone"  value={form.timezone} onChange={set('timezone')} placeholder="UTC" />
            <Field label="Currency"  value={form.currency} onChange={set('currency')} placeholder="MMK" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            size="sm"
            disabled={!form.name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// Main Page

export default function BranchesSettingsPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const tenantId = user?.tenant_id
  const [showAdd, setShowAdd] = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'branches'],
    queryFn: () => tenantService.getBranches(tenantId!, { page_size: 50 }),
    enabled: !!tenantId,
  })

  const { data: entitlements } = useQuery({
    queryKey: ['subscription', 'entitlements'],
    queryFn: subscriptionsService.getMyEntitlements,
    enabled: !!tenantId,
  })

  const statusMutation = useMutation({
    mutationFn: ({ branchId, status }: { branchId: string; status: string }) =>
      tenantService.updateBranchStatus(tenantId!, branchId, status),
    onSuccess: (_, vars) => {
      toast.success(`Branch ${vars.status === 'ACTIVE' ? 'activated' : 'deactivated'}`)
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'branches'] })
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update branch'),
  })

  if (!tenantId) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-zinc-500 text-sm">No tenant associated with your account.</p>
    </div>
  )

  if (isLoading) return (
    <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  )

  const branches = data?.items ?? []
  const branchesEnt = entitlements?.find(e =>
    e.feature_code === 'branches' || e.feature_code === 'max_branches'
  )
  const canAddBranch = entitlements
    ? (!!branchesEnt?.enabled && (
        branchesEnt.limit_value === null ||
        branchesEnt.limit_value === 0 ||
        branchesEnt.limit_value > 1
      ))
    : false

  return (
    <>
      {showAdd && tenantId && (
        <AddBranchModal tenantId={tenantId} onClose={() => setShowAdd(false)} />
      )}
      {editBranch && tenantId && (
        <EditBranchModal tenantId={tenantId} branch={editBranch} onClose={() => setEditBranch(null)} />
      )}

      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              Activate or deactivate branches. Deactivated branches cannot process sales.
              {!canAddBranch && ' Contact your administrator to register additional branches.'}
            </p>
            {canAddBranch && (
              <Btn size="sm" onClick={() => setShowAdd(true)} className="flex-shrink-0">
                + Add Branch
              </Btn>
            )}
          </div>

          {branches.length === 0 ? (
            <Empty title="No branches found" />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
              {branches.map((branch: Branch) => {
                const isActive = branch.status === 'ACTIVE'
                const isClosed = branch.status === 'CLOSED'
                return (
                  <div key={branch.id} className="flex items-center gap-3 px-4 py-3.5">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-zinc-400 font-mono">
                        {branch.code.slice(0, 3).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{branch.name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        <span className="font-mono text-zinc-600">{branch.code}</span>
                        {branch.city && ` · ${branch.city}`}
                        {branch.address && ` · ${branch.address}`}
                      </p>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant={isActive ? 'success' : isClosed ? 'danger' : 'default'}
                      size="xs"
                    >
                      {isActive ? 'Active' : isClosed ? 'Closed' : 'Inactive'}
                    </Badge>

                    {/* Edit button */}
                    {!isClosed && (
                      <button
                        onClick={() => setEditBranch(branch)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
                        title="Edit branch"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}

                    {/* Activate / Deactivate */}
                    {!isClosed && (
                      <Btn
                        size="xs"
                        variant={isActive ? 'danger' : 'secondary'}
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({
                          branchId: branch.id,
                          status:   isActive ? 'INACTIVE' : 'ACTIVE',
                        })}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Btn>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
