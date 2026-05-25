import { useEffect, useRef, useState, useCallback } from 'react'
import { lookupProductBySku, lookupProductByBarcode } from '@/hooks/useProductScan'
import { Spinner } from '@/components/ui'
import { detect1D } from './scanUtils'
import type { Product } from '@/shared/types'

type ScannerState = 'requesting' | 'active' | 'paused' | 'denied' | 'unsupported'

interface HardwareScannerModalProps {
  onResult: (product: Product) => void
  onNotFound: (code: string) => void
  onClose: () => void
  title?: string
}

export function HardwareScannerModal({
  onResult,
  onNotFound,
  onClose,
  title = 'Scan Product',
}: HardwareScannerModalProps) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number>(0)
  const processingRef = useRef(false)
  const lastCodeRef   = useRef<string | null>(null)
  const busyRef       = useRef(false)

  const [state, setState]                   = useState<ScannerState>('requesting')
  const [statusMsg, setStatusMsg]           = useState<string | null>(null)
  const [facingMode, setFacingMode]         = useState<'environment' | 'user'>('environment')
  const [torchOn, setTorchOn]               = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleCode = useCallback(async (code: string) => {
    if (processingRef.current || code === lastCodeRef.current) return
    processingRef.current = true
    lastCodeRef.current   = code
    setState('paused')
    setStatusMsg(`Looking up: ${code}`)

    // Try barcode first (physical product code), then SKU (internal code)
    let result = await lookupProductByBarcode(code)
    if (result.status === 'found') { stopStream(); onResult(result.product); return }
    if (result.status === 'not_found') result = await lookupProductBySku(code)
    if (result.status === 'found') { stopStream(); onResult(result.product); return }
    if (result.status === 'not_found') onNotFound(code)
    else setStatusMsg(`Error: ${result.message}`)

    setTimeout(() => {
      processingRef.current = false
      lastCodeRef.current   = null
      setStatusMsg(null)
      setState('active')
    }, 1500)
  }, [stopStream, onResult, onNotFound])

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(() => {
      if (processingRef.current || busyRef.current) { tick(); return }
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) { tick(); return }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) { tick(); return }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      busyRef.current = true
      detect1D(canvas).then(code => {
        busyRef.current = false
        if (code && !processingRef.current) { handleCode(code); return }
        tick()
      })
    })
  }, [handleCode])

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopStream()
    processingRef.current = false
    lastCodeRef.current   = null
    busyRef.current       = false
    setState('requesting')

    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const caps  = track.getCapabilities?.() as Record<string, unknown> | undefined
      setTorchAvailable(!!(caps && 'torch' in caps))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setState('active')
        tick()
      }
    } catch (err: unknown) {
      const name = (err as Error)?.name
      setState(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'unsupported')
    }
  }, [stopStream, tick])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> })
        .applyConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] })
      setTorchOn(v => !v)
    } catch { /* not supported */ }
  }

  async function switchCamera() {
    const next: 'environment' | 'user' = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    setTorchOn(false)
    await startCamera(next)
  }

  useEffect(() => {
    startCamera(facingMode)
    return () => stopStream()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { stopStream(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stopStream, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                torchOn ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}>
              {torchOn ? '⚡ On' : '⚡ Flash'}
            </button>
          )}
          <button onClick={switchCamera}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
            Flip
          </button>
          <button onClick={() => { stopStream(); onClose() }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {state === 'active' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-36 relative">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
              <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-400/80 animate-scan-line" />
            </div>
          </div>
        )}

        {state === 'requesting' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
            <Spinner size={36} /><p className="text-sm text-zinc-300">Starting camera…</p>
          </div>
        )}
        {state === 'paused' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <Spinner size={28} /><p className="text-sm text-zinc-300">{statusMsg ?? 'Processing…'}</p>
          </div>
        )}
        {state === 'denied' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="text-4xl">📷</span>
            <p className="text-zinc-100 font-semibold">Camera Access Denied</p>
            <p className="text-zinc-500 text-sm">Allow camera access in your browser settings then try again.</p>
            <button onClick={() => startCamera(facingMode)} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm">Try Again</button>
          </div>
        )}
        {state === 'unsupported' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-zinc-100 font-semibold">Camera Not Available</p>
            <p className="text-zinc-500 text-sm">Use a USB scanner instead.</p>
          </div>
        )}
      </div>

      {state === 'active' && (
        <div className="px-4 py-3 bg-zinc-950/90 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">Point camera at the barcode · Keep it steady and well-lit</p>
          <p className="text-xs text-zinc-600 mt-0.5">EAN-13 · UPC-A · Code-128 · Code-39 and more</p>
        </div>
      )}
    </div>
  )
}
