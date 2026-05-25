// Browser print framework — no vendor SDKs, no native code.
// Works with web, Android WebView, Windows WebView2, WKWebView (iOS/macOS).

// Supported print modes
export type PrintMode = 'receipt-58mm' | 'receipt-80mm' | 'label-40x30' | 'label-50x30'

// Print given HTML content in a new window.
// The caller renders a template component to a string (via ReactDOM.renderToString)
// or passes raw HTML. The function injects it into a hidden window and triggers print.
export function printHtml(html: string, title = 'Print'): void {
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) {
    alert('Allow pop-ups for this site to enable printing.')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: white; color: black; }
  @media screen { body { padding: 16px; background: #f5f5f5; } .print-sheet { background: white; box-shadow: 0 0 8px rgba(0,0,0,.15); margin: 0 auto; } }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: white; padding: 0; } .print-sheet { box-shadow: none; } }
</style>
</head>
<body>
${html}
</body>
</html>`)
  win.document.close()
  // Small delay so images/fonts load before print dialog
  setTimeout(() => {
    win.focus()
    win.print()
    win.close()
  }, 300)
}

// Build a CSS @page rule string for a given paper size
export function pageRule(width: string, height?: string): string {
  const size = height ? `${width} ${height}` : width
  return `@page { size: ${size}; margin: 0; }`
}
