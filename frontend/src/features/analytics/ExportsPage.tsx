import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { analyticsService } from '@/services/analytics/analytics.service'
import { useAnalyticsFilters, AnalyticsFilters } from './analyticsHelpers'
import { Btn, Spinner } from '@/components/ui'
import { useTenantStore } from '@/store/tenant.store'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function ExportCard({
  title,
  description,
  columns,
  exports,
}: {
  title: string
  description: string
  columns: { label: string; cols: string[] }[]
  exports: { label: string; loading: boolean; onClick: () => void; variant?: 'csv' | 'xlsx' }[]
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {columns.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.cols.map(col => (
                <span
                  key={col}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-[10px] font-mono"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {exports.map(exp => (
            <Btn
              key={exp.label}
              variant={exp.variant === 'xlsx' ? 'primary' : 'secondary'}
              size="sm"
              onClick={exp.onClick}
              disabled={exp.loading}
            >
              {exp.loading
                ? <><Spinner size={14} /> Generating…</>
                : exp.variant === 'xlsx'
                  ? <>⬇ {exp.label}</>
                  : <>↓ {exp.label}</>
              }
            </Btn>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  )
}

type LoadingKey =
  | 'salesCsv' | 'salesXlsx'
  | 'ordersCsv' | 'ordersXlsx'
  | 'topProdCsv' | 'topProdXlsx'
  | 'cashierCsv' | 'cashierXlsx'
  | 'catCsv' | 'catXlsx'
  | 'pmCsv' | 'pmXlsx'
  | 'trendCsv' | 'trendXlsx'
  | 'profitCsv' | 'profitXlsx'
  | 'invCsv' | 'invXlsx'
  | 'lowCsv' | 'lowXlsx'
  | 'fastCsv' | 'fastXlsx'
  | 'deadCsv' | 'deadXlsx'
  | 'moveCsv' | 'moveXlsx'
  | 'custCsv' | 'custXlsx'
  | 'poCsv' | 'poXlsx'
  | 'grCsv' | 'grXlsx'
  | 'spCsv' | 'spXlsx'

export default function ExportsPage() {
  const filters = useAnalyticsFilters()
  const { from, to, branch, apiParams } = filters
  const { availableBranches } = useTenantStore()

  const [loading, setLoading] = useState<Partial<Record<LoadingKey, boolean>>>({})
  const setL = (key: LoadingKey, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }))

  const effectiveFrom = from || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const effectiveTo   = to   || format(new Date(), 'yyyy-MM-dd')

  const effectiveParams = {
    ...apiParams,
    start_date: effectiveFrom,
    end_date:   effectiveTo,
  }

  function buildFilename(prefix: string, fmt: 'csv' | 'xlsx') {
    const branchName = branch
      ? (availableBranches.find(b => b.id === branch)?.name ?? branch)
      : 'all'
    return `${prefix}_${effectiveFrom}_${effectiveTo}_${branchName}.${fmt}`
  }

  async function handle(key: LoadingKey, fn: () => Promise<Blob>, filename: string) {
    setL(key, true)
    try {
      const blob = await fn()
      triggerDownload(blob, filename)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setL(key, false)
    }
  }

  const branchParam = branch ? { branch_id: branch } : {}

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Data Exports</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Download CSV or <span className="text-emerald-400 font-medium">Excel (.xlsx)</span> files
            for the selected period. Each file includes a{' '}
            <span className="text-zinc-300 font-medium">TOTAL row</span> at the bottom.
          </p>
        </div>
        <AnalyticsFilters {...filters} />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          Exporting: <span className="text-zinc-300 font-mono">{effectiveFrom}</span>
          <span>→</span>
          <span className="text-zinc-300 font-mono">{effectiveTo}</span>
          {branch && availableBranches.length > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-300">
                {availableBranches.find(b => b.id === branch)?.name ?? 'Branch'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* SALES DATA */}
      <SectionHeader label="Sales Data" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Sales & Refunds"
          description="Complete transaction record — all orders followed by refund line items."
          columns={[
            {
              label: 'Sales columns',
              cols: ['Order Number', 'Date', 'Branch', 'Cashier', 'Customer',
                     'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Methods',
                     'Status', 'Refunded Amount', 'Net Amount'],
            },
            {
              label: 'Refunds columns',
              cols: ['Refund Number', 'Refund Date', 'Original Order', 'Branch',
                     'Customer', 'Product', 'Qty', 'Line Refund Amount',
                     'Total Refund Amount', 'Reason', 'Type', 'Processed By'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.salesCsv,
              onClick: () => handle('salesCsv',
                () => analyticsService.exportSalesRefunds({ ...effectiveParams, format: 'csv' }),
                buildFilename('sales_refunds', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.salesXlsx,
              onClick: () => handle('salesXlsx',
                () => analyticsService.exportSalesRefunds({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('sales_refunds', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Order Line Items"
          description="Every order expanded into per-product rows — ideal for COGS and margin analysis."
          columns={[
            {
              label: 'Columns',
              cols: ['Order Number', 'Order Date', 'Branch', 'Cashier', 'Customer',
                     'Product', 'Variant', 'SKU', 'Qty',
                     'Unit Price', 'Unit Cost', 'Discount', 'Tax Rate',
                     'Line Subtotal', 'Line Total', 'Order Total',
                     'Payment Methods', 'Order Status'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.ordersCsv,
              onClick: () => handle('ordersCsv',
                () => analyticsService.exportOrders({ ...effectiveParams, format: 'csv' }),
                buildFilename('orders', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.ordersXlsx,
              onClick: () => handle('ordersXlsx',
                () => analyticsService.exportOrders({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('orders', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Top Products"
          description="Products ranked by revenue for the selected period, with margin estimates."
          columns={[
            {
              label: 'Columns',
              cols: ['Rank', 'Product', 'SKU', 'Units Sold', 'Revenue',
                     'Avg Unit Price', 'Profit Estimate', 'Margin %'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.topProdCsv,
              onClick: () => handle('topProdCsv',
                () => analyticsService.exportTopProducts({ ...effectiveParams, format: 'csv' }),
                buildFilename('top_products', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.topProdXlsx,
              onClick: () => handle('topProdXlsx',
                () => analyticsService.exportTopProducts({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('top_products', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Sales by Cashier"
          description="Staff performance breakdown — orders, revenue, refunds, and average ticket."
          columns={[
            {
              label: 'Columns',
              cols: ['Cashier', 'Orders', 'Gross Sales', 'Refunds', 'Net Sales', 'Avg Order Value'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.cashierCsv,
              onClick: () => handle('cashierCsv',
                () => analyticsService.exportSalesByCashier({ ...effectiveParams, format: 'csv' }),
                buildFilename('sales_by_cashier', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.cashierXlsx,
              onClick: () => handle('cashierXlsx',
                () => analyticsService.exportSalesByCashier({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('sales_by_cashier', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Sales by Category"
          description="Revenue and profit grouped by product category with percentage share."
          columns={[
            {
              label: 'Columns',
              cols: ['Category', 'Units Sold', 'Revenue', 'Share %', 'Profit Estimate'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.catCsv,
              onClick: () => handle('catCsv',
                () => analyticsService.exportSalesByCategory({ ...effectiveParams, format: 'csv' }),
                buildFilename('sales_by_category', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.catXlsx,
              onClick: () => handle('catXlsx',
                () => analyticsService.exportSalesByCategory({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('sales_by_category', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Payment Methods"
          description="Transaction count, total amount, and percentage share per payment method."
          columns={[
            {
              label: 'Columns',
              cols: ['Payment Method', 'Transactions', 'Total Amount', 'Share %'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.pmCsv,
              onClick: () => handle('pmCsv',
                () => analyticsService.exportPaymentMethods({ ...effectiveParams, format: 'csv' }),
                buildFilename('payment_methods', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.pmXlsx,
              onClick: () => handle('pmXlsx',
                () => analyticsService.exportPaymentMethods({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('payment_methods', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Sales Trend (Daily)"
          description="Day-by-day orders, gross sales, and net revenue for the selected period."
          columns={[
            {
              label: 'Columns',
              cols: ['Period', 'Orders', 'Gross Sales', 'Net Revenue'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.trendCsv,
              onClick: () => handle('trendCsv',
                () => analyticsService.exportSalesTrend({ ...effectiveParams, granularity: 'daily', format: 'csv' }),
                buildFilename('sales_trend_daily', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.trendXlsx,
              onClick: () => handle('trendXlsx',
                () => analyticsService.exportSalesTrend({ ...effectiveParams, granularity: 'daily', format: 'xlsx' }),
                buildFilename('sales_trend_daily', 'xlsx')),
            },
          ]}
        />
      </div>

      {/* FINANCIAL */}
      <SectionHeader label="Financial" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Profit Report"
          description="Gross profit and margin % broken down by product, category, and branch — all in one file."
          columns={[
            {
              label: 'By Product / Category / Branch (3 sheets)',
              cols: ['Dimension', 'Revenue', 'COGS', 'Gross Profit', 'Margin %'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.profitCsv,
              onClick: () => handle('profitCsv',
                () => analyticsService.exportProfitReport({ ...effectiveParams, format: 'csv' }),
                buildFilename('profit_report', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.profitXlsx,
              onClick: () => handle('profitXlsx',
                () => analyticsService.exportProfitReport({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('profit_report', 'xlsx')),
            },
          ]}
        />
      </div>

      {/* INVENTORY */}
      <SectionHeader label="Inventory" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Inventory Stocks"
          description="Current stock snapshot — quantities, reorder thresholds, unit costs, and total stock value."
          columns={[
            {
              label: 'Columns',
              cols: ['Branch', 'Category', 'Product', 'Variant', 'SKU',
                     'On Hand', 'Reserved', 'Available',
                     'Reorder Point', 'Reorder Qty',
                     'Unit Cost', 'Stock Value', 'Last Movement'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.invCsv,
              onClick: () => handle('invCsv',
                () => analyticsService.exportInventoryStocks({ ...branchParam, format: 'csv' }),
                `inventory_stocks_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.csv`),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.invXlsx,
              onClick: () => handle('invXlsx',
                () => analyticsService.exportInventoryStocks({ ...branchParam, format: 'xlsx' }),
                `inventory_stocks_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.xlsx`),
            },
          ]}
        />

        <ExportCard
          title="Low Stock Items"
          description="Items below their reorder point — includes shortage quantity for immediate action."
          columns={[
            {
              label: 'Columns',
              cols: ['Branch', 'Product', 'SKU', 'On Hand', 'Reorder Point', 'Shortage'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.lowCsv,
              onClick: () => handle('lowCsv',
                () => analyticsService.exportLowStock({ ...branchParam, format: 'csv' }),
                `low_stock_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.csv`),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.lowXlsx,
              onClick: () => handle('lowXlsx',
                () => analyticsService.exportLowStock({ ...branchParam, format: 'xlsx' }),
                `low_stock_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.xlsx`),
            },
          ]}
        />

        <ExportCard
          title="Fast Moving Products"
          description="Top 500 products ranked by units sold in the selected period."
          columns={[
            {
              label: 'Columns',
              cols: ['Rank', 'Product', 'SKU', 'Units Sold', 'Order Count'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.fastCsv,
              onClick: () => handle('fastCsv',
                () => analyticsService.exportFastMoving({ ...effectiveParams, format: 'csv' }),
                buildFilename('fast_moving', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.fastXlsx,
              onClick: () => handle('fastXlsx',
                () => analyticsService.exportFastMoving({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('fast_moving', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Dead Stock"
          description="Products with no sales activity in the last 90 days — useful for clearance planning."
          columns={[
            {
              label: 'Columns',
              cols: ['Product', 'SKU', 'On Hand', 'Last Sold', 'Days Without Sale'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.deadCsv,
              onClick: () => handle('deadCsv',
                () => analyticsService.exportDeadStock({ ...branchParam, days: 90, format: 'csv' }),
                `dead_stock_90d_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.csv`),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.deadXlsx,
              onClick: () => handle('deadXlsx',
                () => analyticsService.exportDeadStock({ ...branchParam, days: 90, format: 'xlsx' }),
                `dead_stock_90d_${branch ? (availableBranches.find(b => b.id === branch)?.name ?? branch) : 'all'}.xlsx`),
            },
          ]}
        />

        <ExportCard
          title="Stock Movements"
          description="Individual inventory movements — sales, purchases, adjustments, transfers (up to 10 000 rows)."
          columns={[
            {
              label: 'Columns',
              cols: ['Date', 'Branch', 'Product', 'Variant', 'SKU',
                     'Movement Type', 'Qty Change', 'Unit Cost', 'Movement Value',
                     'Reference Type', 'Reason', 'Notes'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.moveCsv,
              onClick: () => handle('moveCsv',
                () => analyticsService.exportStockMovements({ ...effectiveParams, format: 'csv' }),
                buildFilename('stock_movements', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.moveXlsx,
              onClick: () => handle('moveXlsx',
                () => analyticsService.exportStockMovements({ ...effectiveParams, format: 'xlsx' }),
                buildFilename('stock_movements', 'xlsx')),
            },
          ]}
        />
      </div>

      {/* CUSTOMERS */}
      <SectionHeader label="Customers" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Customer List"
          description="All customers with contact info, balance, credit limit, order history, and status."
          columns={[
            {
              label: 'Columns',
              cols: ['Code', 'Name', 'Phone', 'Email', 'Gender',
                     'Balance', 'Credit Limit', 'Total Orders', 'Total Spent',
                     'Status', 'Member Since'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.custCsv,
              onClick: () => handle('custCsv',
                () => analyticsService.exportCustomers({ format: 'csv' }),
                'customers_all.csv'),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.custXlsx,
              onClick: () => handle('custXlsx',
                () => analyticsService.exportCustomers({ format: 'xlsx' }),
                'customers_all.xlsx'),
            },
          ]}
        />
      </div>

      {/* PROCUREMENT */}
      <SectionHeader label="Procurement" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Purchase Orders"
          description="All PO line items — supplier, product, ordered vs received quantities, and costs."
          columns={[
            {
              label: 'Columns',
              cols: ['PO Number', 'Order Date', 'Supplier', 'Branch', 'Status',
                     'Product', 'Variant', 'SKU',
                     'Ordered Qty', 'Received Qty', 'Unit Cost', 'Line Total',
                     'Expected Date', 'Notes'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.poCsv,
              onClick: () => handle('poCsv',
                () => analyticsService.exportPurchaseOrders({ start_date: effectiveFrom, end_date: effectiveTo, format: 'csv' }),
                buildFilename('purchase_orders', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.poXlsx,
              onClick: () => handle('poXlsx',
                () => analyticsService.exportPurchaseOrders({ start_date: effectiveFrom, end_date: effectiveTo, format: 'xlsx' }),
                buildFilename('purchase_orders', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Goods Receipts"
          description="Received inventory line items — receipt number, PO reference, quantities, and costs."
          columns={[
            {
              label: 'Columns',
              cols: ['Receipt Number', 'Receipt Date', 'PO Reference', 'Supplier', 'Branch', 'Status',
                     'Product', 'Variant', 'SKU',
                     'Received Qty', 'Unit Cost', 'Line Total', 'Notes'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.grCsv,
              onClick: () => handle('grCsv',
                () => analyticsService.exportGoodsReceipts({ start_date: effectiveFrom, end_date: effectiveTo, format: 'csv' }),
                buildFilename('goods_receipts', 'csv')),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.grXlsx,
              onClick: () => handle('grXlsx',
                () => analyticsService.exportGoodsReceipts({ start_date: effectiveFrom, end_date: effectiveTo, format: 'xlsx' }),
                buildFilename('goods_receipts', 'xlsx')),
            },
          ]}
        />

        <ExportCard
          title="Supplier Payables"
          description="Outstanding and paid supplier invoices — total, paid, remaining amounts, and status."
          columns={[
            {
              label: 'Columns',
              cols: ['Supplier', 'PO Number', 'PO Date', 'Branch',
                     'Invoice Amount', 'Paid Amount', 'Remaining Amount', 'Status'],
            },
          ]}
          exports={[
            {
              label: 'CSV',
              variant: 'csv',
              loading: !!loading.spCsv,
              onClick: () => handle('spCsv',
                () => analyticsService.exportSupplierPayables({ format: 'csv' }),
                'supplier_payables_all.csv'),
            },
            {
              label: 'Excel (.xlsx)',
              variant: 'xlsx',
              loading: !!loading.spXlsx,
              onClick: () => handle('spXlsx',
                () => analyticsService.exportSupplierPayables({ format: 'xlsx' }),
                'supplier_payables_all.xlsx'),
            },
          ]}
        />
      </div>

      {/* Help note */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-xs text-zinc-500 space-y-1">
        <p className="font-medium text-zinc-400">How to open in Google Sheets</p>
        <p>File → Import → Upload → select the file → "Replace spreadsheet" → Import data.</p>
        <p className="font-medium text-zinc-400 pt-1">Excel (.xlsx) files</p>
        <p>Open directly in Excel or Google Sheets — headers are styled amber, numbers are numeric, columns are auto-sized.</p>
        <p className="font-medium text-zinc-400 pt-1">CSV files</p>
        <p>Double-click to open in Excel, or File → Open. Encoding is UTF-8 with BOM for automatic detection.</p>
      </div>
    </div>
  )
}
