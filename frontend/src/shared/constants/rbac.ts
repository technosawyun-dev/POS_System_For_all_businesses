import type { UserRole } from '@/shared/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN:     'Super Admin',
  RESELLER:        'Reseller',
  BUSINESS_OWNER:  'Owner',
  MANAGER:         'Manager',
  INVENTORY_STAFF: 'Inventory',
  CASHIER:         'Cashier',
}

export const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN:     { bg: '#4C0519', text: '#FB7185', border: '#9F1239' },
  RESELLER:        { bg: '#431407', text: '#FB923C', border: '#9A3412' },
  BUSINESS_OWNER:  { bg: '#451A03', text: '#FBBF24', border: '#92400E' },
  MANAGER:         { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
  INVENTORY_STAFF: { bg: '#14532D', text: '#4ADE80', border: '#15803D' },
  CASHIER:         { bg: '#2E1065', text: '#A78BFA', border: '#6D28D9' },
}

// Which roles can access which app sections
const SECTION_ACCESS: Record<string, UserRole[]> = {
  dashboard:     ['CASHIER', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN', 'INVENTORY_STAFF'],
  pos:           ['CASHIER', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  products:      ['MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN', 'INVENTORY_STAFF'],
  inventory:     ['MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN', 'INVENTORY_STAFF'],
  sales:         ['CASHIER', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  customers:     ['CASHIER', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  procurement:              ['INVENTORY_STAFF', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  'procurement-payments':   ['MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  analytics:     ['MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  notifications: ['CASHIER', 'MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN', 'INVENTORY_STAFF'],
  settings:      ['MANAGER', 'BUSINESS_OWNER', 'SUPER_ADMIN'],
  subscription:  ['BUSINESS_OWNER', 'SUPER_ADMIN'],
}

export function canAccess(role: UserRole, section: string): boolean {
  if (role === 'SUPER_ADMIN') return true
  return (SECTION_ACCESS[section] ?? []).includes(role)
}

// Route groups by role
export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN:     '/super-admin/dashboard',
  RESELLER:        '/reseller/dashboard',
  BUSINESS_OWNER:  '/app/dashboard',
  MANAGER:         '/app/dashboard',
  CASHIER:         '/app/dashboard',
  INVENTORY_STAFF: '/app/dashboard',
}
