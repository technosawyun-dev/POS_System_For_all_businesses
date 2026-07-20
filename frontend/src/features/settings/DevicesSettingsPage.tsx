import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { cn } from '@/shared/utils'

type WebDevice = 'phone' | 'ipad' | 'windows' | 'ubuntu' | 'mac'
type DeviceOption = {
  key: WebDevice
  title: string
  description: string
  icon: string
  guidance: string
}

const PREF_KEY = 'sawyun_web_device'

const DEVICES: DeviceOption[] = [
  { key: 'phone', title: 'Phone', description: 'Android or iPhone', icon: 'P', guidance: 'Phone checkout is not available. Use a tablet or computer to create sales and complete checkout.' },
  { key: 'ipad', title: 'iPad', description: 'iPad or Android tablet', icon: 'T', guidance: 'Sales and checkout are available on tablets. You can also scan product barcodes with the tablet camera.' },
  { key: 'windows', title: 'Windows', description: 'Windows desktop or laptop', icon: 'W', guidance: 'Sales, checkout, barcode scanning, and receipt printing are available. Install the SawYun Printing Agent to print directly from the web app.' },
  { key: 'ubuntu', title: 'Ubuntu', description: 'Ubuntu desktop or laptop', icon: 'U', guidance: 'Use the full desktop web version for sales and checkout. Print receipts through the browser print dialog.' },
  { key: 'mac', title: 'Mac', description: 'Mac desktop or laptop', icon: 'M', guidance: 'Use the full desktop web version for sales and checkout. Print receipts through the browser print dialog.' },
]

function initialDevice(): WebDevice | null {
  const saved = localStorage.getItem(PREF_KEY)
  return DEVICES.some(device => device.key === saved) ? saved as WebDevice : null
}

function DownloadLink({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return <span className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-500">{label}: Coming Soon</span>
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400">
      {label}
    </a>
  )
}

export default function DevicesSettingsPage() {
  const [selected, setSelected] = useState<WebDevice | null>(initialDevice)
  const { data: links } = useQuery({
    queryKey: ['public', 'app-download-links'],
    queryFn: subscriptionsService.getPublicAppDownloadLinks,
    staleTime: 30_000,
  })

  function selectDevice(device: WebDevice) {
    setSelected(device)
    localStorage.setItem(PREF_KEY, device)
  }

  const selectedDevice = DEVICES.find(device => device.key === selected)

  return (
    <div className="p-5">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-base font-semibold text-zinc-100">Which device do you use?</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Choose your device to see the supported web-app features and downloads.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {DEVICES.map(device => {
            const active = selected === device.key
            return (
              <button
                key={device.key}
                type="button"
                onClick={() => selectDevice(device.key)}
                aria-pressed={active}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-colors',
                  active ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600',
                )}
              >
                <div className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold',
                  active ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-zinc-700 bg-zinc-800 text-zinc-200',
                )}>
                  {device.icon}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-100">{device.title}</h3>
                  {active && <span className="text-xs font-semibold text-amber-400">Selected</span>}
                </div>
                <p className="mt-1 text-xs text-zinc-500">{device.description}</p>
              </button>
            )
          })}
        </div>

        {selectedDevice && (
          <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="font-medium text-zinc-100">{selectedDevice.title} web app</h3>
            <p className="mt-1 text-sm text-zinc-400">{selectedDevice.guidance}</p>

            {(selected === 'phone' || selected === 'ipad') && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                <DownloadLink href={links?.android} label={selected === 'ipad' ? 'Android Tablet App' : 'Android App'} />
                <DownloadLink href={links?.ios} label={selected === 'ipad' ? 'iPad App' : 'iPhone App'} />
              </div>
            )}

            {selected === 'windows' && (
              <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">SawYun Windows App</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Install the Windows desktop version of SawYun POS.</p>
                  </div>
                  <DownloadLink href={links?.windows} label="Download Windows App" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">SawYun Printing Agent</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Required for direct receipt printing from the web app.</p>
                  </div>
                  <DownloadLink href={links?.print_agent} label="Download Printing Agent" />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}