// pos-login.jsx — Login, Session Open, Session Close screens

const { USERS_DATA: loginUsers, ROLE_LABELS: loginRoleLabels, ROLE_BADGE_STYLES: loginRoleStyles, fmt: loginFmt } = window;
const { useApp: loginUseApp, fmtDateTime: loginFmtDT } = window;
const { useState: loginUseState } = React;

// Login Screen
function LoginScreen() {
  const { dispatch } = loginUseApp();
  const [email, setEmail]         = loginUseState('alex@nexuspos.io');
  const [password, setPassword]   = loginUseState('••••••••');
  const [loading, setLoading]     = loginUseState(false);
  const [error, setError]         = loginUseState('');
  const [selectedRole, setSelected] = loginUseState(null);

  const handleQuickLogin = (user) => {
    setEmail(user.email);
    setPassword('••••••••');
    setSelected(user.id);
    setError('');
  };

  const handleLogin = () => {
    setError('');
    const user = loginUsers.find(u => u.email === email);
    if (!user) { setError('No account found for that email address.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      dispatch({ type: 'LOGIN', payload: user });
    }, 800);
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #F59E0B 0px, #F59E0B 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #F59E0B 0px, #F59E0B 1px, transparent 1px, transparent 48px)',
      }} />

      <div className="relative w-full max-w-sm mx-4 animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 mb-4 shadow-xl shadow-amber-900/40">
            <span className="text-black font-black text-2xl">N</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">NexusPOS</h1>
          <p className="text-sm text-zinc-500 mt-1">Enterprise Point of Sale</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {/* Quick login */}
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Sign in as</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {loginUsers.map(user => {
              const rs = loginRoleStyles[user.role];
              const isSelected = selectedRole === user.id;
              return (
                <button
                  key={user.id}
                  onClick={() => handleQuickLogin(user)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all border ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: rs.bg, color: rs.text }}>
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{user.name.split(' ')[0]}</p>
                    <p className="text-[10px]" style={{ color: rs.text }}>{loginRoleLabels[user.role]}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Divider label="or enter credentials" />

          <div className="flex flex-col gap-3 mt-4">
            <Input
              label="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setSelected(null); }}
              placeholder="cashier@store.com"
              type="email"
              onKeyDown={handleKey}
            />
            <Input
              label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              onKeyDown={handleKey}
            />
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <IconAlert width="12" height="12" /> {error}
              </p>
            )}
            <Btn
              variant="primary"
              size="lg"
              onClick={handleLogin}
              disabled={loading || !email}
              fullWidth
              className="mt-1"
            >
              {loading ? <><Spinner size={16} /> Signing in…</> : 'Sign In'}
            </Btn>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-700 mt-6">
          NexusPOS v5.0 · Main Branch · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// Session Open Screen
function SessionOpenScreen() {
  const { state, dispatch } = loginUseApp();
  const { user } = state;
  const [balance, setBalance] = loginUseState('200.00');
  const [loading, setLoading] = loginUseState(false);

  const rs = loginRoleStyles[user?.role] || loginRoleStyles.CASHIER;

  const handleOpen = () => {
    const amount = parseFloat(balance);
    if (isNaN(amount) || amount < 0) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      dispatch({ type: 'OPEN_SESSION', payload: amount });
      dispatch({ type: 'SHOW_TOAST', payload: { message: `Session opened · ${loginFmt(amount)} float`, type: 'success' } });
    }, 700);
  };

  const QUICK_FLOATS = [50, 100, 200, 300, 500];

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #F59E0B 0px, #F59E0B 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #F59E0B 0px, #F59E0B 1px, transparent 1px, transparent 48px)',
      }} />

      <div className="relative w-full max-w-sm mx-4 animate-fadeIn">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 mb-3">
            <IconCash width="22" height="22" className="text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Open Cash Register</h2>
          <p className="text-sm text-zinc-500 mt-1">Enter the opening float for your session</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {/* Cashier info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-800 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: rs.bg, color: rs.text }}>
              {user?.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{user?.name}</p>
              <p className="text-xs" style={{ color: rs.text }}>{loginRoleLabels[user?.role]}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-zinc-600">Date</p>
              <p className="text-xs text-zinc-400 font-mono">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Opening balance input */}
          <div className="mb-4">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">Opening Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-lg pointer-events-none">$</span>
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOpen()}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-right pr-4 pl-10 py-3.5 text-xl font-mono font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
          </div>

          {/* Quick floats */}
          <div className="flex flex-wrap gap-2 mb-5">
            {QUICK_FLOATS.map(amt => (
              <button
                key={amt}
                onClick={() => setBalance(amt.toFixed(2))}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                  parseFloat(balance) === amt
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          <Btn variant="primary" size="xl" onClick={handleOpen} disabled={loading} fullWidth>
            {loading ? <><Spinner size={16} />Opening…</> : <><IconChevRight />Open Session</>}
          </Btn>

          <button
            onClick={() => dispatch({ type: 'LOGOUT' })}
            className="w-full mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

// Session Close Screen (modal-style)
function SessionCloseScreen() {
  const { state, dispatch } = loginUseApp();
  const { session, sales } = state;
  const [actual, setActual] = loginUseState('');
  const [loading, setLoading] = loginUseState(false);

  // Calculate session totals
  const sessionStart = session?.startTime ? new Date(session.startTime) : new Date();
  const sessionSales = sales.filter(s => new Date(s.date) >= sessionStart && s.status === 'completed');
  const cashSales = sessionSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
  const cardSales = sessionSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);
  const totalRevenue = sessionSales.reduce((sum, s) => sum + s.total, 0);
  const expectedCash = (session?.openingBalance || 0) + cashSales;
  const actualAmt = parseFloat(actual) || 0;
  const discrepancy = actualAmt - expectedCash;

  const handleClose = () => {
    setLoading(true);
    setTimeout(() => {
      dispatch({ type: 'CLOSE_SESSION' });
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Session closed successfully', type: 'success' } });
    }, 800);
  };

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950 overflow-y-auto py-8">
      <div className="w-full max-w-md mx-4 animate-fadeIn">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 mb-3">
            <IconLogout width="22" height="22" className="text-zinc-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Close Session</h2>
          <p className="text-xs text-zinc-500 mt-1 font-mono">{session?.id} · Started {loginFmtDT(sessionStart)}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
          {/* Session summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Orders</p>
              <p className="text-xl font-bold text-zinc-100 font-mono mt-0.5">{sessionSales.length}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Revenue</p>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{loginFmt(totalRevenue)}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Card</p>
              <p className="text-xl font-bold text-blue-400 font-mono mt-0.5">{loginFmt(cardSales)}</p>
            </div>
          </div>

          <Divider />

          {/* Cash reconciliation */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Cash Reconciliation</p>
            <div className="space-y-2 mb-4">
              {[
                { label: 'Opening float',  value: session?.openingBalance || 0, color: 'text-zinc-300' },
                { label: 'Cash sales',     value: cashSales, color: 'text-green-400' },
                { label: 'Expected cash',  value: expectedCash, color: 'text-amber-400', bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-500">{row.label}</span>
                  <span className={`font-mono ${row.color} ${row.bold ? 'font-semibold' : ''}`}>{loginFmt(row.value)}</span>
                </div>
              ))}
            </div>

            <Input
              label="Actual cash in drawer"
              value={actual}
              onChange={e => setActual(e.target.value)}
              placeholder="0.00"
              type="number"
              prefix={<span className="font-mono text-sm">$</span>}
            />

            {actual && (
              <div className={`mt-3 p-3 rounded-xl flex items-center justify-between text-sm ${
                Math.abs(discrepancy) < 0.01 ? 'bg-green-950/50 border border-green-900/50' :
                discrepancy < 0 ? 'bg-red-950/50 border border-red-900/50' : 'bg-amber-950/50 border border-amber-900/50'
              }`}>
                <span className="text-zinc-400">Discrepancy</span>
                <span className={`font-mono font-semibold ${
                  Math.abs(discrepancy) < 0.01 ? 'text-green-400' :
                  discrepancy < 0 ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {discrepancy >= 0 ? '+' : ''}{loginFmt(discrepancy)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Btn variant="secondary" size="lg" onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'pos' })} className="flex-1">
              Cancel
            </Btn>
            <Btn variant="danger" size="lg" onClick={handleClose} disabled={loading} className="flex-1">
              {loading ? <Spinner size={16} /> : <IconLogout width="15" height="15" />}
              {loading ? 'Closing…' : 'Close Session'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, SessionOpenScreen, SessionCloseScreen });
