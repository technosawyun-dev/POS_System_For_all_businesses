import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getFormatterConfig } from '@/lib/formatterConfig'

export const TAX_RATE = 0.10

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Maps a currency code to the locale-aware display label. */
export function displayCurrency(code: string | undefined): string {
  const { currency } = getFormatterConfig()
  if (!code || code === 'MMK') return currency
  return code
}

export function fmt(amount: number | string | undefined): string {
  const { currency, locale } = getFormatterConfig()
  return `${Number(amount ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function fmtDate(date: Date | string): string {
  const { locale, timezone } = getFormatterConfig()
  return new Date(date).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone,
  })
}

export function fmtTime(date: Date | string): string {
  const { locale, timezone } = getFormatterConfig()
  return new Date(date).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit', timeZone: timezone,
  })
}

export function fmtDateTime(date: Date | string): string {
  return `${fmtDate(date)}, ${fmtTime(date)}`
}

export function timeAgo(date: Date | string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function extractApiMsg(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { response?: { data?: { error?: { message?: string }; detail?: string } }; message?: string }
  return e.response?.data?.error?.message ?? e.response?.data?.detail ?? e.message ?? null
}
