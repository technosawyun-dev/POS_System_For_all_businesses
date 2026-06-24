import type { Receipt } from '@/shared/types'
import { EscPos, padLine, centerText, dashes, wrap, fmtNum, imageToRaster } from './escpos'
import { fmtDateTime } from '@/lib/utils'
import { getPaymentMethodLabel } from '@/lib/paymentMethod'

export type PaperWidth = '58mm' | '80mm'

export interface PrintReceiptOpts {
  taxInclusive?: boolean
  taxName?: string
  showTax?: boolean
  footer?: string
  logoDataUrl?: string | null
}

// WebUSB API types (not in standard TS DOM lib)
interface USBEndpoint { direction: 'in' | 'out'; type: 'bulk' | 'interrupt' | 'isochronous'; endpointNumber: number }
interface USBAlternateInterface { endpoints: USBEndpoint[] }
interface USBInterface { interfaceNumber: number; alternates: USBAlternateInterface[] }
interface USBConfiguration { interfaces: USBInterface[] }
interface USBDevice {
  vendorId: number; productId: number
  manufacturerName?: string; productName?: string
  opened: boolean; configuration: USBConfiguration | null
  open(): Promise<void>; close(): Promise<void>
  selectConfiguration(value: number): Promise<void>
  claimInterface(n: number): Promise<void>; releaseInterface(n: number): Promise<void>
  transferOut(endpoint: number, data: BufferSource): Promise<{ status: string }>
}
interface USBDeviceRequestOptions { filters: unknown[] }
interface USB { requestDevice(opts: USBDeviceRequestOptions): Promise<USBDevice>; getDevices(): Promise<USBDevice[]> }
declare global { interface Navigator { usb: USB } }

// Characters per line for each paper width (standard ESC/POS font)
const COLS: Record<PaperWidth, number> = { '58mm': 32, '80mm': 42 }

type Endpoint = { interfaceNumber: number; endpointNumber: number }

function findBulkOut(device: USBDevice): Endpoint {
  for (const iface of device.configuration!.interfaces) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out' && ep.type === 'bulk') {
          return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber }
        }
      }
    }
  }
  // Most 58mm printers use endpoint 1 on interface 0
  return { interfaceNumber: 0, endpointNumber: 1 }
}

const USB_PREF_KEY = 'pos_printer_usb_id'

class ThermalPrinterService {
  private device: USBDevice | null = null
  private ep: Endpoint = { interfaceNumber: 0, endpointNumber: 1 }

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator
  }

  get isConnected(): boolean {
    return this.device !== null && this.device.opened
  }

  get deviceName(): string {
    if (!this.device) return ''
    return [this.device.manufacturerName, this.device.productName].filter(Boolean).join(' ').trim() || 'USB Printer'
  }

  private savePreference(): void {
    if (!this.device) return
    localStorage.setItem(USB_PREF_KEY, JSON.stringify({
      vendorId: this.device.vendorId,
      productId: this.device.productId,
    }))
  }

  clearPreference(): void {
    localStorage.removeItem(USB_PREF_KEY)
  }

  // Reconnect the exact printer the user previously selected — no picker shown.
  async autoReconnect(): Promise<boolean> {
    if (!this.isSupported || this.isConnected) return this.isConnected
    try {
      const raw = localStorage.getItem(USB_PREF_KEY)
      if (!raw) return false
      const pref = JSON.parse(raw) as { vendorId: number; productId: number }
      const devices = await navigator.usb.getDevices()
      const device = devices.find(d => d.vendorId === pref.vendorId && d.productId === pref.productId)
      if (!device) return false
      this.device = device
      await this.device.open()
      if (this.device.configuration === null) await this.device.selectConfiguration(1)
      this.ep = findBulkOut(this.device)
      await this.device.claimInterface(this.ep.interfaceNumber)
      return true
    } catch {
      this.device = null
      return false
    }
  }

  async connect(): Promise<void> {
    if (!this.isSupported) {
      throw new Error('Web USB is not supported. Please use Chrome or Edge for direct printing.')
    }
    if (this.device?.opened) await this.disconnect()
    this.device = await navigator.usb.requestDevice({ filters: [] })
    await this.device.open()
    if (this.device.configuration === null) await this.device.selectConfiguration(1)
    this.ep = findBulkOut(this.device)
    await this.device.claimInterface(this.ep.interfaceNumber)
    this.savePreference()
  }

  async disconnect(): Promise<void> {
    if (!this.device) return
    try {
      await this.device.releaseInterface(this.ep.interfaceNumber)
      await this.device.close()
    } catch { /* ignore */ }
    this.device = null
  }

  private async send(data: Uint8Array): Promise<void> {
    if (!this.device?.opened) throw new Error('Printer not connected')
    // Some printers have a max transfer size — chunk to 64 KB to be safe
    const CHUNK = 65536
    for (let i = 0; i < data.length; i += CHUNK) {
      await this.device.transferOut(this.ep.endpointNumber, data.slice(i, i + CHUNK))
    }
  }

  async printReceipt(
    receipt: Receipt,
    paper: PaperWidth = '58mm',
    opts?: PrintReceiptOpts,
  ): Promise<void> {
    await this.send(await buildReceiptData(receipt, paper, opts))
  }
}

// Shared ESC/POS receipt builder
// Exported so both USB and Serial services can use the same layout.

export async function buildReceiptData(
  receipt: Receipt,
  paper: PaperWidth = '58mm',
  opts?: PrintReceiptOpts,
): Promise<Uint8Array> {
  const w            = COLS[paper]
  const taxInclusive = opts?.taxInclusive ?? false
  const taxName      = opts?.taxName ?? 'Tax'
  const showTax      = opts?.showTax ?? true
  const footer       = opts?.footer ?? 'Thank you for your purchase!'
  const logoMaxW     = paper === '58mm' ? 320 : 420
  const logoMaxH     = 200

  const ep = new EscPos().init()

  // Logo
  if (opts?.logoDataUrl) {
    const raster = await imageToRaster(opts.logoDataUrl, logoMaxW, logoMaxH)
    if (raster) ep.align('center').rasterImage(raster).lf()
  }

  // Header
  ep.align('center').bold(true).doubleSize(true).line(receipt.tenant_name)
  ep.doubleSize(false).bold(false)
  ep.line(receipt.branch_name)
  ep.line(fmtDateTime(receipt.issued_at))
  ep.align('left').line(dashes(w))
  ep.align('center').line(`Receipt: ${receipt.receipt_number}`)
  ep.align('left').line(dashes(w))

  // Items
  for (const item of receipt.items_snapshot) {
    const nameLines = wrap(item.product_name, w)
    nameLines.forEach((l, i) => {
      if (i === 0) ep.bold(true).line(l).bold(false)
      else ep.line('  ' + l)
    })
    ep.line(padLine(`  ${item.quantity} x ${fmtNum(item.unit_price)}`, fmtNum(item.total), w))
  }

  ep.line(dashes(w))

  // Totals
  ep.line(padLine('Subtotal', fmtNum(taxInclusive ? receipt.total_amount : receipt.subtotal), w))
  if (parseFloat(receipt.discount_amount) > 0)
    ep.line(padLine('Discount', `-${fmtNum(receipt.discount_amount)}`, w))
  if (showTax && parseFloat(receipt.tax_amount) > 0)
    ep.line(padLine(taxInclusive ? `${taxName} (incl.)` : taxName, fmtNum(receipt.tax_amount), w))

  ep.line(dashes(w, '='))
  ep.bold(true).line(padLine('TOTAL', fmtNum(receipt.total_amount), w)).bold(false)
  ep.line(dashes(w))

  // Payment
  for (const pm of receipt.payment_methods) {
    const label = `${getPaymentMethodLabel(pm.method ?? '')}${pm.notes ? ` (${pm.notes})` : ''}`
    ep.line(padLine(label, fmtNum(pm.amount), w))
  }
  if (parseFloat(receipt.amount_paid) > parseFloat(receipt.total_amount)) {
    ep.line(dashes(w))
    ep.line(padLine('Tendered', fmtNum(receipt.amount_paid), w))
    ep.bold(true).line(padLine('Change', fmtNum(receipt.change_amount), w)).bold(false)
  }

  ep.line(dashes(w))

  // Footer
  ep.align('center')
  ep.line(`Cashier: ${receipt.cashier_name}`)
  ep.lf()
  ep.line(centerText(footer, w))
  ep.lf(4).cut()

  return ep.build()
}

export const thermalPrinterService = new ThermalPrinterService()
