import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { auditService } from '@/services/audit/audit.service'
import { tenantService } from '@/services/tenant/tenant.service'
import type { AuditLog } from '@/shared/types'

// Action metadata

type ActionVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple' | 'orange'

const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  { label: 'Auth', actions: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'TOKEN_REFRESHED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED'] },
  { label: 'Users', actions: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_SUSPENDED', 'USER_ROLE_CHANGED', 'USER_BRANCH_ASSIGNED'] },
  { label: 'Businesses', actions: ['TENANT_CREATED', 'TENANT_UPDATED', 'TENANT_SUSPENDED', 'TENANT_ACTIVATED', 'TENANT_DELETED', 'BRANCH_CREATED', 'BRANCH_UPDATED', 'BRANCH_DEACTIVATED'] },
  { label: 'Resellers', actions: ['RESELLER_ASSIGNED', 'RESELLER_ACCESS_REVOKED', 'RESELLER_ASSIGNMENT_UPDATED', 'RESELLER_PERMISSIONS_CHANGED', 'RESELLER_BRANCH_VISIBILITY_CHANGED', 'RESELLER_ACCESS_DENIED'] },
  { label: 'Products', actions: ['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRODUCT_PRICE_CHANGED', 'VARIANT_CREATED', 'VARIANT_UPDATED', 'VARIANT_DELETED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DELETED'] },
  { label: 'Inventory', actions: ['STOCK_MOVEMENT_CREATED', 'INVENTORY_ADJUSTED', 'INVENTORY_TRANSFER_CREATED', 'INVENTORY_TRANSFER_APPROVED', 'INVENTORY_TRANSFER_COMPLETED', 'INVENTORY_TRANSFER_CANCELLED', 'OPENING_STOCK_SET'] },
  { label: 'Orders & Payments', actions: ['ORDER_CREATED', 'ORDER_COMPLETED', 'ORDER_VOIDED', 'ORDER_CANCELLED', 'ORDER_REFUNDED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_CREATED', 'REFUND_PROCESSED'] },
  { label: 'Customers', actions: ['CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_DELETED', 'CUSTOMER_PAYMENT_RECORDED', 'CUSTOMER_BALANCE_ADJUSTED'] },
  { label: 'Procurement', actions: ['PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_SUBMITTED', 'PURCHASE_ORDER_APPROVED', 'PURCHASE_ORDER_CANCELLED', 'GOODS_RECEIPT_CREATED', 'SUPPLIER_PAYMENT_RECORDED'] },
  { label: 'Subscriptions', actions: ['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPGRADED', 'SUBSCRIPTION_DOWNGRADED'] },
  { label: 'Devices & Sync', actions: ['DEVICE_REGISTERED', 'DEVICE_UPDATED', 'DEVICE_DEACTIVATED', 'SYNC_PUSH_COMPLETED', 'SYNC_OPERATION_REPLAYED', 'SYNC_OPERATION_FAILED'] },
]

const ACTION_VARIANT: Record<string, ActionVariant> = {
  // success
  LOGIN: 'success', USER_CREATED: 'success', USER_ACTIVATED: 'success',
  TENANT_CREATED: 'success', TENANT_ACTIVATED: 'success',
  ORDER_COMPLETED: 'success', PAYMENT_RECEIVED: 'success',
  SUBSCRIPTION_ACTIVATED: 'success', SUBSCRIPTION_RENEWED: 'success',
  INVENTORY_TRANSFER_COMPLETED: 'success', GOODS_RECEIPT_CREATED: 'success',
  RESELLER_ASSIGNED: 'success',
  // danger
  LOGIN_FAILED: 'danger', USER_DELETED: 'danger', USER_SUSPENDED: 'danger',
  TENANT_DELETED: 'danger', TENANT_SUSPENDED: 'danger',
  ORDER_VOIDED: 'danger', ORDER_CANCELLED: 'danger',
  PAYMENT_FAILED: 'danger', RESELLER_ACCESS_REVOKED: 'danger',
  RESELLER_ACCESS_DENIED: 'danger', PRODUCT_DELETED: 'danger',
  INVENTORY_TRANSFER_CANCELLED: 'danger',
  // warning
  USER_DEACTIVATED: 'warning', USER_ROLE_CHANGED: 'warning',
  PASSWORD_CHANGED: 'warning', TENANT_UPDATED: 'warning',
  PRODUCT_PRICE_CHANGED: 'warning', ORDER_REFUNDED: 'warning',
  REFUND_CREATED: 'warning', SUBSCRIPTION_DOWNGRADED: 'warning',
  PURCHASE_ORDER_CANCELLED: 'warning',
  // info
  USER_UPDATED: 'info', BRANCH_CREATED: 'info', BRANCH_UPDATED: 'info',
  PRODUCT_CREATED: 'info', PRODUCT_UPDATED: 'info',
  ORDER_CREATED: 'info', CASHIER_SESSION_OPENED: 'info',
  SYNC_PUSH_COMPLETED: 'info', DEVICE_REGISTERED: 'info',
  PURCHASE_ORDER_CREATED: 'info', SUBSCRIPTION_UPGRADED: 'info',
}

const ROLE_VARIANT: Record<string, ActionVariant> = {
  SUPER_ADMIN: 'orange',
  RESELLER: 'purple',
  BUSINESS_OWNER: 'info',
  MANAGER: 'default',
  CASHIER: 'default',
  INVENTORY_STAFF: 'default',
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  RESELLER: 'Reseller',
  BUSINESS_OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  INVENTORY_STAFF: 'Inventory',
}

function getActionVariant(action: string): ActionVariant {
  return ACTION_VARIANT[action] ?? 'default'
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// State diff panel

function StateDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
  if (keys.length === 0) return null
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700/50 text-xs font-mono">
      {keys.map(k => {
        const prev = before?.[k]
        const next = after?.[k]
        const changed = JSON.stringify(prev) !== JSON.stringify(next)
        return (
          <div key={k} className={`flex gap-2 px-3 py-1.5 ${changed ? 'bg-zinc-800' : 'bg-zinc-900'}`}>
            <span className="text-zinc-500 w-36 flex-shrink-0 truncate">{k}</span>
            {before && prev !== undefined && (
              <span className="text-red-400 line-through truncate max-w-[140px]">{String(prev)}</span>
            )}
            {changed && after && next !== undefined && (
              <span className="text-green-400 truncate max-w-[140px]">{String(next)}</span>
            )}
            {!changed && (
              <span className="text-zinc-400 truncate max-w-[200px]">{String(prev ?? next)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Log row

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasState = log.before_state || log.after_state

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        {/* Actor */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Who */}
            {log.actor_name ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex w-6 h-6 rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-bold items-center justify-center flex-shrink-0">
                  {log.actor_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-zinc-200">{log.actor_name}</span>
              </div>
            ) : (
              <span className="text-xs text-zinc-600 italic">System</span>
            )}
            {log.actor_role && (
              <Badge variant={ROLE_VARIANT[log.actor_role] ?? 'default'} size="xs">
                {ROLE_LABEL[log.actor_role] ?? log.actor_role}
              </Badge>
            )}
          </div>

          {/* Action */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getActionVariant(log.action)} size="xs">{humanizeAction(log.action)}</Badge>
            {log.entity_type && (
              <span className="text-xs text-zinc-500">{log.entity_type}</span>
            )}
            {log.entity_id && (
              <span className="text-xs font-mono text-zinc-600" title={log.entity_id}>
                #{log.entity_id.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Actor email + tenant context */}
          <div className="flex items-center gap-3 flex-wrap">
            {log.actor_email && (
              <span className="text-xs text-zinc-600">{log.actor_email}</span>
            )}
            {log.tenant_id && (
              <span className="text-xs text-zinc-600 font-mono">tenant:{log.tenant_id.slice(0, 8)}</span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs text-zinc-600">{fmtDate(log.created_at)}</span>
          {hasState && (
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? 'Hide changes ▲' : 'View changes ▼'}
            </button>
          )}
        </div>
      </div>

      {expanded && hasState && (
        <StateDiff before={log.before_state} after={log.after_state} />
      )}
    </div>
  )
}

// Page

interface Filters {
  action: string
  dateFrom: string
  dateTo: string
  tenantId: string
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<Filters>({ action: '', dateFrom: '', dateTo: '', tenantId: '' })
  const [applied, setApplied] = useState<Filters>({ action: '', dateFrom: '', dateTo: '', tenantId: '' })

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants', 'all'],
    queryFn: () => tenantService.listTenants({ page_size: 200 }),
    staleTime: 60_000,
  })
  const tenants = tenantsQuery.data?.items ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', 'logs', page, applied],
    queryFn: () =>
      auditService.listLogs({
        page,
        page_size: 25,
        action: applied.action || undefined,
        date_from: applied.dateFrom || undefined,
        date_to: applied.dateTo || undefined,
        tenant_id: applied.tenantId || undefined,
      }),
    retry: false,
  })

  function applyFilters() {
    setPage(1)
    setApplied({ ...draft })
  }

  function clearFilters() {
    const empty: Filters = { action: '', dateFrom: '', dateTo: '', tenantId: '' }
    setDraft(empty)
    setApplied(empty)
    setPage(1)
  }

  const hasFilter = applied.action || applied.dateFrom || applied.dateTo || applied.tenantId
  const selectCls = 'bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Audit Logs</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Platform-wide activity trail — who did what and when</p>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex gap-2 flex-wrap items-end">
        {/* Action dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Action</label>
          <select
            value={draft.action}
            onChange={e => setDraft(p => ({ ...p, action: e.target.value }))}
            className={`${selectCls} w-52`}
          >
            <option value="">All actions</option>
            {ACTION_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.actions.map(a => (
                  <option key={a} value={a}>{humanizeAction(a)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Tenant dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Business</label>
          <select
            value={draft.tenantId}
            onChange={e => setDraft(p => ({ ...p, tenantId: e.target.value }))}
            className={`${selectCls} w-48`}
          >
            <option value="">All businesses</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">From</label>
          <input type="date" value={draft.dateFrom} onChange={e => setDraft(p => ({ ...p, dateFrom: e.target.value }))} className={selectCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">To</label>
          <input type="date" value={draft.dateTo} onChange={e => setDraft(p => ({ ...p, dateTo: e.target.value }))} className={selectCls} />
        </div>
        <div className="flex gap-2 self-end">
          <Btn size="sm" onClick={applyFilters}>Apply</Btn>
          {hasFilter && <Btn variant="secondary" size="sm" onClick={clearFilters}>Clear</Btn>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : error ? (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">Failed to load audit logs.</p>
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <Empty title="No audit logs found" subtitle="Try adjusting your filters" />
        ) : (
          <div className="max-w-5xl space-y-2">
            {(data?.items ?? []).map(log => <LogRow key={log.id} log={log} />)}

            {(data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
