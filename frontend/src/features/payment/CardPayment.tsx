import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { fmt, cn } from '@/lib/utils'
import { CARD_SUB_METHODS, BANK_TRANSFER_BANKS } from '@/lib/paymentMethod'

interface CardPaymentProps {
  total: number
  onProcess: () => void
}

export default function CardPayment({ total, onProcess }: CardPaymentProps) {
  const cardSubMethod      = useCartStore(s => s.cardSubMethod)
  const setCardSubMethod   = useCartStore(s => s.setCardSubMethod)
  const bankTransferBank   = useCartStore(s => s.bankTransferBank)
  const setBankTransferBank = useCartStore(s => s.setBankTransferBank)

  const [showCustomBank, setShowCustomBank] = useState(false)
  const [customBankInput, setCustomBankInput] = useState('')

  const selected = CARD_SUB_METHODS.find(m => m.id === cardSubMethod) ?? CARD_SUB_METHODS[0]
  const isBankTransfer = cardSubMethod === 'BANK_TRANSFER'
  const canProcess = !isBankTransfer || bankTransferBank.trim().length > 0

  function selectPresetBank(bank: string) {
    setBankTransferBank(bank)
    setShowCustomBank(false)
    setCustomBankInput('')
  }

  function activateCustomBank() {
    setShowCustomBank(true)
    setBankTransferBank(customBankInput)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Total */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Charge Amount</p>
        <p className="font-mono text-4xl font-bold text-zinc-100">{fmt(total)}</p>
      </div>

      {/* Sub-method selector */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Payment Method</p>
        <div className="grid grid-cols-3 gap-2">
          {CARD_SUB_METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setCardSubMethod(m.id)}
              className={cn(
                'h-12 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all border leading-tight text-center px-1',
                cardSubMethod === m.id
                  ? m.bgClass
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700',
              )}
            >
              {cardSubMethod === m.id && (
                <span className={cn('w-1.5 h-1.5 rounded-full mb-0.5 flex-shrink-0', m.dotClass)} />
              )}
              <span className="whitespace-normal">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bank selector — only shown when Bank Transfer is selected */}
      {isBankTransfer && (
        <div className="flex flex-col gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Select Bank</p>
          <div className="grid grid-cols-2 gap-1.5">
            {BANK_TRANSFER_BANKS.map(bank => (
              <button
                key={bank}
                onClick={() => selectPresetBank(bank)}
                className={cn(
                  'h-9 rounded-lg text-xs font-semibold transition-all border',
                  bankTransferBank === bank && !showCustomBank
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
                'h-9 rounded-lg text-xs font-semibold transition-all border col-span-2',
                showCustomBank
                  ? 'bg-amber-500/25 border-amber-500/70 text-amber-200 ring-1 ring-amber-500/30'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700',
              )}
            >
              Other Bank
            </button>
          </div>

          {/* Custom bank text input */}
          {showCustomBank && (
            <input
              type="text"
              autoFocus
              value={customBankInput}
              onChange={e => { setCustomBankInput(e.target.value); setBankTransferBank(e.target.value) }}
              placeholder="Type bank name…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder-zinc-600"
            />
          )}

          {bankTransferBank.trim() && (
            <p className="text-[10px] text-zinc-500 text-center">
              Bank: <span className="text-zinc-300 font-medium">{bankTransferBank}</span>
            </p>
          )}
        </div>
      )}

      {/* Process button */}
      <button
        onClick={onProcess}
        disabled={!canProcess}
        className={cn(
          'w-full h-12 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]',
          canProcess
            ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-900/30'
            : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed',
        )}
      >
        {canProcess
          ? `Pay ${fmt(total)} via ${selected.label}${isBankTransfer && bankTransferBank ? ` (${bankTransferBank})` : ''}`
          : 'Select a bank to continue'
        }
      </button>
    </div>
  )
}
