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

// 80mm thermal receipt — standard width for most full-size POS printers.
// Width ~530px equivalent; use @page { size: 80mm auto }.
export function ReceiptTemplate80mm({ receipt, footer = 'Thank you for your purchase!', logoUrl, taxInclusive = false, taxName = 'Tax', showTaxOnReceipt = true }: Props) {
  return (
    <div
      className="print-sheet"
      style={{
        width: '80mm',
        minHeight: '1mm',
        fontFamily: "'Courier New', monospace",
        fontSize: '11px',
        color: '#000',
        backgroundColor: '#fff',
        padding: '4mm 3mm',
        lineHeight: '1.5',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt="logo"
            style={{ maxHeight: '50px', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 6px' }}
          />
        )}
        <div style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
          {receipt.tenant_name}
        </div>
        <div style={{ fontSize: '12px' }}>{receipt.branch_name}</div>
        <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
          {fmtDateTime(receipt.issued_at)}
        </div>
      </div>

      <Divider />

      {/* Receipt number + cashier */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
        <span>Receipt: <strong>{receipt.receipt_number}</strong></span>
        <span>Cashier: {receipt.cashier_name}</span>
      </div>

      <Divider />

      {/* Column headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: '2px' }}>
        <span style={{ flex: 3 }}>ITEM</span>
        <span style={{ textAlign: 'center', flex: 1 }}>QTY</span>
        <span style={{ textAlign: 'right', flex: 1 }}>PRICE</span>
        <span style={{ textAlign: 'right', flex: 1 }}>TOTAL</span>
      </div>

      <Divider dashed />

      {/* Items */}
      {receipt.items_snapshot.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ flex: 3, fontWeight: '600', paddingRight: '4px', wordBreak: 'break-word' }}>{item.product_name}</span>
          <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{fmt(parseFloat(item.unit_price))}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{fmt(parseFloat(item.total))}</span>
        </div>
      ))}

      <Divider />

      {/* Totals */}
      <div style={{ paddingLeft: '40%' }}>
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
        <Divider />
        <Row label="TOTAL" value={fmt(parseFloat(receipt.total_amount))} bold large />
      </div>

      <Divider />

      {/* Payment methods */}
      <div style={{ paddingLeft: '30%' }}>
        {receipt.payment_methods.map((pm, i) => (
          <Row
            key={i}
            label={`${getPaymentMethodLabel(pm.method ?? '')}${pm.notes ? ` (${pm.notes})` : ''}`}
            value={fmt(parseFloat(pm.amount))}
          />
        ))}
        {parseFloat(receipt.amount_paid) > parseFloat(receipt.total_amount) && (
          <>
            <Divider dashed />
            <Row label="Tendered" value={fmt(parseFloat(receipt.amount_paid))} />
            <Row label="Change" value={fmt(parseFloat(receipt.change_amount))} bold />
          </>
        )}
      </div>

      <Divider />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '4px' }}>
        {footer}
      </div>
    </div>
  )
}

function Divider({ dashed }: { dashed?: boolean }) {
  return <div style={{ borderTop: `1px ${dashed ? 'dashed' : 'solid'} #999`, margin: '4px 0' }} />
}

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontWeight: bold ? 'bold' : 'normal',
      fontSize: large ? '13px' : 'inherit',
    }}>
      <span style={{ textTransform: 'capitalize', marginRight: '8px' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
