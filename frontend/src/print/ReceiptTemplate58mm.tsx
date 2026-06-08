import { fmt, fmtDateTime } from '@/lib/utils'
import { getPaymentMethodLabel } from '@/lib/paymentMethod'
import type { Receipt } from '@/shared/types'

interface Props {
  receipt: Receipt
  footer?: string
  logoUrl?: string | null
  taxInclusive?: boolean
  taxName?: string
  showTaxOnReceipt?: boolean
}

// 58mm thermal receipt — suitable for most small desktop POS printers.
// Width ~380px equivalent; use @page { size: 58mm auto }.
export function ReceiptTemplate58mm({ receipt, footer = 'Thank you for your purchase!', logoUrl, taxInclusive = false, taxName = 'Tax', showTaxOnReceipt = true }: Props) {
  return (
    <div
      className="print-sheet"
      style={{
        width: '58mm',
        minHeight: '1mm',
        fontFamily: "'Courier New', monospace",
        fontSize: '10px',
        color: '#000',
        backgroundColor: '#fff',
        padding: '3mm 2mm',
        lineHeight: '1.4',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt="logo"
            style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 4px' }}
          />
        )}
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{receipt.tenant_name}</div>
        <div>{receipt.branch_name}</div>
        <div style={{ fontSize: '9px', color: '#555' }}>{fmtDateTime(receipt.issued_at)}</div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Receipt number */}
      <div style={{ textAlign: 'center', fontSize: '9px', marginBottom: '4px' }}>
        Receipt: {receipt.receipt_number}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Items */}
      {receipt.items_snapshot.map((item, i) => (
        <div key={i} style={{ marginBottom: '2px' }}>
          <div style={{ fontWeight: '600' }}>{item.product_name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>  {item.quantity} × {fmt(parseFloat(item.unit_price))}</span>
            <span>{fmt(parseFloat(item.total))}</span>
          </div>
        </div>
      ))}

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Totals */}
      <div>
        <Row
          label="Subtotal"
          value={fmt(parseFloat(taxInclusive ? receipt.total_amount : receipt.subtotal))}
        />
        {parseFloat(receipt.discount_amount) > 0 && (
          <Row label="Discount" value={`-${fmt(parseFloat(receipt.discount_amount))}`} />
        )}
        {showTaxOnReceipt && parseFloat(receipt.tax_amount) > 0 && (
          <Row label={taxInclusive ? `${taxName} (incl.)` : taxName} value={fmt(parseFloat(receipt.tax_amount))} />
        )}
        <div style={{ borderTop: '1px solid #000', margin: '3px 0' }} />
        <Row label="TOTAL" value={fmt(parseFloat(receipt.total_amount))} bold />
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Payment */}
      {receipt.payment_methods.map((pm, i) => (
        <Row
          key={i}
          label={`${getPaymentMethodLabel(pm.method ?? '')}${pm.notes ? ` (${pm.notes})` : ''}`}
          value={fmt(parseFloat(pm.amount))}
        />
      ))}
      {parseFloat(receipt.amount_paid) > parseFloat(receipt.total_amount) && (
        <>
          <Row label="Tendered" value={fmt(parseFloat(receipt.amount_paid))} />
          <Row label="Change" value={fmt(parseFloat(receipt.change_amount))} />
        </>
      )}

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '9px', color: '#555' }}>
        <div>Cashier: {receipt.cashier_name}</div>
        <div style={{ marginTop: '4px' }}>{footer}</div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 'bold' : 'normal' }}>
      <span style={{ textTransform: 'capitalize' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
