interface StockBarProps {
  available: number
  sold?: number
  reorderPoint?: number
}

export default function StockBar({ available, sold = 0, reorderPoint = 10 }: StockBarProps) {
  const isOut = available === 0
  const isLow = available > 0 && available <= reorderPoint

  const total = available + sold
  const availablePct = total > 0 ? (available / total) * 100 : 0
  const soldPct      = total > 0 ? (sold      / total) * 100 : 0

  const availColor = isOut ? 'bg-zinc-700' : isLow ? 'bg-amber-500' : 'bg-green-500'
  const textColor  = isOut ? 'text-zinc-500' : isLow ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="flex items-center gap-2.5 w-full">
      {/* Bar track */}
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
        {/* Available segment — left */}
        <div
          className={`h-full transition-all duration-300 ${availColor}`}
          style={{ width: `${availablePct}%` }}
        />
        {/* Sold segment — right */}
        {soldPct > 0 && (
          <div
            className="h-full bg-zinc-900 transition-all duration-300"
            style={{ width: `${soldPct}%` }}
          />
        )}
      </div>
      {/* Available count label */}
      <span className={`text-xs font-mono font-semibold w-8 text-right flex-shrink-0 ${textColor}`}>
        {available}
      </span>
    </div>
  )
}
