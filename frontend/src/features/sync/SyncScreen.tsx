import { useUIStore } from '@/store/ui.store'
import { IconWifi, IconWifiOff, IconSync, IconCheck } from '@/components/icons'

export default function SyncScreen() {
  const { isOnline } = useUIStore()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <h2 className="text-base font-semibold text-zinc-100">Sync & Connectivity</h2>
      </div>

      <div className="p-6 flex flex-col gap-6 max-w-3xl overflow-auto h-full">
        {/* Connection status card */}
        <div className={`rounded-2xl border p-5 ${
          isOnline
            ? 'bg-green-950/40 border-green-800/60'
            : 'bg-red-950/40 border-red-800/60'
        }`}>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <div className="w-10 h-10 rounded-xl bg-green-900/60 flex items-center justify-center text-green-400">
                <IconWifi width="20" height="20" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-red-900/60 flex items-center justify-center text-red-400">
                <IconWifiOff width="20" height="20" />
              </div>
            )}
            <div>
              <p className={`text-sm font-semibold ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                {isOnline ? 'Connected' : 'Offline Mode'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isOnline ? 'All changes are syncing in real time' : 'Changes will sync when reconnected'}
              </p>
            </div>
          </div>
        </div>

        {/* Sync config info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Sync Configuration
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Auto-sync Interval', value: 'Every 30 seconds' },
              { label: 'Retry Strategy',     value: 'Exponential backoff' },
              { label: 'Offline Storage',    value: 'IndexedDB (local)' },
              { label: 'Conflict Resolution',value: 'Server wins' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">{item.label}</p>
                <p className="text-xs text-zinc-300 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* All caught up */}
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-green-900/40 flex items-center justify-center text-green-400 mb-3">
            <IconCheck width="24" height="24" />
          </div>
          <p className="text-zinc-300 font-medium text-sm">All caught up</p>
          <p className="text-zinc-600 text-xs mt-1">No pending or failed sync operations</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-800/60">
          <IconSync width="14" height="14" className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">Offline sync queue (F3) — not yet implemented.</p>
        </div>
      </div>
    </div>
  )
}
