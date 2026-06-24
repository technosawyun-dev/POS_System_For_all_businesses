import type { Receipt } from '@/shared/types'
import { buildReceiptData } from './printer.service'
import type { PaperWidth, PrintReceiptOpts } from './printer.service'

// Web Serial API types (not in standard TS lib yet)
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  writable: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}
interface SerialPortRequestOptions { filters?: unknown[] }
interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

const SERIAL_PREF_KEY = 'pos_printer_serial_id'

class SerialPrinterService {
  private port: SerialPort | null = null
  private _open = false

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  get isConnected(): boolean {
    return this._open
  }

  get portName(): string {
    if (!this.port) return ''
    const info = this.port.getInfo()
    if (info.usbVendorId != null) {
      const vid = info.usbVendorId.toString(16).padStart(4, '0')
      const pid = (info.usbProductId ?? 0).toString(16).padStart(4, '0')
      return `Serial Printer (${vid}:${pid})`
    }
    return 'Serial Printer'
  }

  private savePreference(): void {
    if (!this.port) return
    localStorage.setItem(SERIAL_PREF_KEY, JSON.stringify(this.port.getInfo()))
  }

  clearPreference(): void {
    localStorage.removeItem(SERIAL_PREF_KEY)
  }

  // Reconnect the exact port the user previously selected — no picker shown.
  async autoReconnect(): Promise<boolean> {
    if (!this.isSupported || this._open) return this._open
    try {
      const raw = localStorage.getItem(SERIAL_PREF_KEY)
      if (!raw) return false
      const pref = JSON.parse(raw) as { usbVendorId?: number; usbProductId?: number }
      const serial = (navigator as unknown as { serial: Serial }).serial
      const ports = await serial.getPorts()
      // Match by VID:PID; if no VID stored (native COM port), only auto-connect if exactly one port
      const port = pref.usbVendorId != null
        ? ports.find(p => {
            const info = p.getInfo()
            return info.usbVendorId === pref.usbVendorId && info.usbProductId === pref.usbProductId
          })
        : ports.length === 1 ? ports[0] : undefined
      if (!port) return false
      this.port = port
      await this.port.open({ baudRate: 9600 })
      this._open = true
      return true
    } catch {
      this.port = null
      this._open = false
      return false
    }
  }

  async connect(): Promise<void> {
    if (!this.isSupported) {
      throw new Error('Web Serial is not supported. Please use Chrome or Edge.')
    }
    if (this._open) await this.disconnect()
    const serial = (navigator as unknown as { serial: Serial }).serial
    this.port = await serial.requestPort({ filters: [] })
    await this.port.open({ baudRate: 9600 })
    this._open = true
    this.savePreference()
  }

  async disconnect(): Promise<void> {
    if (!this.port) return
    try { await this.port.close() } catch { /* ignore */ }
    this.port = null
    this._open = false
  }

  private async send(data: Uint8Array): Promise<void> {
    if (!this._open || !this.port?.writable) throw new Error('Serial printer not connected')
    const writer = this.port.writable.getWriter()
    try {
      await writer.write(data)
    } finally {
      writer.releaseLock()
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

export const serialPrinterService = new SerialPrinterService()
