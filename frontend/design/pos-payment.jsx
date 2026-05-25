// pos-payment.jsx — Payment modal, numpad, receipt screen

const { useApp: payUseApp, fmt: payFmt, fmtDateTime: payFmtDT } = window;
const { useState: payUseState, useEffect: payUseEffect, useMemo: payUseMemo, useCallback: payUseCallback } = React;

// Numeric Keypad
function NumPad({ value, onChange }) {
  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

  const handle = (k) => {
    if (k === '⌫') {
      const next = value.slice(0, -1);
      onChange(next || '');
    } else if (k === '.') {
      if (value.includes('.')) return;
      onChange((value || '0') + '.');
    } else {
      // Limit decimal places to 2
      if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
      onChange(value === '0' ? k : value + k);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map(k => (
        <button
          key={k}
          onClick={() => handle(k)}
          className={`h-12 rounded-xl font-mono font-semibold text-lg transition-all duration-100 active:scale-95 ${
            k === '⌫'
              ? 'bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400'
              : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// Quick Bill Buttons
function QuickBills({ total, onSelect }) {
  const BILLS = [5, 10, 20, 50, 100, 200, 500];
  const minBill = BILLS.find(b => b >= total) || BILLS[BILLS.length - 1];
  const options = [total, ...BILLS.filter(b => b >= minBill && b !== total)].slice(0, 5);

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((a, i) => (
        <button
          key={i}
          onClick={() => onSelect(a.toFixed(2))}
          className={`px-3 py-2 rounded-xl text-sm font-mono font-semibold border transition-all ${
            i === 0
              ? 'bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
          }`}
        >
          {i === 0 ? 'Exact' : payFmt(a)}
        </button>
      ))}
    </div>
  );
}

// Cash Payment
function CashPayment({ total, amount, onAmountChange, onProcess }) {
  const tendered = parseFloat(amount) || 0;
  const change = tendered - total;
  const canProcess = tendered >= total;

  return (
    <div className="flex flex-col gap-4">
      {/* Amount display */}
      <div className="bg-zinc-800/60 rounded-2xl p-4 text-right">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Amount Tendered</p>
        <p className="font-mono text-3xl font-black text-zinc-100 tracking-tight">
          {amount ? payFmt(parseFloat(amount)) : <span className="text-zinc-600">$0.00</span>}
        </p>
        {change >= 0 && amount && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-xs text-zinc-500">Change due</span>
            <span className="font-mono font-bold text-green-400 text-lg">{payFmt(change)}</span>
          </div>
        )}
        {amount && change < 0 && (
          <p className="text-xs text-red-400 mt-1">Insufficient amount · {payFmt(Math.abs(change))} remaining</p>
        )}
      </div>

      {/* Quick bills */}
      <QuickBills total={total} onSelect={onAmountChange} />

      {/* Numpad */}
      <NumPad value={amount} onChange={onAmountChange} />

      {/* Process button */}
      <button
        onClick={onProcess}
        disabled={!canProcess}
        className={`w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
          canProcess
            ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow-xl shadow-amber-900/40'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
        }`}
      >
        <IconCash width="20" height="20" />
        Process Payment
      </button>
    </div>
  );
}

// Card Payment
function CardPayment({ total, onProcess }) {
  const [processing, setProcessing] = payUseState(false);

  const handle = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onProcess(); }, 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Card total */}
      <div className="bg-zinc-800/60 rounded-2xl p-6 text-center">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Charge to card</p>
        <p className="font-mono text-4xl font-black text-zinc-100">{payFmt(total)}</p>
      </div>

      {/* Card terminal illustration */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <IconCard width="36" height="36" className="text-blue-400" />
        </div>
        {processing ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size={24} />
            <p className="text-sm text-zinc-300 font-medium">Processing…</p>
            <p className="text-xs text-zinc-600">Please wait, do not remove card</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-zinc-300 font-medium">Present card to terminal</p>
            <p className="text-xs text-zinc-600 mt-1">Tap, chip, or swipe</p>
          </div>
        )}
      </div>

      <button
        onClick={handle}
        disabled={processing}
        className={`w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
          processing
            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xl shadow-blue-900/40'
        }`}
      >
        {processing ? <Spinner size={18} /> : <IconCard width="20" height="20" />}
        {processing ? 'Processing…' : 'Charge Card'}
      </button>
    </div>
  );
}

// Split Payment
function SplitPayment({ total, splitPayments, onAdd, onRemove, onProcess }) {
  const [method, setMethod] = payUseState('cash');
  const [amount, setAmount]  = payUseState('');

  const paid = splitPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const canAdd = parseFloat(amount) > 0 && parseFloat(amount) <= remaining + 0.01;
  const canProcess = remaining < 0.01;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ method, amount: parseFloat(amount) });
    setAmount('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="bg-zinc-800/60 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500">Split total</span>
          <span className="font-mono font-bold text-zinc-100">{payFmt(total)}</span>
        </div>
        <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-400">{payFmt(paid)} paid</span>
          <span className={remaining > 0 ? 'text-zinc-400' : 'text-green-400'}>{remaining > 0 ? `${payFmt(remaining)} remaining` : 'Fully covered'}</span>
        </div>
      </div>

      {/* Payments added */}
      {splitPayments.map((p, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
          {p.method === 'cash' ? <IconCash width="14" height="14" className="text-amber-400" /> : <IconCard width="14" height="14" className="text-blue-400" />}
          <span className="text-xs text-zinc-300 capitalize flex-1">{p.method}</span>
          <span className="font-mono text-sm font-semibold text-zinc-100">{payFmt(p.amount)}</span>
          <button onClick={() => onRemove(i)} className="text-zinc-600 hover:text-red-400 ml-1">
            <IconX width="12" height="12" />
          </button>
        </div>
      ))}

      {/* Add payment */}
      {remaining > 0.01 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={() => setMethod('cash')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${method==='cash' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
              <IconCash width="12" height="12" />Cash
            </button>
            <button onClick={() => setMethod('card')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${method==='card' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
              <IconCard width="12" height="12" />Card
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm pointer-events-none">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={remaining.toFixed(2)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm font-mono pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
            <Btn variant="secondary" size="md" onClick={handleAdd} disabled={!canAdd}>
              <IconPlus width="14" height="14" />Add
            </Btn>
          </div>
        </div>
      )}

      <button
        onClick={onProcess}
        disabled={!canProcess}
        className={`w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
          canProcess
            ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow-xl shadow-amber-900/40'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
        }`}
      >
        Process Split Payment
      </button>
    </div>
  );
}

// Processing Screen
function ProcessingScreen() {
  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-2 border-zinc-800 flex items-center justify-center">
          <Spinner size={36} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-zinc-100">Processing Payment</p>
        <p className="text-sm text-zinc-500 mt-1">Please wait…</p>
      </div>
    </div>
  );
}

// Receipt Screen
function ReceiptScreen() {
  const { state, dispatch } = payUseApp();
  const { completedSale } = state;
  if (!completedSale) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fadeIn">
        {/* Success banner */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-3">
            <IconCheck width="28" height="28" className="text-green-400" />
          </div>
          <p className="text-xl font-bold text-zinc-100">Payment Complete</p>
          <p className="text-sm text-zinc-500 mt-1">{completedSale.id}</p>
        </div>

        {/* Receipt card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-5 py-4 border-b border-zinc-800">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-500">NexusPOS · Main Branch</p>
              <p className="text-xs text-zinc-500 font-mono">{payFmtDT(completedSale.date)}</p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-1.5">
            {completedSale.items.slice(0, 4).map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-zinc-400 truncate max-w-[160px]">{item.name} ×{item.qty}</span>
                <span className="font-mono text-zinc-300">{payFmt(item.price * item.qty)}</span>
              </div>
            ))}
            {completedSale.items.length > 4 && (
              <p className="text-xs text-zinc-600">+{completedSale.items.length - 4} more items</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-zinc-800 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Subtotal</span><span className="font-mono text-zinc-300">{payFmt(completedSale.subtotal)}</span></div>
            {completedSale.discount > 0 && <div className="flex justify-between text-xs"><span className="text-zinc-500">Discount</span><span className="font-mono text-green-400">–{payFmt(completedSale.discount)}</span></div>}
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Tax</span><span className="font-mono text-zinc-300">{payFmt(completedSale.tax)}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-zinc-200">Total</span><span className="font-mono text-amber-400 text-base">{payFmt(completedSale.total)}</span></div>
          </div>

          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-800/40">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 capitalize flex items-center gap-1.5">
                {completedSale.paymentMethod === 'cash' ? <IconCash width="11" height="11" className="text-amber-400"/> : <IconCard width="11" height="11" className="text-blue-400"/>}
                {completedSale.paymentMethod}
              </span>
              {completedSale.change > 0 && <span className="text-zinc-400 font-mono">Change: <span className="text-green-400">{payFmt(completedSale.change)}</span></span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <Btn variant="secondary" size="lg" className="flex-1" onClick={() => {}}>
            <IconPrint width="15" height="15" />Print
          </Btn>
          <button
            onClick={() => dispatch({ type: 'NEW_SALE' })}
            className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/40"
          >
            <IconPlus width="15" height="15" />
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Payment Overlay (wraps all payment steps)
function PaymentOverlay() {
  const { state, dispatch, cartCalc } = payUseApp();
  const { checkoutStep, paymentMethod, paymentAmount, splitPayments } = state;
  const { total, itemSubtotal, orderDiscAmt, tax } = cartCalc;

  if (checkoutStep === 'processing') return <ProcessingScreen />;
  if (checkoutStep === 'receipt')    return <ReceiptScreen />;
  if (checkoutStep !== 'payment')    return null;

  const METHODS = [
    { id:'cash',  label:'Cash',  icon:<IconCash  width="14" height="14"/>, color:'text-amber-400', activeBg:'bg-amber-500/15 border-amber-500/40' },
    { id:'card',  label:'Card',  icon:<IconCard  width="14" height="14"/>, color:'text-blue-400',  activeBg:'bg-blue-500/15 border-blue-500/40' },
    { id:'split', label:'Split', icon:<IconSplit width="14" height="14"/>, color:'text-violet-400',activeBg:'bg-violet-500/15 border-violet-500/40' },
  ];

  const doProcess = (opts = {}) => {
    dispatch({ type: 'SET_CHECKOUT_STEP', payload: 'processing' });
    setTimeout(() => {
      dispatch({
        type: 'COMPLETE_SALE',
        payload: {
          subtotal: itemSubtotal,
          discount: orderDiscAmt,
          tax,
          total,
          amountTendered: opts.tendered || total,
          change: Math.max(0, (opts.tendered || total) - total),
        },
      });
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => dispatch({ type: 'SET_CHECKOUT_STEP', payload: 'cart' })} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Payment</h2>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{state.cart.items.length} items</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-amber-400">{payFmt(total)}</span>
            <button
              onClick={() => dispatch({ type: 'SET_CHECKOUT_STEP', payload: 'cart' })}
              className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <IconX width="14" height="14" />
            </button>
          </div>
        </div>

        {/* Method selector */}
        <div className="flex gap-2 px-6 py-3 border-b border-zinc-800 flex-shrink-0">
          {METHODS.map(m => {
            const active = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                onClick={() => dispatch({ type: 'SET_PAYMENT_METHOD', payload: m.id })}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  active ? `${m.activeBg} ${m.color}` : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {m.icon}{m.label}
              </button>
            );
          })}
        </div>

        {/* Payment content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {paymentMethod === 'cash' && (
            <CashPayment
              total={total}
              amount={paymentAmount}
              onAmountChange={v => dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: v })}
              onProcess={() => doProcess({ tendered: parseFloat(paymentAmount) || total })}
            />
          )}
          {paymentMethod === 'card' && (
            <CardPayment total={total} onProcess={() => doProcess()} />
          )}
          {paymentMethod === 'split' && (
            <SplitPayment
              total={total}
              splitPayments={splitPayments}
              onAdd={p => dispatch({ type: 'ADD_SPLIT_PAYMENT', payload: p })}
              onRemove={i => dispatch({ type: 'REMOVE_SPLIT_PAYMENT', payload: i })}
              onProcess={() => doProcess()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PaymentOverlay, NumPad, QuickBills, ReceiptScreen });
