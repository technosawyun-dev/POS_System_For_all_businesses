import { useEffect, useState, forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { IconX } from '@/components/icons'

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Badge
type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'orange'
type BadgeSize = 'xs' | 'sm' | 'md'

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-green-950 text-green-400 border-green-800',
  danger:  'bg-red-950 text-red-400 border-red-800',
  warning: 'bg-amber-950 text-amber-400 border-amber-800',
  info:    'bg-blue-950 text-blue-400 border-blue-800',
  purple:  'bg-violet-950 text-violet-400 border-violet-800',
  orange:  'bg-orange-950 text-orange-400 border-orange-800',
}
const BADGE_SIZES: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-px text-[10px] gap-1',
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
}
const DOT_COLORS: Record<BadgeVariant, string> = {
  default: '#A1A1AA', success: '#4ADE80', danger: '#F87171',
  warning: '#FBBF24', info: '#60A5FA', purple: '#A78BFA', orange: '#FB923C',
}

export function Badge({ children, variant = 'default', size = 'sm', dot = false }: {
  children: ReactNode; variant?: BadgeVariant; size?: BadgeSize; dot?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border font-medium', BADGE_VARIANTS[variant], BADGE_SIZES[size])}>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: DOT_COLORS[variant] }} />}
      {children}
    </span>
  )
}

// Button
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
type BtnSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:   'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold shadow-lg shadow-amber-900/30',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-100 border border-zinc-700',
  ghost:     'hover:bg-zinc-800 active:bg-zinc-700 text-zinc-400 hover:text-zinc-100',
  danger:    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold',
  success:   'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold',
  outline:   'border border-zinc-600 hover:border-zinc-400 text-zinc-200 hover:bg-zinc-800',
}
const BTN_SIZES: Record<BtnSize, string> = {
  xs: 'px-2.5 py-1 text-xs h-7 rounded-lg',
  sm: 'px-3 py-1.5 text-sm h-9 rounded-lg',
  md: 'px-4 py-2 text-sm h-10 rounded-xl',
  lg: 'px-5 py-3 text-base h-12 rounded-xl',
  xl: 'px-6 py-3.5 text-base h-14 rounded-xl',
}

export function Btn({ children, variant = 'primary', size = 'md', fullWidth = false, loading = false, className = '', ...rest }: {
  variant?: BtnVariant; size?: BtnSize; fullWidth?: boolean; loading?: boolean; className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 select-none',
        BTN_VARIANTS[variant], BTN_SIZES[size],
        fullWidth && 'w-full',
        (rest.disabled || loading) && 'opacity-40 cursor-not-allowed pointer-events-none',
        className,
      )}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </>
      ) : children}
    </button>
  )
}

// Input
export function Input({ label, prefix, suffix, className = '', ...rest }: {
  label?: string; prefix?: ReactNode; suffix?: ReactNode; className?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const inputId = rest.id ?? (rest.name ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined))
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label htmlFor={inputId} className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-zinc-500 pointer-events-none flex items-center">{prefix}</span>}
        <input
          id={inputId}
          className={cn(
            'w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600',
            'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all duration-150',
            'py-2.5 text-sm',
            prefix ? 'pl-9' : 'px-3',
            suffix ? 'pr-9' : 'pr-3',
            rest.readOnly && 'cursor-default',
          )}
          {...rest}
        />
        {suffix && <span className="absolute right-3 text-zinc-500 pointer-events-none flex items-center">{suffix}</span>}
      </div>
    </div>
  )
}

// PasswordInput
export const PasswordInput = forwardRef<HTMLInputElement, {
  label?: string; className?: string; inputClassName?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ label, className = '', inputClassName = '', ...rest }, ref) {
    const [show, setShow] = useState(false)
    const inputId = rest.id ?? (rest.name ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined))

    const field = (
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={inputId}
          type={show ? 'text' : 'password'}
          className={cn(
            !inputClassName && [
              'w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600',
              'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all duration-150',
              'py-2.5 text-sm px-3',
            ],
            inputClassName,
            'pr-10',
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    )

    if (!label) return field

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={inputId} className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
        {field}
      </div>
    )
  }
)

// Modal
const MODAL_SIZES: Record<string, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md', noPad = false }: {
  open: boolean; onClose?: () => void; title?: string; children: ReactNode; size?: string; noPad?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fadeIn', MODAL_SIZES[size] ?? 'max-w-md')}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
              <IconX width="14" height="14" />
            </button>
          </div>
        )}
        <div className={cn('overflow-y-auto flex-1', !noPad && 'p-6')}>{children}</div>
      </div>
    </div>
  )
}

// Spinner
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// Empty state
export function Empty({ icon, title, subtitle, action }: {
  icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="mb-4 opacity-20 text-zinc-400">{icon}</div>}
      <p className="text-zinc-400 font-medium text-sm">{title}</p>
      {subtitle && <p className="text-zinc-600 text-xs mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Kbd
export function Kbd({ keys }: { keys: string }) {
  return (
    <span className="inline-flex items-center gap-px">
      {keys.split('+').map((k, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="text-zinc-700 text-[10px] mx-0.5">+</span>}
          <kbd className="px-1.5 py-px text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-500">{k}</kbd>
        </span>
      ))}
    </span>
  )
}

// StockBadge
export function StockBadge({ stock, reorder = 10 }: { stock: number; reorder?: number }) {
  if (stock === 0) return <Badge variant="danger" dot>Out of stock</Badge>
  if (stock <= reorder) return <Badge variant="warning" dot>Low: {stock}</Badge>
  return <Badge variant="success" dot>{stock} in stock</Badge>
}

// StatCard
export function StatCard({ label, value, sub, accent = false, icon }: {
  label: string; value: ReactNode; sub?: string; accent?: boolean; icon?: ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border p-4 flex flex-col gap-1', accent ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-900 border-zinc-800')}>
      <div className="flex items-start justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-zinc-600">{icon}</span>}
      </div>
      <p className={cn('font-mono text-2xl font-bold tracking-tight', accent ? 'text-amber-400' : 'text-zinc-100')}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

// Divider
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-zinc-800 my-1" />
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 border-t border-zinc-800" />
      <span className="text-xs text-zinc-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 border-t border-zinc-800" />
    </div>
  )
}

// SectionHeader
export function SectionHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
      <div>
        <h2 className="font-semibold text-zinc-100 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 mt-0.5">{action}</div>}
    </div>
  )
}

// Table
export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
export function Th({ children, right = false }: { children?: ReactNode; right?: boolean }) {
  return <th className={cn('px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-800 whitespace-nowrap', right ? 'text-right' : 'text-left')}>{children}</th>
}
export function Td({ children, right = false, muted = false, mono = false, className = '' }: {
  children?: ReactNode; right?: boolean; muted?: boolean; mono?: boolean; className?: string
}) {
  return <td className={cn('px-4 py-3 border-b border-zinc-900', right && 'text-right', muted ? 'text-zinc-500' : 'text-zinc-200', mono && 'font-mono', className)}>{children}</td>
}
