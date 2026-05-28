import { fmt } from '@/lib/utils'
import { ProductBarcodeCard } from '@/components/hardware/ProductBarcodeCard'
import type { Product } from '@/shared/types'

interface Props {
  product: Product
  businessName?: string
  showPrice?: boolean
}

// 40mm × 30mm product label — fits standard small label printers (Dymo, Niimbot, etc.)
// Use @page { size: 40mm 30mm; margin: 0 }
export function Label40x30({ product, businessName, showPrice = true }: Props) {
  return (
    <div
      className="print-sheet"
      style={{
        width: '40mm',
        height: '30mm',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        fontSize: '8px',
        color: '#000',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '2mm',
        padding: '1.5mm',
      }}
    >
      {/* Barcode */}
      <div style={{ flexShrink: 0 }}>
        <ProductBarcodeCard product={product} compact showPrice={false} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {businessName && (
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {businessName}
          </div>
        )}
        <div style={{
          fontWeight: 'bold',
          fontSize: '9px',
          lineHeight: '1.2',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {product.name}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '7px', color: '#555', marginTop: '1px' }}>
          {product.sku}
        </div>
        {showPrice && (
          <div style={{ fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}>
            {fmt(parseFloat(product.selling_price))}
          </div>
        )}
      </div>
    </div>
  )
}
