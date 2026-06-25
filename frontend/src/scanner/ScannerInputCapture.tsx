import { useEffect, useRef } from 'react'

// HID barcode scanners always emit US QWERTY keycodes regardless of OS keyboard
// layout. We decode e.code directly so scans are correct even when the system
// is set to a different layout (e.g. French, Myanmar, etc.).
//
// For Digit* keys (0-9) we ALWAYS use the unshifted character, because:
//   - Barcodes only contain digits 0-9, never !@#$%^&*()
//   - Some scanner firmware is set to French/European layout and sends
//     Shift+Digit for every digit — we strip the Shift so '6' is always '6'
const US_QWERTY: Record<string, [string, string]> = {
  Digit0: ['0',')'], Digit1: ['1','!'], Digit2: ['2','@'], Digit3: ['3','#'],
  Digit4: ['4','$'], Digit5: ['5','%'], Digit6: ['6','^'], Digit7: ['7','&'],
  Digit8: ['8','*'], Digit9: ['9','('],
  KeyA: ['a','A'], KeyB: ['b','B'], KeyC: ['c','C'], KeyD: ['d','D'], KeyE: ['e','E'],
  KeyF: ['f','F'], KeyG: ['g','G'], KeyH: ['h','H'], KeyI: ['i','I'], KeyJ: ['j','J'],
  KeyK: ['k','K'], KeyL: ['l','L'], KeyM: ['m','M'], KeyN: ['n','N'], KeyO: ['o','O'],
  KeyP: ['p','P'], KeyQ: ['q','Q'], KeyR: ['r','R'], KeyS: ['s','S'], KeyT: ['t','T'],
  KeyU: ['u','U'], KeyV: ['v','V'], KeyW: ['w','W'], KeyX: ['x','X'], KeyY: ['y','Y'],
  KeyZ: ['z','Z'],
  Minus: ['-','_'], Equal: ['=','+'], BracketLeft: ['[','{'], BracketRight: [']','}'],
  Backslash: ['\\','|'], Semicolon: [';',':'], Quote: ["'",'"'],
  Comma: [',','<'], Period: ['.', '>'], Slash: ['/','?'], Space: [' ',' '],
  Backquote: ['`','~'],
}

// Hardware scanners fire chars at < 10 ms each; humans rarely type below 100 ms.
// 100 ms burst threshold works for virtually all USB/Bluetooth HID scanners,
// including models with configurable inter-character delay up to 100ms.
// It stays well below average human typing speed (~200ms per char).
const BURST_MS = 100

interface ScannerInputCaptureProps {
  onScan: (code: string) => void
  minLength?: number
  maxCharGap?: number
  enabled?: boolean
}

export function ScannerInputCapture({
  onScan,
  minLength = 3,
  maxCharGap = 150,
  enabled = true,
}: ScannerInputCaptureProps) {
  const bufferRef        = useRef('')
  const lastTimeRef      = useRef(0)
  const timerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isBurstRef       = useRef(false)
  // Track the focused input and its value snapshot at the moment the first
  // scanner char arrives, so we can undo it once burst is confirmed.
  const firstCharTargetRef = useRef<{ el: HTMLInputElement | HTMLTextAreaElement; before: string } | null>(null)

  useEffect(() => {
    // Reset stale refs when the effect re-runs (e.g. onScan changed)
    bufferRef.current        = ''
    lastTimeRef.current      = 0
    isBurstRef.current       = false
    firstCharTargetRef.current = null
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }

    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const now = Date.now()

      if (e.key === 'Enter') {
        const code     = bufferRef.current.trim()
        const wasBurst = isBurstRef.current
        bufferRef.current        = ''
        lastTimeRef.current      = 0
        isBurstRef.current       = false
        firstCharTargetRef.current = null
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
        if (wasBurst && code.length >= minLength) {
          e.preventDefault() // stop form submission on scanner Enter
          onScan(code)
        }
        return
      }

      const decoded  = US_QWERTY[e.code]
      if (!decoded) return

      // Digit keys: always unshifted (barcodes = digits 0-9, never shifted symbols)
      // Letter keys: respect Shift so uppercase barcodes (e.g. Code-128) work
      const isDigit  = e.code.startsWith('Digit')
      const char     = decoded[(!isDigit && e.shiftKey) ? 1 : 0]

      const gap = now - lastTimeRef.current
      if (lastTimeRef.current > 0 && gap > maxCharGap) {
        bufferRef.current        = ''
        isBurstRef.current       = false
        firstCharTargetRef.current = null
      }

      if (bufferRef.current.length === 0) {
        // Snapshot the focused input before the first char lands in it
        const el = document.activeElement
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          firstCharTargetRef.current = { el, before: el.value }
        }
      }

      // Confirm scanner burst when the second char arrives within BURST_MS
      if (bufferRef.current.length > 0 && gap < BURST_MS) {
        if (!isBurstRef.current) {
          isBurstRef.current = true
          // Undo the first char that landed in the focused input
          const snap = firstCharTargetRef.current
          if (snap && snap.el.isConnected) {
            // Use the native setter so React's synthetic onChange fires correctly
            const nativeSetter = Object.getOwnPropertyDescriptor(
              snap.el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
              'value',
            )?.set
            nativeSetter?.call(snap.el, snap.before)
            snap.el.dispatchEvent(new Event('input', { bubbles: true }))
          }
          firstCharTargetRef.current = null
        }
      }

      // Once in burst mode, stop chars from reaching the focused input element
      if (isBurstRef.current) {
        e.preventDefault()
      }

      bufferRef.current  += char
      lastTimeRef.current = now

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const code     = bufferRef.current.trim()
        const wasBurst = isBurstRef.current
        bufferRef.current        = ''
        lastTimeRef.current      = 0
        isBurstRef.current       = false
        firstCharTargetRef.current = null
        timerRef.current         = null
        if (wasBurst && code.length >= minLength) onScan(code)
      }, 200)
    }

    // Capture phase: runs before the focused input sees the event,
    // so e.preventDefault() actually stops chars from reaching the input.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, minLength, maxCharGap, onScan])

  return null
}
