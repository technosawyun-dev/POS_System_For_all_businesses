import type { Receipt } from '@/shared/types'
import { buildReceiptData } from './printer.service'
import type { PaperWidth, PrintReceiptOpts } from './printer.service'

// Web Serial API types (not in standard TS lib yet)
interface SerialOptions {
  baudRate: number
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  parity?: 'none' | 'even' | 'odd'
  flowControl?: 'none' | 'hardware'
}
interface SerialPort {
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}
interface SerialPortRequestOptions { filters?: unknown[] }
interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

const SERIAL_PREF_KEY = 'pos_printer_serial_id'

// ESC/POS real-time status request — printer replies with 1 byte if baud rate is correct.
const DLE_EOT        = new Uint8Array([0x10, 0x04, 0x01])
const PROBE_TIMEOUT  = 400  // ms to wait for a DLE EOT reply
const PORT_SETTLE_MS = 200  // Windows COM ports need time after open() before they accept data
// Most common ESC/POS baud rates, tried in order (modern USB-serial defaults to 115200).
const BAUD_RATES     = [115200, 9600, 19200, 38400, 57600]

// ESC/POS status byte: bit 4 set, bits 0/6/7 clear.
function isValidStatus(byte: number): boolean {
  return (byte & 0b10010001) === 0b00010000
}

// Opens the port at `baudRate`, sends DLE EOT, waits up to PROBE_TIMEOUT ms for a valid
// status byte. Leaves port OPEN and returns true on match; closes and returns false otherwise.
async function probeBaudRate(port: SerialPort, baudRate: number): Promise<boolean> {
  try {
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })
    await new Promise(res => setTimeout(res, PORT_SETTLE_MS))
    if (!port.writable || !port.readable) { await port.close(); return false }

    const writer = port.writable.getWriter()
    const reader = port.readable.getReader()
    let matched = false

    try {
      await writer.write(DLE_EOT)
      const result = await Promise.race([
        reader.read(),
        new Promise<null>(res => setTimeout(() => res(null), PROBE_TIMEOUT)),
      ])
      if (result && !result.done && result.value?.length) {
        matched = isValidStatus(result.value[0])
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
      writer.releaseLock()
    }

    if (!matched) await port.close()
    return matched
  } catch {
    try { await port.close() } catch {}
    return false
  }
}

// Probes each baud rate in order. Falls back to 115200 when the printer doesn't support
// DLE EOT (basic models that only receive, never transmit status).
async function detectBaudRate(port: SerialPort): Promise<number> {
  for (const rate of BAUD_RATES) {
    if (await probeBaudRate(port, rate)) return rate
  }
  // No DLE EOT response — open at 9600 (traditional ESC/POS default) with settle delay.
  await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })
  await new Promise(res => setTimeout(res, PORT_SETTLE_MS))
  return 9600
}

class SerialPrinterService {
  private port: SerialPort | null = null
  private baudRate = BAUD_RATES[0]
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
      return `Serial Printer (${vid}:${pid}) @ ${this.baudRate}`
    }
    return `Serial Printer @ ${this.baudRate}`
  }

  private savePreference(): void {
    if (!this.port) return
    localStorage.setItem(SERIAL_PREF_KEY, JSON.stringify({
      ...this.port.getInfo(),
      baudRate: this.baudRate,
    }))
  }

  clearPreference(): void {
    localStorage.removeItem(SERIAL_PREF_KEY)
  }

  // Reconnect the previously selected port using the saved baud rate — no picker, no probe.
  async autoReconnect(): Promise<boolean> {
    if (!this.isSupported || this._open) return this._open
    try {
      const raw = localStorage.getItem(SERIAL_PREF_KEY)
      if (!raw) return false
      const pref = JSON.parse(raw) as { usbVendorId?: number; usbProductId?: number; baudRate?: number }
      const serial = (navigator as unknown as { serial: Serial }).serial
      const ports = await serial.getPorts()
      const port = pref.usbVendorId != null
        ? ports.find(p => {
            const info = p.getInfo()
            return info.usbVendorId === pref.usbVendorId && info.usbProductId === pref.usbProductId
          })
        : ports.length === 1 ? ports[0] : undefined
      if (!port) return false
      this.port = port
      this.baudRate = pref.baudRate ?? 9600
      await this.port.open({ baudRate: this.baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })
      await new Promise(res => setTimeout(res, PORT_SETTLE_MS))
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

    // If we have a saved VID:PID, filter the picker to show only that printer.
    // The user sees one entry instead of the full system port list.
    const raw = localStorage.getItem(SERIAL_PREF_KEY)
    const pref = raw ? JSON.parse(raw) as { usbVendorId?: number; usbProductId?: number; baudRate?: number } : null
    const filters = pref?.usbVendorId != null
      ? [{ usbVendorId: pref.usbVendorId, usbProductId: pref.usbProductId }]
      : []

    try {
      this.port = await serial.requestPort({ filters })
    } catch (err) {
      // If the filtered picker finds no matching device, fall back to unfiltered.
      if (filters.length && err instanceof Error && err.name === 'NotFoundError') {
        this.port = await serial.requestPort({ filters: [] })
      } else {
        throw err
      }
    }

    // Auto-detect baud rate; leaves port open on success.
    this.baudRate = await detectBaudRate(this.port)
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
