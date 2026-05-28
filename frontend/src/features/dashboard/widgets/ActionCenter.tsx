import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { canAccess } from '@/shared/constants/rbac'
import { notificationsService } from '@/services/notifications/notifications.service'
import { analyticsService } from '@/services/analytics/analytics.service'
import { procurementService } from '@/services/procurement/procurement.service'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { AlertPanel, type AlertItem } from './AlertPanel'
import { DashboardSection } from './DashboardSection'

export function ActionCenter() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const role = user?.role ?? 'CASHIER'

  const notifQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsService.getUnreadCount,
    enabled: !!user,
  })

  const lowStockQuery = useQuery({
    queryKey: ['analytics', 'low-stock'],
    queryFn: () => analyticsService.getLowStock(),
    enabled: !!user && canAccess(role, 'inventory'),
  })

  const procurementQuery = useQuery({
    queryKey: ['procurement', 'orders-pending-count'],
    queryFn: () => procurementService.listOrders({ status: 'PENDING', page: 1, page_size: 1 }),
    enabled: !!user && canAccess(role, 'procurement'),
  })

  const subQuery = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.getMySubscription,
    enabled: !!user && canAccess(role, 'subscription'),
  })

  const alerts: AlertItem[] = []

  const unread = notifQuery.data?.unread_count ?? 0
  if (unread > 0) {
    alerts.push({
      id: 'notifications',
      label: `${unread} unread notification${unread !== 1 ? 's' : ''}`,
      sub: 'Review your notification inbox',
      severity: unread > 5 ? 'warning' : 'info',
      action: { label: 'View', path: '/app/notifications' },
    })
  }

  const lowStockCount = lowStockQuery.data?.length ?? 0
  if (lowStockCount > 0) {
    alerts.push({
      id: 'low-stock',
      label: `${lowStockCount} product${lowStockCount !== 1 ? 's' : ''} below reorder point`,
      sub: 'Inventory needs attention',
      severity: lowStockCount > 10 ? 'critical' : 'warning',
      action: { label: 'Inventory', path: '/app/inventory' },
    })
  }

  const pendingPOs = procurementQuery.data?.total ?? 0
  if (pendingPOs > 0) {
    alerts.push({
      id: 'pending-po',
      label: `${pendingPOs} pending purchase order${pendingPOs !== 1 ? 's' : ''}`,
      sub: 'Awaiting approval or fulfillment',
      severity: 'info',
      action: { label: 'Procurement', path: '/app/procurement/purchase-orders' },
    })
  }

  const sub = subQuery.data
  if (sub?.status === 'TRIAL') {
    alerts.push({
      id: 'trial',
      label: 'Trial subscription active',
      sub: 'Upgrade to a paid plan to retain access after the trial ends',
      severity: 'warning',
      action: { label: 'Upgrade', path: '/app/subscription/current' },
    })
  } else if (sub?.plan?.is_referral_plan && sub.status === 'ACTIVE') {
    alerts.push({
      id: 'referral-plan',
      label: 'Free referral plan',
      sub: 'Upgrade to a paid plan to unlock all features',
      severity: 'info',
      action: { label: 'View Plans', path: '/app/subscription/current' },
    })
  } else if (sub?.status === 'EXPIRED') {
    alerts.push({
      id: 'sub-expired',
      label: 'Subscription has expired',
      sub: 'Renew your plan to restore full access',
      severity: 'critical',
      action: { label: 'Renew', path: '/app/subscription/current' },
    })
  } else if (sub?.status === 'SUSPENDED') {
    alerts.push({
      id: 'sub-suspended',
      label: 'Subscription is suspended',
      sub: 'Contact support or renew to restore access',
      severity: 'critical',
      action: { label: 'Subscription', path: '/app/subscription/current' },
    })
  }

  const isLoading = notifQuery.isLoading && lowStockQuery.isLoading

  return (
    <DashboardSection
      title="Action Center"
      action={
        alerts.length > 0
          ? { label: 'Notifications', onClick: () => navigate('/app/notifications') }
          : undefined
      }
    >
      <AlertPanel items={alerts} isLoading={isLoading} />
    </DashboardSection>
  )
}
