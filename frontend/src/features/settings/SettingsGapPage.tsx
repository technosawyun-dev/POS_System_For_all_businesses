export default function SettingsGapPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-zinc-100 mb-2">{title}</h3>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {description ?? 'This settings section requires backend API support that is not yet available. It will be enabled in a future release.'}
          </p>
          <div className="mt-4 px-4 py-2.5 bg-zinc-800 rounded-xl inline-block">
            <p className="text-xs text-zinc-500 font-mono">Backend gap — no API endpoint available</p>
          </div>
        </div>
      </div>
    </div>
  )
}
