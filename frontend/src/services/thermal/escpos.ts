// ESC/POS command builder for thermal printers.
// All text must be ASCII-printable; non-ASCII chars are replaced with '?'.

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

export interface RasterImage {
  bytes: number[]
  byteWidth: number
  height: number
}

export class EscPos {
  private buf: number[] = []

  init(): this {
    this.buf.push(ESC, 0x40)
    return this
  }

  align(mode: 'left' | 'center' | 'right'): this {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0
    this.buf.push(ESC, 0x61, n)
    return this
  }

  bold(on: boolean): this {
    this.buf.push(ESC, 0x45, on ? 1 : 0)
    return this
  }

  doubleSize(on: boolean): this {
    this.buf.push(GS, 0x21, on ? 0x11 : 0x00)
    return this
  }

  text(t: string): this {
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i)
      this.buf.push(c >= 32 && c < 127 ? c : 0x3f)
    }
    return this
  }

  line(t = ''): this {
    return this.text(t).lf()
  }

  lf(n = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(LF)
    return this
  }

  // GS v 0 — raster bit image. Pass result of imageToRaster().
  rasterImage(img: RasterImage): this {
    const { bytes, byteWidth, height } = img
    this.buf.push(
      GS, 0x76, 0x30, 0x00,
      byteWidth & 0xff, (byteWidth >> 8) & 0xff,
      height    & 0xff, (height    >> 8) & 0xff,
      ...bytes,
    )
    return this
  }

  // GS V m n — feed N lines then cut
  cut(): this {
    this.buf.push(GS, 0x56, 0x42, 0x03)
    return this
  }

  build(): Uint8Array {
    return new Uint8Array(this.buf)
  }
}

// Layout helpers

export function padLine(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length
  if (gap < 1) {
    const maxLeft = width - right.length - 1
    return left.slice(0, Math.max(0, maxLeft)) + ' ' + right
  }
  return left + ' '.repeat(gap) + right
}

export function centerText(t: string, width: number): string {
  if (t.length >= width) return t.slice(0, width)
  const pad = Math.floor((width - t.length) / 2)
  return ' '.repeat(pad) + t
}

export function dashes(width: number, ch = '-'): string {
  return ch.repeat(width)
}

export function wrap(text: string, width: number): string[] {
  if (text.length <= width) return [text]
  const lines: string[] = []
  let rem = text
  while (rem.length > width) {
    let at = rem.lastIndexOf(' ', width)
    if (at < 1) at = width
    lines.push(rem.slice(0, at).trimEnd())
    rem = rem.slice(at).trimStart()
  }
  if (rem) lines.push(rem)
  return lines
}

export function fmtNum(n: number | string): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Image → 1-bit raster

/**
 * Convert an image URL or base64 data URL to a 1-bit raster for ESC/POS printing.
 * Dark pixels → 1, light/transparent pixels → 0.
 * Both maxWidthDots and maxHeightDots are respected — image scales to fit both.
 */
export function imageToRaster(
  imageUrl: string,
  maxWidthDots = 384,
  maxHeightDots = 120,
): Promise<RasterImage | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(
        1,
        maxWidthDots  / img.naturalWidth,
        maxHeightDots / img.naturalHeight,
      )
      const w     = Math.floor(img.naturalWidth  * scale)
      const h     = Math.floor(img.naturalHeight * scale)
      // Width must be a multiple of 8 — one byte covers 8 horizontal dots
      const byteWidth  = Math.ceil(w / 8)
      const pixelWidth = byteWidth * 8

      const canvas = document.createElement('canvas')
      canvas.width  = pixelWidth
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, pixelWidth, h)
      ctx.drawImage(img, 0, 0, w, h)

      const { data } = ctx.getImageData(0, 0, pixelWidth, h)
      const bytes: number[] = []
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < byteWidth; col++) {
          let byte = 0
          for (let bit = 0; bit < 8; bit++) {
            const px  = col * 8 + bit
            const idx = (row * pixelWidth + px) * 4
            const a   = data[idx + 3]
            const r   = data[idx], g = data[idx + 1], b = data[idx + 2]
            // Transparent → treat as white; luminance threshold at 128
            const gray = a < 128 ? 255 : r * 0.299 + g * 0.587 + b * 0.114
            if (gray < 128) byte |= (0x80 >> bit)
          }
          bytes.push(byte)
        }
      }
      resolve({ bytes, byteWidth, height: h })
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}
