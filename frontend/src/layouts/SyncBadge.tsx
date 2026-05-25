import { useUIStore } from '@/store/ui.store'
import { IconWifi, IconWifiOff } from '@/components/icons'

export default function SyncBadge() {
  const isOnline = useUIStore(s => s.isOnline)

  // Offline
  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 border border-red-800 text-red-400 text-xs font-medium">
        <IconWifiOff width="13" height="13" />
        <span>Offline</span>
      </span>
    )
  }

  // Default (synced)
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-950 border border-green-800 text-green-400 text-xs font-medium">
      <IconWifi width="13" height="13" />
      <span>Online</span>
    </span>
  )
}
