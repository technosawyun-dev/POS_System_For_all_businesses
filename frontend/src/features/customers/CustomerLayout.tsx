import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn, fmt } from '@/lib/utils'
import { Spinner, Badge } from '@/components/ui'
import { IconChevLeft, IconUser } from '@/components/icons'
import { customersService } from '@/services/customers/customers.service'

const TABS = [
  { to: '',          end: true,  label: 'Overview'  },
  { to: 'ledger',               label: 'Ledger'    },
  { to: 'payments',             label: 'Payments'  },
  { to: 'statements',           label: 'Statement' },
]

export default function CustomerLayout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Customer not found.
      </div>
    )
  }

  const balance = parseFloat(customer.balance)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Customer header */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 pt-4 pb-0">
        {/* Back row + info */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/app/customers')}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
            aria-label="Back to customers"
          >
            <IconChevLeft width="16" height="16" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
            <IconUser width="16" height="16" className="text-zinc-400" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-zinc-100 truncate">{customer.name}</h1>
              <Badge variant={customer.is_active ? 'success' : 'default'} size="xs" dot>
                {customer.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 truncate">
              {customer.phone}{customer.email ? ` · ${customer.email}` : ''}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Balance</p>
            <p className={cn('font-mono font-bold text-base leading-tight', balance > 0 ? 'text-amber-400' : 'text-zinc-500')}>
              {fmt(customer.balance)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <NavLink
              key={tab.label}
              to={tab.to === '' ? `/app/customers/${id}` : `/app/customers/${id}/${tab.to}`}
              end={tab.end}
              className={({ isActive }) => cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'text-amber-400 border-amber-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300',
              )}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Routed content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
