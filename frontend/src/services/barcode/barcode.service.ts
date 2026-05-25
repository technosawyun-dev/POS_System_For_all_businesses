import JsBarcode from 'jsbarcode'

function getFormat(value: string): string {
  if (/^\d{13}$/.test(value)) return 'EAN13'
  if (/^\d{12}$/.test(value)) return 'UPC'
  if (/^\d{8}$/.test(value)) return 'EAN8'
  return 'CODE128'
}

function generate(value: string, opts: { height?: number; width?: number } = {}): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, {
    format: getFormat(value),
    height: opts.height ?? 80,
    width: opts.width ?? 2,
    displayValue: true,
    fontSize: 14,
    margin: 8,
    background: '#ffffff',
    lineColor: '#000000',
  })
  return canvas.toDataURL('image/png')
}

export const barcodeService = {
  generateDataUrl(value: string): string {
    return generate(value)
  },

  generatePrintDataUrl(value: string): string {
    return generate(value, { height: 120, width: 3 })
  },

  download(value: string, filename: string): void {
    const dataUrl = generate(value, { height: 120, width: 3 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${filename}-barcode.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },

  async copyToClipboard(text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
  },

  getFormat,
}
