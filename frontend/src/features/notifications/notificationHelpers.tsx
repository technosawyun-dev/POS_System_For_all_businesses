import { Badge } from '@/components/ui'

const TYPE_CONFIG: Record<string, {
  icon: string
  variant: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'orange'
  label: string
}> = {
  SYSTEM:       { icon: '⚙️',  variant: 'default',  label: 'System'       },
  INVENTORY:    { icon: '📦',  variant: 'warning',  label: 'Inventory'    },
  PROCUREMENT:  { icon: '🛒',  variant: 'info',     label: 'Procurement'  },
  CUSTOMER:     { icon: '👥',  variant: 'purple',   label: 'Customer'     },
  SUBSCRIPTION: { icon: '💳',  variant: 'orange',   label: 'Subscription' },
  SECURITY:     { icon: '🔐',  variant: 'danger',   label: 'Security'     },
}

const PRIORITY_CONFIG: Record<string, {
  variant: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'orange'
}> = {
  LOW:      { variant: 'default'  },
  MEDIUM:   { variant: 'info'     },
  HIGH:     { variant: 'warning'  },
  CRITICAL: { variant: 'danger'   },
}

export function NotificationTypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { icon: '🔔', variant: 'default' as const, label: type }
  return (
    <Badge variant={cfg.variant} size="xs">
      {cfg.icon} {cfg.label}
    </Badge>
  )
}

export function NotificationPriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { variant: 'default' as const }
  return <Badge variant={cfg.variant} size="xs">{priority}</Badge>
}

export function notificationTypeIcon(type: string): string {
  return TYPE_CONFIG[type]?.icon ?? '🔔'
}
