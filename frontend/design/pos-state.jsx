// pos-state.jsx — Global app state via React Context + useReducer

const {
  useState, useReducer, useContext, createContext,
  useEffect, useMemo, useCallback, useRef
} = React;

const {
  PRODUCTS_DATA, CATEGORIES_DATA, generateMockSales, TAX_RATE, CURRENCY_SYMBOL
} = window;

const AppContext = createContext(null);

const INITIAL_SYNC_QUEUE = [
  { id:'sq001', type:'SALE_CREATE',      status:'pending', createdAt: new Date(Date.now()-120000), retries:0 },
  { id:'sq002', type:'INVENTORY_UPDATE', status:'failed',  createdAt: new Date(Date.now()-300000), retries:3 },
  { id:'sq003', type:'SALE_CREATE',      status:'pending', createdAt: new Date(Date.now()-60000),  retries:0 },
];

const initialState = {
  screen:          'login',
  user:            null,
  session:         null,
  cart:            { items: [], discount: 0, note: '' },
  products:        PRODUCTS_DATA,
  categories:      CATEGORIES_DATA,
  sales:           [],
  isOnline:        true,
  syncQueue:       INITIAL_SYNC_QUEUE,
  syncStatus:      'idle',
  lastSync:        new Date(Date.now() - 480000),
  toast:           null,
  sidebarOpen:     false,
  checkoutStep:    'cart',
  paymentMethod:   'cash',
  paymentAmount:   '',
  splitPayments:   [],
  completedSale:   null,
  productSearch:   '',
  activeCategory:  'all',
  activeOrderId:   null,
  productEditId:   null,
  adjustingProductId: null,
};

function appReducer(state, action) {
  switch (action.type) {

    case 'INIT_SALES':
      return { ...state, sales: action.payload };

    case 'SET_SCREEN':
      return { ...state, screen: action.payload, sidebarOpen: false };

    case 'LOGIN':
      return { ...state, user: action.payload, screen: 'session-open' };

    case 'LOGOUT':
      return { ...initialState, sales: state.sales };

    case 'OPEN_SESSION':
      return {
        ...state,
        session: {
          id: `SES-${Date.now()}`,
          openingBalance: action.payload,
          startTime: new Date(),
          status: 'open',
          cashier: state.user,
        },
        screen: 'pos',
      };

    case 'CLOSE_SESSION':
      return {
        ...state,
        session: { ...state.session, status: 'closed', endTime: new Date() },
        screen: 'login',
        user: null,
        cart: { items: [], discount: 0, note: '' },
      };

    case 'ADD_TO_CART': {
      const existing = state.cart.items.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: {
            ...state.cart,
            items: state.cart.items.map(i =>
              i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i
            ),
          },
        };
      }
      return {
        ...state,
        cart: {
          ...state.cart,
          items: [...state.cart.items, { ...action.payload, qty: 1, lineDiscount: 0 }],
        },
      };
    }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: { ...state.cart, items: state.cart.items.filter(i => i.id !== action.payload) },
      };

    case 'UPDATE_QTY': {
      const { id, qty } = action.payload;
      if (qty <= 0) {
        return { ...state, cart: { ...state.cart, items: state.cart.items.filter(i => i.id !== id) } };
      }
      return {
        ...state,
        cart: { ...state.cart, items: state.cart.items.map(i => i.id === id ? { ...i, qty } : i) },
      };
    }

    case 'UPDATE_LINE_DISCOUNT':
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.map(i =>
            i.id === action.payload.id ? { ...i, lineDiscount: action.payload.discount } : i
          ),
        },
      };

    case 'SET_CART_DISCOUNT':
      return { ...state, cart: { ...state.cart, discount: action.payload } };

    case 'SET_CART_NOTE':
      return { ...state, cart: { ...state.cart, note: action.payload } };

    case 'CLEAR_CART':
      return { ...state, cart: { items: [], discount: 0, note: '' }, checkoutStep: 'cart', paymentAmount: '' };

    case 'SET_CHECKOUT_STEP':
      return { ...state, checkoutStep: action.payload };

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload, paymentAmount: '', splitPayments: [] };

    case 'SET_PAYMENT_AMOUNT':
      return { ...state, paymentAmount: action.payload };

    case 'ADD_SPLIT_PAYMENT':
      return { ...state, splitPayments: [...state.splitPayments, action.payload] };

    case 'REMOVE_SPLIT_PAYMENT':
      return { ...state, splitPayments: state.splitPayments.filter((_,i) => i !== action.payload) };

    case 'COMPLETE_SALE': {
      const newSale = {
        id: `ORD-${String(Date.now()).slice(-5)}`,
        date: new Date(),
        cashier: state.user,
        items: state.cart.items,
        subtotal: action.payload.subtotal,
        discount: action.payload.discount,
        tax: action.payload.tax,
        total: action.payload.total,
        paymentMethod: state.paymentMethod,
        amountTendered: action.payload.amountTendered,
        change: action.payload.change,
        status: 'completed',
        note: state.cart.note,
      };
      return {
        ...state,
        sales: [newSale, ...state.sales],
        completedSale: newSale,
        checkoutStep: 'receipt',
        syncQueue: [
          ...state.syncQueue,
          { id:`sq${Date.now()}`, type:'SALE_CREATE', status:'pending', createdAt: new Date(), retries:0 },
        ],
      };
    }

    case 'NEW_SALE':
      return {
        ...state,
        cart: { items: [], discount: 0, note: '' },
        checkoutStep: 'cart',
        completedSale: null,
        paymentAmount: '',
        splitPayments: [],
      };

    case 'SET_PRODUCT_SEARCH':
      return { ...state, productSearch: action.payload };

    case 'SET_ACTIVE_CATEGORY':
      return { ...state, activeCategory: action.payload };

    case 'SET_ACTIVE_ORDER':
      return { ...state, activeOrderId: action.payload };

    case 'SET_PRODUCT_EDIT':
      return { ...state, productEditId: action.payload };

    case 'SET_ADJUSTING_PRODUCT':
      return { ...state, adjustingProductId: action.payload };

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload.id ? action.payload : p),
      };

    case 'ADJUST_STOCK':
      return {
        ...state,
        products: state.products.map(p =>
          p.id === action.payload.id
            ? { ...p, stock: Math.max(0, p.stock + action.payload.delta) }
            : p
        ),
        adjustingProductId: null,
      };

    case 'TOGGLE_ONLINE':
      return { ...state, isOnline: !state.isOnline };

    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };

    case 'START_SYNC':
      return { ...state, syncStatus: 'syncing' };

    case 'SYNC_SUCCESS':
      return {
        ...state,
        syncStatus: 'idle',
        lastSync: new Date(),
        syncQueue: state.syncQueue
          .filter(op => op.status !== 'pending')
          .map(op => ({ ...op })),
      };

    case 'SYNC_ERROR':
      return { ...state, syncStatus: 'error' };

    case 'RETRY_SYNC_ITEM':
      return {
        ...state,
        syncQueue: state.syncQueue.map(op =>
          op.id === action.payload ? { ...op, status: 'pending', retries: (op.retries||0) + 1 } : op
        ),
      };

    case 'DISMISS_SYNC_ITEM':
      return {
        ...state,
        syncQueue: state.syncQueue.filter(op => op.id !== action.payload),
      };

    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };

    case 'HIDE_TOAST':
      return { ...state, toast: null };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false };

    default:
      return state;
  }
}

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Init sales data on mount
  useEffect(() => {
    dispatch({ type: 'INIT_SALES', payload: generateMockSales() });
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (state.toast) {
      const t = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3200);
      return () => clearTimeout(t);
    }
  }, [state.toast]);

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true });
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Connection restored — syncing', type: 'success' } });
    };
    const onOffline = () => {
      dispatch({ type: 'SET_ONLINE', payload: false });
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Working offline', type: 'warning' } });
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Cart calculations (memoized)
  const cartCalc = useMemo(() => {
    const itemSubtotal = state.cart.items.reduce((sum, item) => {
      const lineTotal = item.price * item.qty;
      const lineDisc = (item.lineDiscount || 0) / 100 * lineTotal;
      return sum + lineTotal - lineDisc;
    }, 0);
    const orderDiscAmt = (state.cart.discount || 0) / 100 * itemSubtotal;
    const afterDiscount = itemSubtotal - orderDiscAmt;
    const tax = Math.max(0, afterDiscount * TAX_RATE);
    const total = Math.max(0, afterDiscount + tax);
    const itemCount = state.cart.items.reduce((s, i) => s + i.qty, 0);
    return {
      itemSubtotal: Math.round(itemSubtotal * 100) / 100,
      orderDiscAmt: Math.round(orderDiscAmt * 100) / 100,
      tax:          Math.round(tax * 100) / 100,
      total:        Math.round(total * 100) / 100,
      itemCount,
    };
  }, [state.cart]);

  const value = useMemo(() => ({ state, dispatch, cartCalc }), [state, cartCalc]);

  return React.createElement(AppContext.Provider, { value }, children);
}

function useApp() {
  return useContext(AppContext);
}

// Formatters
function fmt(amount) {
  return `${CURRENCY_SYMBOL}${Number(amount || 0).toFixed(2)}`;
}

function fmtDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateTime(date) {
  return `${fmtDate(date)}, ${fmtTime(date)}`;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

Object.assign(window, {
  AppContext, AppProvider, useApp,
  fmt, fmtDate, fmtTime, fmtDateTime, timeAgo,
});
