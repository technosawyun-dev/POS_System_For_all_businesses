import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getFormatterConfig } from '@/lib/formatterConfig'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const TAX_RATE = 0.10

/** Maps a currency code to the locale-aware display label from formatterConfig. */
export function displayCurrency(code: string | undefined): string {
  const { currency } = getFormatterConfig()
  if (!code || code === 'MMK') return currency
  return code
}

export function fmt(amount: number | string | undefined): string {
  const { currency } = getFormatterConfig()
  return `${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function fmtTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
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
