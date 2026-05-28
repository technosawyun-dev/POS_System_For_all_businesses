import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'


type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'orange'

const PO_STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  APPROVED:           { variant: 'info',    label: 'Ordered'          },
  PARTIALLY_RECEIVED: { variant: 'warning', label: 'Partial Receipt'  },
  RECEIVED:           { variant: 'success', label: 'Received'         },
  CANCELLED:          { variant: 'danger',  label: 'Cancelled'        },
}

const PAYABLE_STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  OPEN:    { variant: 'warning', label: 'Open'    },
  PARTIAL: { variant: 'info',    label: 'Partial' },
  PAID:    { variant: 'success', label: 'Paid'    },
}

const SUPPLIER_STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  ACTIVE:   { variant: 'success', label: 'Active'   },
  INACTIVE: { variant: 'default', label: 'Inactive' },
  BLOCKED:  { variant: 'danger',  label: 'Blocked'  },
}

export function POStatusBadge({ status }: { status: string }) {
  const m = PO_STATUS_MAP[status] ?? { variant: 'default' as BadgeVariant, label: status }
  return <Badge variant={m.variant} size="xs" dot>{m.label}</Badge>
}

export function PayableStatusBadge({ status }: { status: string }) {
  const m = PAYABLE_STATUS_MAP[status] ?? { variant: 'default' as BadgeVariant, label: status }
  return <Badge variant={m.variant} size="xs" dot>{m.label}</Badge>
}

export function SupplierStatusBadge({ status }: { status: string }) {
  const m = SUPPLIER_STATUS_MAP[status] ?? { variant: 'default' as BadgeVariant, label: status }
  return <Badge variant={m.variant} size="xs" dot>{m.label}</Badge>
}


export function inputCls(err = false) {
  return cn(
    'w-full bg-zinc-900 border rounded-xl text-zinc-100 placeholder-zinc-600 text-sm',
    'focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all duration-150 py-2.5 px-3',
    err ? 'border-red-500 focus:border-red-500' : 'border-zinc-700 focus:border-amber-500',
  )
}

export function FormField({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
