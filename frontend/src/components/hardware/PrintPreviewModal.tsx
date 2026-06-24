import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ReceiptTemplate58mm } from '@/print/ReceiptTemplate58mm'
import { ReceiptTemplate80mm } from '@/print/ReceiptTemplate80mm'
import { Label40x30 } from '@/print/Label40x30'
import { Label50x30 } from '@/print/Label50x30'
import type { Receipt, Product } from '@/shared/types'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'
import { thermalPrinterService } from '@/services/thermal/printer.service'
import { serialPrinterService } from '@/services/thermal/serial.service'
import apiClient from '@/app/lib/axios'

type ReceiptSize = '58mm' | '80mm'
type LabelSize = '40x30' | '50x30'

const RECEIPT_SIZE_KEY = 'pos_receipt_size'

// Icons (inline to avoid extra imports)
function IconUsb({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v8M9 5l3-3 3 3" />
      <path d="M7 10h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
      <path d="M10 18H7a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

function IconSerial({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <line x1="6" y1="11" x2="6" y2="13" />
      <line x1="10" y1="11" x2="10" y2="13" />
      <line x1="14" y1="11" x2="14" y2="13" />
      <line x1="18" y1="11" x2="18" y2="13" />
    </svg>
  )
}

// Receipt Modal

interface ReceiptPreviewProps {
  receipt: Receipt
  onClose: () => void
  autoTrigger?: boolean
}

export function ReceiptPrintPreviewModal({ receipt, onClose, autoTrigger = false }: ReceiptPreviewProps) {
  const [size, setSize] = useState<ReceiptSize>(
    () => (localStorage.getItem(RECEIPT_SIZE_KEY) as ReceiptSize) ?? '58mm'
  )
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Direct print state — USB (Mac/Linux) or Serial COM port (Windows)
  const [usbConnected,    setUsbConnected]    = useState(() => thermalPrinterService.isConnected)
  const [serialConnected, setSerialConnected] = useState(() => serialPrinterService.isConnected)
  const [directPrinting,  setDirectPrinting]  = useState(false)
  const [connecting,      setConnecting]      = useState(false)
  const usbSupported    = thermalPrinterService.isSupported
  const serialSupported = serialPrinterService.isSupported
  const anyConnected    = usbConnected || serialConnected
  const directSupported = usbSupported || serialSupported

  // Auto-reconnect previously-granted printer when modal opens (no picker shown)
  useEffect(() => {
    if (anyConnected) return
    let cancelled = false
    ;(async () => {
      const usb = await thermalPrinterService.autoReconnect()
      if (cancelled) return
      if (usb) { setUsbConnected(true); return }
      const serial = await serialPrinterService.autoReconnect()
      if (!cancelled && serial) setSerialConnected(true)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tenantId = useAuthStore(s => s.user?.tenant_id)
  const { data: taxSettings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })
  const taxInclusive     = taxSettings?.tax_inclusive ?? false
  const ex               = taxSettings?.extra_settings as Record<string, unknown> | undefined
  const taxName          = (ex?.tax_name as string) || 'Tax'
  const hasLogo          = !!ex?.receipt_logo_url
  const showTaxOnReceipt = (ex?.show_tax_on_receipt as boolean) ?? true

  // Fetch logo as base64 so it embeds reliably in the popup window
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!hasLogo || !tenantId) { setLogoDataUrl(null); return }
    let cancelled = false
    apiClient
      .get(`/tenants/${tenantId}/logo`, { responseType: 'blob' })
      .then(r => {
        if (cancelled) return
        const reader = new FileReader()
        reader.onload = () => { if (!cancelled) setLogoDataUrl(reader.result as string) }
        reader.readAsDataURL(r.data)
      })
      .catch(() => { if (!cancelled) setLogoDataUrl(null) })
    return () => { cancelled = true }
  }, [hasLogo, tenantId])

  function changeSize(s: ReceiptSize) {
    setSize(s)
    localStorage.setItem(RECEIPT_SIZE_KEY, s)
  }

  // Browser print
  // Clones the receipt into a top-level DOM node and uses @media print CSS to
  // hide everything else. Calls window.print() directly — the only method that
  // works on iOS/iPadOS (Chrome & Safari), Android Chrome, and all desktops.
  // (iframe.contentWindow.print() is silently ignored on iOS WebKit.)
  const handleBrowserPrint = useCallback(() => {
    const area = printAreaRef.current
    if (!area) return
    const w = size

    const NODE_ID  = 'pos-print-node'
    const STYLE_ID = 'pos-print-style'
    document.getElementById(NODE_ID)?.remove()
    document.getElementById(STYLE_ID)?.remove()

    const node = document.createElement('div')
    node.id = NODE_ID
    node.innerHTML = area.innerHTML
    document.body.appendChild(node)

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      @media print {
        @page { size: ${w} auto; margin: 0; }
        body > * { visibility: hidden !important; }
        #${NODE_ID} {
          visibility: visible !important;
          position: fixed !important;
          inset: 0;
          width: ${w};
          background: white;
        }
        #${NODE_ID} * { visibility: visible !important; }
      }
    `
    document.head.appendChild(style)

    const cleanup = () => {
      document.getElementById(NODE_ID)?.remove()
      document.getElementById(STYLE_ID)?.remove()
      window.onafterprint = null
    }
    window.onafterprint = cleanup
    setTimeout(cleanup, 60_000) // fallback if onafterprint never fires

    window.print()
  }, [size, receipt.receipt_number])

  // Connect printer — tries USB first, falls back to Serial (COM port)
  async function handleConnect() {
    setConnecting(true)
    try {
      if (usbSupported) {
        try {
          await thermalPrinterService.connect()
          setUsbConnected(true)
          toast.success(`Connected: ${thermalPrinterService.deviceName}`)
          return
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : ''
          // User cancelled picker — don't fall through to serial
          if (msg.includes('No device selected') || msg.includes('cancelled')) return
          // Access denied on Windows (driver conflict) — try serial next
        }
      }
      if (serialSupported) {
        await serialPrinterService.connect()
        setSerialConnected(true)
        toast.success(`Connected: ${serialPrinterService.portName}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      if (!msg.includes('No port selected') && !msg.includes('cancelled')) toast.error(msg)
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (usbConnected) {
      await thermalPrinterService.disconnect()
      thermalPrinterService.clearPreference()
      setUsbConnected(false)
    }
    if (serialConnected) {
      await serialPrinterService.disconnect()
      serialPrinterService.clearPreference()
      setSerialConnected(false)
    }
  }

  // Direct print (USB or Serial, whichever is connected)
  // Read from live service state (not React state) so this works correctly even
  // when called from the autoTrigger timeout, which may have a stale closure.
  async function handleDirectPrint() {
    setDirectPrinting(true)
    const printOpts = { taxInclusive, taxName, showTax: showTaxOnReceipt, logoDataUrl }
    try {
      if (thermalPrinterService.isConnected) {
        await thermalPrinterService.printReceipt(receipt, size, printOpts)
        if (!thermalPrinterService.isConnected) setUsbConnected(false)
      } else {
        await serialPrinterService.printReceipt(receipt, size, printOpts)
        if (!serialPrinterService.isConnected) setSerialConnected(false)
      }
      toast.success('Receipt printed')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setDirectPrinting(false)
    }
  }

  // Auto-trigger for auto-print setting.
  // Read live service state, not React state — auto-reconnect may have finished
  // after mount but before this 350ms timer fires, making React state stale.
  useEffect(() => {
    if (autoTrigger) {
      const t = setTimeout(() => {
        if (thermalPrinterService.isConnected || serialPrinterService.isConnected) handleDirectPrint()
        else handleBrowserPrint()
      }, 350)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Print Receipt</h2>
            <p className="text-xs text-zinc-500">{receipt.receipt_number}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">×</button>
        </div>

        {/* Toolbar: paper size + USB printer */}
        <div className="px-5 py-3 border-b border-zinc-800 flex-shrink-0 flex flex-col gap-3">
          {/* Paper size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Paper size</span>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as ReceiptSize[]).map(s => (
                <button
                  key={s}
                  onClick={() => changeSize(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    size === s
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Direct printer row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Printer</span>
            {usbConnected ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-green-400 truncate">{thermalPrinterService.deviceName}</span>
                <button onClick={handleDisconnect} className="text-xs text-zinc-600 hover:text-zinc-400 flex-shrink-0 ml-1">Disconnect</button>
              </div>
            ) : serialConnected ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-green-400 truncate">{serialPrinterService.portName}</span>
                <button onClick={handleDisconnect} className="text-xs text-zinc-600 hover:text-zinc-400 flex-shrink-0 ml-1">Disconnect</button>
              </div>
            ) : directSupported ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors disabled:opacity-50"
              >
                <IconUsb className="w-3.5 h-3.5" />
                {connecting ? 'Connecting…' : 'Connect Printer'}
              </button>
            ) : (
              <span className="text-xs text-zinc-600">Direct print requires Chrome or Edge</span>
            )}
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-5 flex justify-center bg-zinc-900/50">
          <div ref={printAreaRef} className="shadow-lg">
            {size === '58mm'
              ? <ReceiptTemplate58mm receipt={receipt} logoUrl={logoDataUrl} taxInclusive={taxInclusive} taxName={taxName} showTaxOnReceipt={showTaxOnReceipt} />
              : <ReceiptTemplate80mm receipt={receipt} logoUrl={logoDataUrl} taxInclusive={taxInclusive} taxName={taxName} showTaxOnReceipt={showTaxOnReceipt} />
            }
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>

          {/* Browser print — always available as fallback when direct is connected */}
          {anyConnected && (
            <button
              onClick={handleBrowserPrint}
              className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
              title="Open browser print dialog"
            >
              Browser Print
            </button>
          )}

          {/* Primary action */}
          {anyConnected ? (
            <button
              onClick={handleDirectPrint}
              disabled={directPrinting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black text-sm font-bold transition-colors disabled:opacity-60"
            >
              {directPrinting ? 'Printing…' : 'Print Direct'}
            </button>
          ) : (
            <button
              onClick={handleBrowserPrint}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black text-sm font-bold transition-colors"
            >
              Print Receipt
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// Label Modal (unchanged — labels use browser print only)

interface LabelPreviewProps {
  product: Product
  businessName?: string
  quantity?: number
  onClose: () => void
}

export function LabelPrintPreviewModal({ product, businessName, quantity = 1, onClose }: LabelPreviewProps) {
  const [size, setSize]           = useState<LabelSize>('50x30')
  const [qty, setQty]             = useState(quantity)
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
${pageRule}
html, body { width: ${w}mm; margin: 0; padding: 0; background: white; }
@media print { body { margin: 0; } .label-instance { page-break-after: always; } .label-instance:last-child { page-break-after: auto; } }
img { max-width: 100%; display: block; }
</style></head>
<body>${labels}</body></html>`
    const win = window.open('', '_blank', 'width=300,height=400')
    if (!win) { alert('Allow pop-ups to enable printing.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      win.focus()
      win.onafterprint = () => win.close()
      win.print()
    }, 500)
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
              <LabelComponent product={product} businessName={businessName} showPrice={showPrice} />
            </div>
          </div>
        </div>

        {qty > 1 && (
          <p className="text-center text-xs text-zinc-600 pb-2">{qty} labels will print</p>
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
