import { fmt } from '@/lib/utils'
import { getFormatterConfig } from '@/lib/formatterConfig'
import NumPad from '@/features/payment/NumPad'
import QuickBills from '@/features/payment/QuickBills'

interface CashPaymentProps {
  total: number
  amount: string
  onAmountChange: (v: string) => void
  onProcess: () => void
}

export default function CashPayment({ total, amount, onAmountChange, onProcess }: CashPaymentProps) {
  const tendered = parseFloat(amount) || 0
  const change = tendered - total
  const canProcess = tendered >= total && tendered > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Amount display */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Amount Tendered</p>
        <p className="font-mono text-3xl font-bold text-right text-zinc-100">
          {amount
            ? `${getFormatterConfig().currency} ${amount}`
            : <span className="text-zinc-700">{fmt(0)}</span>
          }
        </p>

        {/* Change / insufficient */}
        {amount !== '' && tendered > 0 && (
          <div className="mt-2 text-right">
            {change >= 0 ? (
              <p className="text-green-400 font-mono text-lg font-semibold">
                Change: {fmt(change)}
              </p>
            ) : (
              <p className="text-red-400 text-xs font-medium">
                Insufficient — need {fmt(Math.abs(change))} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick bills */}
      <QuickBills total={total} onSelect={onAmountChange} />

      {/* NumPad */}
      <NumPad value={amount} onChange={onAmountChange} />

      {/* Process button */}
      <button
        onClick={onProcess}
        disabled={!canProcess}
        className={`
          w-full h-12 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
          ${canProcess
            ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/30'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
          }
        `}
      >
        {canProcess ? `Process ${fmt(total)}` : 'Enter Amount'}
      </button>
    </div>
  )
}
