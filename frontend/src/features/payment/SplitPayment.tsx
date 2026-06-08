import { useState } from 'react'
import type { SplitPayment as SplitPaymentType } from '@/types'
import type { CardSubMethod } from '@/types'
import { fmt, cn } from '@/lib/utils'
import { CARD_SUB_METHODS, BANK_TRANSFER_BANKS, getPaymentMethodLabel } from '@/lib/paymentMethod'
import { IconCash, IconX, IconPlus } from '@/components/icons'

type SplitMethod = 'cash' | CardSubMethod

interface SplitPaymentProps {
  total: number
  splitPayments: SplitPaymentType[]
  onAdd: (p: SplitPaymentType) => void
  onRemove: (i: number) => void
  onProcess: () => void
}

const ALL_METHODS: { id: SplitMethod; label: string; activeClass: string }[] = [
  { id: 'cash',          label: 'Cash',          activeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  { id: 'KPAY',          label: 'KBZ Pay',        activeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-300' },
  { id: 'WAVEPAY',       label: 'Wave Money',     activeClass: 'bg-orange-500/15 border-orange-500/40 text-orange-300' },
  { id: 'AYA_PAY',       label: 'AYA Pay',        activeClass: 'bg-amber-600/15 border-amber-600/40 text-amber-400' },
  { id: 'CB_PAY',        label: 'CB Pay',         activeClass: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer',  activeClass: 'bg-teal-500/15 border-teal-500/40 text-teal-300' },
  { id: 'CARD',          label: 'Physical Card',  activeClass: 'bg-blue-500/15 border-blue-500/40 text-blue-300' },
]

function methodLabel(method: SplitMethod): string {
  if (method === 'cash') return 'Cash'
  return getPaymentMethodLabel(method)
}

export default function SplitPayment({ total, splitPayments, onAdd, onRemove, onProcess }: SplitPaymentProps) {
  const [addMethod, setAddMethod]       = useState<SplitMethod>('cash')
  const [addAmount, setAddAmount]       = useState('')
  const [bankName, setBankName]         = useState('')
  const [showCustomBank, setShowCustomBank] = useState(false)
  const [customBankInput, setCustomBankInput] = useState('')

  const paid         = splitPayments.reduce((s, p) => s + p.amount, 0)
  const remaining    = Math.max(0, total - paid)
  const progressPct  = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const fullyCovered = paid >= total

  const isBankTransfer = addMethod === 'BANK_TRANSFER'
  const canAdd = addAmount && parseFloat(addAmount) > 0 && (!isBankTransfer || bankName.trim().length > 0)

  function selectMethod(m: SplitMethod) {
    setAddMethod(m)
    setBankName('')
    setShowCustomBank(false)
    setCustomBankInput('')
  }

  function selectPresetBank(bank: string) {
    setBankName(bank)
    setShowCustomBank(false)
    setCustomBankInput('')
  }

  function activateCustomBank() {
    setShowCustomBank(true)
    setBankName(customBankInput)
  }

  function handleAdd() {
    const val = parseFloat(addAmount)
    if (isNaN(val) || val <= 0) return
    if (isBankTransfer && !bankName.trim()) return
    onAdd({ method: addMethod, amount: val, notes: isBankTransfer ? bankName.trim() : undefined })
    setAddAmount('')
    setBankName('')
    setShowCustomBank(false)
    setCustomBankInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Total</span>
          <span className="font-mono text-zinc-100 font-semibold">{fmt(total)}</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-400 font-mono">{fmt(paid)} paid</span>
          <span className={cn('font-mono font-semibold', remaining > 0 ? 'text-red-400' : 'text-green-400')}>
            {remaining > 0 ? `${fmt(remaining)} left` : 'Fully covered'}
          </span>
        </div>
      </div>

      {/* Added payments list */}
      {splitPayments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {splitPayments.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              <span className="text-zinc-500">
                {p.method === 'cash' ? <IconCash width="14" height="14" /> : <span className="text-[10px] font-bold">$</span>}
              </span>
              <span className="text-xs text-zinc-400">
                {methodLabel(p.method as SplitMethod)}
                {p.notes && <span className="text-zinc-600"> · {p.notes}</span>}
              </span>
              <span className="flex-1 text-right font-mono text-sm font-semibold text-zinc-100">{fmt(p.amount)}</span>
              <button
                onClick={() => onRemove(i)}
                className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-950/50 transition-colors"
              >
                <IconX width="11" height="11" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add payment section */}
      {!fullyCovered && (
        <div className="flex flex-col gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          {/* Method grid — 4 columns, full label names */}
          <div className="grid grid-cols-4 gap-1.5">
            {ALL_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => selectMethod(m.id)}
                className={cn(
                  'h-11 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all border leading-tight text-center px-0.5',
                  addMethod === m.id
                    ? m.activeClass
                    : 'bg-zinc-800 border-zinc-800 text-zinc-500 hover:text-zinc-300',
                )}
              >
                {m.id === 'cash' ? <IconCash width="13" height="13" /> : null}
                <span className="whitespace-normal">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Bank sub-selector — only when Bank Transfer is chosen */}
          {isBankTransfer && (
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Select Bank</p>
              <div className="grid grid-cols-2 gap-1">
                {BANK_TRANSFER_BANKS.map(bank => (
                  <button
                    key={bank}
                    onClick={() => selectPresetBank(bank)}
                    className={cn(
                      'h-8 rounded-lg text-[11px] font-semibold transition-all border',
                      bankName === bank && !showCustomBank
                        ? 'bg-amber-500/25 border-amber-500/70 text-amber-200 ring-1 ring-amber-500/30'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700',
                    )}
                  >
                    {bank}
                  </button>
                ))}
                <button
                  onClick={activateCustomBank}
                  className={cn(
                    'h-8 rounded-lg text-[11px] font-semibold transition-all border col-span-2',
                    showCustomBank
                      ? 'bg-amber-500/25 border-amber-500/70 text-amber-200 ring-1 ring-amber-500/30'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700',
                  )}
                >
                  Other Bank
                </button>
              </div>
              {showCustomBank && (
                <input
                  type="text"
                  autoFocus
                  value={customBankInput}
                  onChange={e => { setCustomBankInput(e.target.value); setBankName(e.target.value) }}
                  placeholder="Type bank name…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-1.5
                    focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder-zinc-600"
                />
              )}
            </div>
          )}

          {/* Amount input + Add */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-sm pointer-events-none">K</span>
              <input
                type="number"
                min={0}
                step="1"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={remaining.toFixed(0)}
                className={cn(
                  'w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 font-mono text-sm',
                  'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all',
                  'py-2 pl-6 pr-3',
                )}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="h-10 px-4 rounded-xl bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-zinc-100 text-sm font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconPlus width="13" height="13" />
              Add
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center">
            Adding as: <span className="text-zinc-400">{methodLabel(addMethod)}{bankName ? ` · ${bankName}` : ''}</span>
            {isBankTransfer && !bankName && <span className="text-amber-600"> — select a bank</span>}
          </p>
        </div>
      )}

      {/* Process button */}
      <button
        onClick={onProcess}
        disabled={!fullyCovered}
        className={`
          w-full h-12 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
          ${fullyCovered
            ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/30'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
          }
        `}
      >
        {fullyCovered ? 'Process Split Payment' : `${fmt(remaining)} remaining`}
      </button>
    </div>
  )
}
