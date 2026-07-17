import { buildReceiptData } from './printer.service'
import type { PaperWidth, PrintReceiptOpts } from './printer.service'
import type { Receipt } from '@/shared/types'

export interface AgentPrinterInfo { name: string; transport: 'windows' | 'tcp'; port?: number }

const AGENT_URL = import.meta.env.VITE_PRINT_AGENT_URL ?? 'http://127.0.0.1:17891'
const PREF_KEY = 'pos_print_agent_printer'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AGENT_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(2500),
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `Print Agent returned ${response.status}`)
  return body as T
}

class PrintAgentService {
  private target: AgentPrinterInfo | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor() {
    try { this.target = JSON.parse(localStorage.getItem(PREF_KEY) || 'null') }
    catch { localStorage.removeItem(PREF_KEY) }
  }

  get isSupported() { return true }
  get isConnected() { return this.target !== null }
  get printerName() {
    if (!this.target) return ''
    return this.target.transport === 'tcp' ? `Wi-Fi ${this.target.name}:${this.target.port ?? 9100}` : this.target.name
  }

  async isAvailable(): Promise<boolean> {
    try { await request('/health'); return true } catch { return false }
  }

  async discover(): Promise<AgentPrinterInfo[]> {
    return request<AgentPrinterInfo[]>('/printers')
  }

  async autoConnect(): Promise<boolean> {
    if (!(await this.isAvailable())) return false
    if (this.target?.transport === 'tcp') return true
    const found = (await this.discover()).filter(p => !/Microsoft Print to PDF|Fax|OneNote/i.test(p.name))
    if (this.target && found.some(p => p.name === this.target!.name)) return true
    if (found.length !== 1) return false
    this.save(found[0])
    return true
  }

  async connect(): Promise<void> {
    if (!(await this.isAvailable())) throw new Error('Sawyun Print Agent is not running')
    const found = (await this.discover()).filter(p => !/Microsoft Print to PDF|Fax|OneNote/i.test(p.name))
    if (!found.length) throw new Error('Sawyun Print Agent found no installed printers')
    if (found.length === 1) { this.save(found[0]); return }
    const choices = found.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
    const answer = window.prompt(`Choose an installed printer:\n\n${choices}`, '1')?.trim()
    if (!answer) throw new Error('Printer selection cancelled')
    const selected = found[Number(answer) - 1]
    if (!selected) throw new Error('Invalid printer selection')
    this.save(selected)
    return
  }

  async connectWifi(): Promise<void> {
    if (!(await this.isAvailable())) throw new Error('Sawyun Print Agent is not running')
    const answer = window.prompt('Wi-Fi printer IP address and optional port', '192.168.1.100:9100')?.trim()
    if (!answer) throw new Error('Printer selection cancelled')
    const [host, rawPort] = answer.split(':')
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) throw new Error('Invalid printer IP address')
    const port = Number(rawPort || 9100)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid printer port')
    this.save({ name: host, transport: 'tcp', port })
  }
  disconnect() {
    this.target = null
    localStorage.removeItem(PREF_KEY)
  }

  async printReceipt(receipt: Receipt, paper: PaperWidth, opts?: PrintReceiptOpts): Promise<void> {
    const job = this.queue.then(async () => {
      if (!this.target) throw new Error('Sawyun Print Agent printer is not configured')
      const data = Array.from(await buildReceiptData(receipt, paper, opts))
      if (this.target.transport === 'tcp') {
        await request('/print-tcp', { method: 'POST', body: JSON.stringify({ host: this.target.name, port: this.target.port ?? 9100, data }) })
      } else {
        await request('/print', { method: 'POST', body: JSON.stringify({ printer_name: this.target.name, data }) })
      }
      await new Promise(resolve => setTimeout(resolve, 150))
      if (this.target.transport === 'windows') {
        await request('/print', { method: 'POST', body: JSON.stringify({ printer_name: this.target.name, data: [0x1b, 0x40, 0x0a] }) })
      }
    })
    this.queue = job.catch(() => {})
    return job
  }

  private save(printer: AgentPrinterInfo) {
    this.target = printer
    localStorage.setItem(PREF_KEY, JSON.stringify(printer))
  }
}

export const printAgentService = new PrintAgentService()
