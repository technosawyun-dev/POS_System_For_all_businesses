import { useMemo } from 'react'
import { toast } from 'sonner'
import { barcodeService } from '@/services/barcode/barcode.service'
import { fmt } from '@/lib/utils'
import type { Product } from '@/shared/types'

interface ProductBarcodeCardProps {
  product: Product
  showPrice?: boolean
  compact?: boolean
}

export function ProductBarcodeCard({ product, showPrice = true, compact = false }: ProductBarcodeCardProps) {
  // Use barcode if present, otherwise fall back to SKU
  const value   = (product.barcode || product.sku).trim()
  const dataUrl = useMemo(() => {
    try { return barcodeService.generateDataUrl(value) } catch { return null }
  }, [value])

  function handleDownload() {
    try {
      barcodeService.download(value, product.sku)
      toast.success('Barcode downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  async function handleCopy() {
    try {
      await barcodeService.copyToClipboard(value)
      toast.success('Barcode number copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        {dataUrl
          ? <img src={dataUrl} alt={`Barcode for ${product.sku}`} className="h-14 rounded border border-zinc-700 bg-white px-1" />
          : <div className="h-14 w-28 rounded border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">No barcode</div>
        }
        <p className="text-xs font-mono text-zinc-400">{value}</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-3">
      {dataUrl
        ? (
          <div className="bg-white rounded-xl p-3 shadow-sm w-full">
            <img src={dataUrl} alt={`Barcode for ${product.sku}`} className="w-full block" />
          </div>
        ) : (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 w-full text-center text-zinc-500 text-sm">
            Cannot generate barcode for this value
          </div>
        )
      }

      <div className="text-center">
        <p className="text-sm font-semibold text-zinc-100 leading-tight">{product.name}</p>
        <p className="text-xs font-mono text-zinc-400 mt-0.5">{value}</p>
        {showPrice && (
          <p className="text-sm font-bold text-amber-400 mt-1">
            {fmt(parseFloat(product.selling_price))}
          </p>
        )}
      </div>

      <div className="flex gap-2 w-full">
        <button onClick={handleDownload}
          className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
          Download
        </button>
        <button onClick={handleCopy}
          className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
          Copy Number
        </button>
      </div>
    </div>
  )
}
