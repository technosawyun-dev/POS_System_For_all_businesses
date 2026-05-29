import type { SVGProps } from 'react'

const IC: SVGProps<SVGSVGElement> = {
  width: '18', height: '18', viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round',
}

type IconProps = SVGProps<SVGSVGElement>

export const IconPOS        = (p: IconProps) => <svg {...IC} {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
export const IconProducts   = (p: IconProps) => <svg {...IC} {...p}><rect x="2" y="2" width="9" height="9" rx="1.5"/><rect x="13" y="2" width="9" height="9" rx="1.5"/><rect x="2" y="13" width="9" height="9" rx="1.5"/><rect x="13" y="13" width="9" height="9" rx="1.5"/></svg>
export const IconInventory  = (p: IconProps) => <svg {...IC} {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
export const IconSales      = (p: IconProps) => <svg {...IC} {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
export const IconSync       = (p: IconProps) => <svg {...IC} {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
export const IconSearch     = (p: IconProps) => <svg {...IC} {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
export const IconCart       = (p: IconProps) => <svg {...IC} {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
export const IconX          = (p: IconProps) => <svg {...IC} {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
export const IconCheck      = (p: IconProps) => <svg {...IC} {...p}><polyline points="20 6 9 17 4 12"/></svg>
export const IconPlus       = (p: IconProps) => <svg {...IC} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
export const IconMinus      = (p: IconProps) => <svg {...IC} {...p}><line x1="5" y1="12" x2="19" y2="12"/></svg>
export const IconChevRight  = (p: IconProps) => <svg {...IC} {...p}><polyline points="9 18 15 12 9 6"/></svg>
export const IconChevLeft   = (p: IconProps) => <svg {...IC} {...p}><polyline points="15 18 9 12 15 6"/></svg>
export const IconChevDown   = (p: IconProps) => <svg {...IC} {...p}><polyline points="6 9 12 15 18 9"/></svg>
export const IconTrash      = (p: IconProps) => <svg {...IC} {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
export const IconEdit       = (p: IconProps) => <svg {...IC} {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
export const IconBarcode    = (p: IconProps) => <svg {...IC} {...p}><path d="M3 5v2M3 11v2M3 17v2M7 5v6M7 15v4M11 5v2M11 11v8M15 5v4M15 13v6M19 5v2M19 11v2M19 17v2"/></svg>
export const IconDiscount   = (p: IconProps) => <svg {...IC} {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/></svg>
export const IconPrint      = (p: IconProps) => <svg {...IC} {...p}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
export const IconRefund     = (p: IconProps) => <svg {...IC} {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
export const IconAlert      = (p: IconProps) => <svg {...IC} {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
export const IconWifi       = (p: IconProps) => <svg {...IC} {...p}><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
export const IconWifiOff    = (p: IconProps) => <svg {...IC} {...p}><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
export const IconMenu       = (p: IconProps) => <svg {...IC} {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
export const IconLogout     = (p: IconProps) => <svg {...IC} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
export const IconCash       = (p: IconProps) => <svg {...IC} {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
export const IconCard       = (p: IconProps) => <svg {...IC} {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
export const IconSplit      = (p: IconProps) => <svg {...IC} {...p}><line x1="16" y1="3" x2="16" y2="21"/><path d="M5 6h8M5 12h8M5 18h8"/></svg>
export const IconReceipt    = (p: IconProps) => <svg {...IC} {...p}><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
export const IconUser       = (p: IconProps) => <svg {...IC} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
export const IconFilter     = (p: IconProps) => <svg {...IC} {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
export const IconTrending   = (p: IconProps) => <svg {...IC} {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
export const IconPackage    = (p: IconProps) => <svg {...IC} {...p}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
export const IconExpand    = (p: IconProps) => <svg {...IC} {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
export const IconCompress  = (p: IconProps) => <svg {...IC} {...p}><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
