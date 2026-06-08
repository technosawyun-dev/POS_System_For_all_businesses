// Human-readable labels for all backend payment method values (including legacy aliases)
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  // Canonical enum values
  CASH:          'Cash',
  CARD:          'Physical Card',
  KPAY:          'KBZ Pay',
  WAVEPAY:       'Wave Money',
  AYA_PAY:       'AYA Pay',
  CB_PAY:        'CB Pay',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_PAYMENT:'Mobile Payment',
  STORE_CREDIT:  'Store Credit',
  // Legacy aliases (old data stored with different strings)
  KBZPAY:        'KBZ Pay',
  KBZ_PAY:       'KBZ Pay',
  WAVE_PAY:      'Wave Money',
  WAVEMONEY:     'Wave Money',
  AYAPAY:        'AYA Pay',
  CBPAY:         'CB Pay',
}

export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method
}

// Bank options for Bank Transfer payment method
export const BANK_TRANSFER_BANKS = [
  'KBZ Bank',
  'AYA Bank',
  'CB Bank',
  'Yoma Bank',
]

// Card / digital sub-method definitions for UI rendering
export const CARD_SUB_METHODS = [
  { id: 'KPAY',          label: 'KBZ Pay',      short: 'KPay',    bgClass: 'bg-sky-500/15 border-sky-500/40 text-sky-300',    dotClass: 'bg-sky-400' },
  { id: 'WAVEPAY',       label: 'Wave Money',   short: 'Wave',    bgClass: 'bg-orange-500/15 border-orange-500/40 text-orange-300', dotClass: 'bg-orange-400' },
  { id: 'AYA_PAY',       label: 'AYA Pay',      short: 'AYA',     bgClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',  dotClass: 'bg-amber-400' },
  { id: 'CB_PAY',        label: 'CB Pay',       short: 'CB',      bgClass: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300', dotClass: 'bg-indigo-400' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer', short: 'Bank',   bgClass: 'bg-teal-500/15 border-teal-500/40 text-teal-300',   dotClass: 'bg-teal-400' },
  { id: 'CARD',          label: 'Physical Card', short: 'Card',   bgClass: 'bg-blue-500/15 border-blue-500/40 text-blue-300',   dotClass: 'bg-blue-400' },
] as const
