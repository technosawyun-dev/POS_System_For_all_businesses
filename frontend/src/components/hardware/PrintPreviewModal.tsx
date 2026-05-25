import { useState, useRef } from 'react'
import { ReceiptTemplate58mm } from '@/print/ReceiptTemplate58mm'
import { ReceiptTemplate80mm } from '@/print/ReceiptTemplate80mm'
import { Label40x30 } from '@/print/Label40x30'
import { Label50x30 } from '@/print/Label50x30'
import type { Receipt, Product } from '@/shared/types'

type ReceiptSize = '58mm' | '80mm'
type LabelSize = '40x30' | '50x30'


interface ReceiptPreviewProps {
  receipt: Receipt
  onClose: () => void
}

export function ReceiptPrintPreviewModal({ receipt, onClose }: ReceiptPreviewProps) {
  const [size, setSize] = useState<ReceiptSize>('80mm')
  const printAreaRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const area = printAreaRef.current
    if (!area) return
    const pageRule = size === '58mm'
      ? '@page { size: 58mm auto; margin: 0; }'
      : '@page { size: 80mm auto; margin: 0; }'
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Receipt ${receipt.receipt_number}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: white; }
${pageRule}
@media print { body { margin: 0; } }
</style></head>
<body>${area.innerHTML}</body></html>`
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) { alert('Allow pop-ups to enable printing.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Print Preview</h2>
            <p className="text-xs text-zinc-500">{receipt.receipt_number}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">×</button>
        </div>

        {/* Size selector */}
        <div className="flex gap-2 px-5 py-3 border-b border-zinc-800 flex-shrink-0">
          {(['58mm', '80mm'] as ReceiptSize[]).map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                size === s ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {s} paper
            </button>
          ))}
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-5 flex justify-center bg-zinc-900/50">
          <div ref={printAreaRef} className="shadow-lg">
            {size === '58mm'
              ? <ReceiptTemplate58mm receipt={receipt} />
              : <ReceiptTemplate80mm receipt={receipt} />
            }
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors"
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}


interface LabelPreviewProps {
  product: Product
  businessName?: string
  quantity?: number
  onClose: () => void
}

export function LabelPrintPreviewModal({ product, businessName, quantity = 1, onClose }: LabelPreviewProps) {
  const [size, setSize]     = useState<LabelSize>('50x30')
  const [qty, setQty]       = useState(quantity)
  const [showPrice, setShowPrice] = useState(true)
  const printAreaRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const area = printAreaRef.current
    if (!area) return
    const [w, h] = size.split('x')
    const pageRule = `@page { size: ${w}mm ${h}mm; margin: 0; }`
    const labelHtml = area.querySelector('.label-instance')?.outerHTML ?? area.innerHTML
    const labels = Array(qty).fill(labelHtml).join('')
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Label ${product.sku}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: white; }
${pageRule}
@media print { body { margin: 0; } .label-instance { page-break-after: always; } .label-instance:last-child { page-break-after: auto; } }
img { max-width: 100%; display: block; }
</style></head>
<body>${labels}</body></html>`
    const win = window.open('', '_blank', 'width=300,height=400')
    if (!win) { alert('Allow pop-ups to enable printing.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 500)
  }

  const LabelComponent = size === '40x30' ? Label40x30 : Label50x30

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Print Label</h2>
            <p className="text-xs text-zinc-500">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">×</button>
        </div>

        {/* Options */}
        <div className="px-5 py-3 border-b border-zinc-800 flex flex-wrap gap-3 flex-shrink-0">
          <div className="flex gap-2">
            {(['40x30', '50x30'] as LabelSize[]).map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  size === s ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
              >
                {s}mm
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Qty:</label>
            <input
              type="number"
              min={1}
              max={100}
              value={qty}
              onChange={e => setQty(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-14 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs text-center"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={e => setShowPrice(e.target.checked)}
              className="accent-amber-500"
            />
            Show price
          </label>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-5 flex justify-center items-start bg-zinc-900/50">
          <div ref={printAreaRef} className="shadow-lg">
            <div className="label-instance">
              <LabelComponent
                product={product}
                businessName={businessName}
                showPrice={showPrice}
              />
            </div>
          </div>
        </div>

        {qty > 1 && (
          <p className="text-center text-xs text-zinc-600 pb-2">
            {qty} labels will print
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors"
          >
            Print {qty > 1 ? `${qty} Labels` : 'Label'}
          </button>
        </div>
      </div>
    </div>
  )
}
