import { fmt } from '@/lib/utils'
import { ProductBarcodeCard } from '@/components/hardware/ProductBarcodeCard'
import type { Product } from '@/shared/types'

interface Props {
  product: Product
  businessName?: string
  showPrice?: boolean
}

// 50mm × 30mm product label — slightly wider, better for longer product names.
// Use @page { size: 50mm 30mm; margin: 0 }
export function Label50x30({ product, businessName, showPrice = true }: Props) {
  return (
    <div
      className="print-sheet"
      style={{
        width: '50mm',
        height: '30mm',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        fontSize: '8px',
        color: '#000',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '3mm',
        padding: '2mm',
      }}
    >
      {/* Barcode */}
      <div style={{ flexShrink: 0 }}>
        <ProductBarcodeCard product={product} compact showPrice={false} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1.5px' }}>
        {businessName && (
          <div style={{ fontSize: '7px', color: '#777', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {businessName}
          </div>
        )}
        <div style={{
          fontWeight: 'bold',
          fontSize: '10px',
          lineHeight: '1.25',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {product.name}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#555' }}>
          {product.sku}
        </div>
        {showPrice && (
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
            {fmt(parseFloat(product.selling_price))}
          </div>
        )}
      </div>
    </div>
  )
}
