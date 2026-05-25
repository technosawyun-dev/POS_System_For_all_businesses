// Quagga2 is loaded as a browser global via /quagga.min.js in index.html
// to avoid Vite pre-bundler CJS→ESM conversion issues.
declare const Quagga: {
  decodeSingle: (config: unknown, callback: (result: unknown) => void) => void
}

interface QuaggaResult {
  codeResult?: { code?: string | null }
}

// Decodes 1D barcodes: EAN-13, UPC-A, EAN-8, UPC-E,
// Code-128, Code-39, Code-93, Codabar — from a canvas frame.
export function detect1D(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise(resolve => {
    if (typeof Quagga === 'undefined') { resolve(null); return }
    try {
      Quagga.decodeSingle(
        {
          src: canvas.toDataURL('image/jpeg', 0.9),
          numOfWorkers: 0,
          locate: true,
          inputStream: { size: Math.min(canvas.width, 800) },
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'upc_reader',
              'upc_e_reader',
              'code_128_reader',
              'code_39_reader',
              'code_93_reader',
              'codabar_reader',
            ],
            multiple: false,
          },
        },
        (result: unknown) => {
          const code = (result as QuaggaResult)?.codeResult?.code?.trim()
          resolve(code || null)
        },
      )
    } catch {
      resolve(null)
    }
  })
}
