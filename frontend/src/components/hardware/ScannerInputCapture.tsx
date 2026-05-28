import { useEffect, useRef } from 'react'

// Detects USB/Bluetooth HID barcode and QR scanners that emulate a keyboard.
// Scanners type very rapidly (each char ~<30ms apart) and send Enter at the end.
// This component listens globally and calls onScan when such input is detected.

const DEFAULT_IGNORE_WHEN = ['INPUT', 'TEXTAREA', 'SELECT']

interface ScannerInputCaptureProps {
  onScan: (code: string) => void
  // Minimum characters to trigger scan (ignore stray keypresses)
  minLength?: number
  // Max milliseconds between consecutive chars to consider it a scanner
  maxCharGap?: number
  // Ignore input when these element types are focused (user is typing)
  ignoreWhen?: string[]
  enabled?: boolean
}

export function ScannerInputCapture({
  onScan,
  minLength = 3,
  maxCharGap = 50,
  ignoreWhen = DEFAULT_IGNORE_WHEN,
  enabled = true,
}: ScannerInputCaptureProps) {
  const bufferRef   = useRef('')
  const lastTimeRef = useRef(0)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if focused on a text input (user is typing manually)
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? ''
      if (ignoreWhen.includes(tag)) return

      // Ignore modifier-only keys
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const now = Date.now()

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        lastTimeRef.current = 0
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
        if (code.length >= minLength) {
          onScan(code)
        }
        return
      }

      // Single printable character
      if (e.key.length === 1) {
        const gap = now - lastTimeRef.current
        if (lastTimeRef.current > 0 && gap > maxCharGap) {
          // Gap too large — likely a manual keystroke, reset buffer
          bufferRef.current = ''
        }
        bufferRef.current += e.key
        lastTimeRef.current = now

        // Auto-flush after 200ms with no further input (some scanners don't send Enter)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          const code = bufferRef.current.trim()
          bufferRef.current = ''
          lastTimeRef.current = 0
          timerRef.current = null
          if (code.length >= minLength) {
            onScan(code)
          }
        }, 200)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, minLength, maxCharGap, ignoreWhen, onScan])

  return null
}
