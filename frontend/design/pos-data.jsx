// pos-data.jsx — Mock data, constants, permissions

const PRODUCTS_DATA = [
  // Beverages
  { id:'p001', sku:'BEV-001', name:'Espresso',       category:'beverages',   price:3.50,  cost:0.80,  stock:100, unit:'cup',    taxRate:0.10, barcode:'1000000001', color:'#D97706' },
  { id:'p002', sku:'BEV-002', name:'Café Latte',     category:'beverages',   price:5.00,  cost:1.20,  stock:80,  unit:'cup',    taxRate:0.10, barcode:'1000000002', color:'#D97706' },
  { id:'p003', sku:'BEV-003', name:'Cappuccino',     category:'beverages',   price:4.50,  cost:1.00,  stock:60,  unit:'cup',    taxRate:0.10, barcode:'1000000003', color:'#D97706' },
  { id:'p004', sku:'BEV-004', name:'Iced Tea',       category:'beverages',   price:3.00,  cost:0.50,  stock:120, unit:'cup',    taxRate:0.10, barcode:'1000000004', color:'#D97706' },
  { id:'p005', sku:'BEV-005', name:'Fresh OJ',       category:'beverages',   price:4.50,  cost:1.50,  stock:40,  unit:'cup',    taxRate:0.10, barcode:'1000000005', color:'#D97706' },
  { id:'p006', sku:'BEV-006', name:'Mineral Water',  category:'beverages',   price:2.50,  cost:0.40,  stock:200, unit:'bottle', taxRate:0.10, barcode:'1000000006', color:'#D97706' },
  // Food
  { id:'p007', sku:'FOOD-001', name:'Club Sandwich', category:'food',        price:12.50, cost:5.00,  stock:30,  unit:'item',   taxRate:0.10, barcode:'2000000001', color:'#16A34A' },
  { id:'p008', sku:'FOOD-002', name:'Caesar Salad',  category:'food',        price:10.00, cost:3.50,  stock:25,  unit:'item',   taxRate:0.10, barcode:'2000000002', color:'#16A34A' },
  { id:'p009', sku:'FOOD-003', name:'Cheeseburger',  category:'food',        price:14.00, cost:6.00,  stock:20,  unit:'item',   taxRate:0.10, barcode:'2000000003', color:'#16A34A' },
  { id:'p010', sku:'FOOD-004', name:'Choc Muffin',   category:'food',        price:4.50,  cost:1.20,  stock:50,  unit:'item',   taxRate:0.10, barcode:'2000000004', color:'#16A34A' },
  { id:'p011', sku:'FOOD-005', name:'Banana Bread',  category:'food',        price:3.50,  cost:0.90,  stock:35,  unit:'item',   taxRate:0.10, barcode:'2000000005', color:'#16A34A' },
  // Electronics
  { id:'p012', sku:'ELEC-001', name:'USB-C Cable 2m',category:'electronics', price:14.99, cost:4.00,  stock:200, unit:'item',   taxRate:0.15, barcode:'3000000001', color:'#2563EB' },
  { id:'p013', sku:'ELEC-002', name:'Phone Case',    category:'electronics', price:19.99, cost:5.00,  stock:80,  unit:'item',   taxRate:0.15, barcode:'3000000002', color:'#2563EB' },
  { id:'p014', sku:'ELEC-003', name:'Wireless Buds', category:'electronics', price:49.99, cost:18.00, stock:15,  unit:'item',   taxRate:0.15, barcode:'3000000003', color:'#2563EB' },
  { id:'p015', sku:'ELEC-004', name:'Screen Guard',  category:'electronics', price:9.99,  cost:2.50,  stock:150, unit:'item',   taxRate:0.15, barcode:'3000000004', color:'#2563EB' },
  // Clothing
  { id:'p016', sku:'CLO-001', name:'Logo T-Shirt',   category:'clothing',    price:24.99, cost:8.00,  stock:60,  unit:'item',   taxRate:0,    barcode:'4000000001', color:'#7C3AED' },
  { id:'p017', sku:'CLO-002', name:'Zip Hoodie',     category:'clothing',    price:54.99, cost:22.00, stock:30,  unit:'item',   taxRate:0,    barcode:'4000000002', color:'#7C3AED' },
  { id:'p018', sku:'CLO-003', name:'Baseball Cap',   category:'clothing',    price:19.99, cost:7.00,  stock:45,  unit:'item',   taxRate:0,    barcode:'4000000003', color:'#7C3AED' },
  { id:'p019', sku:'CLO-004', name:'Crew Socks 3pk', category:'clothing',    price:12.99, cost:4.00,  stock:90,  unit:'pack',   taxRate:0,    barcode:'4000000004', color:'#7C3AED' },
  // Health
  { id:'p020', sku:'HLT-001', name:'Vitamin C 1000', category:'health',      price:12.99, cost:4.50,  stock:100, unit:'bottle', taxRate:0,    barcode:'5000000001', color:'#DC2626' },
  { id:'p021', sku:'HLT-002', name:'Hand Sanitizer', category:'health',      price:5.99,  cost:1.50,  stock:200, unit:'bottle', taxRate:0,    barcode:'5000000002', color:'#DC2626' },
  { id:'p022', sku:'HLT-003', name:'Aspirin 500mg',  category:'health',      price:8.99,  cost:3.00,  stock:120, unit:'box',    taxRate:0,    barcode:'5000000003', color:'#DC2626' },
  { id:'p023', sku:'HLT-004', name:'Face Mask 10pk', category:'health',      price:9.99,  cost:3.50,  stock:5,   unit:'pack',   taxRate:0,    barcode:'5000000004', color:'#DC2626' },
  { id:'p024', sku:'HLT-005', name:'Multivitamin',   category:'health',      price:16.99, cost:6.00,  stock:0,   unit:'bottle', taxRate:0,    barcode:'5000000005', color:'#DC2626' },
];

const CATEGORIES_DATA = [
  { id:'all',         name:'All Items',   color:'#71717A' },
  { id:'beverages',   name:'Beverages',   color:'#D97706' },
  { id:'food',        name:'Food',        color:'#16A34A' },
  { id:'electronics', name:'Electronics', color:'#2563EB' },
  { id:'clothing',    name:'Clothing',    color:'#7C3AED' },
  { id:'health',      name:'Health',      color:'#DC2626' },
];

const USERS_DATA = [
  { id:'u001', name:'Alex Morgan',  role:'CASHIER',         email:'alex@nexuspos.io',   pin:'1234', initials:'AM' },
  { id:'u002', name:'Sam Chen',     role:'MANAGER',         email:'sam@nexuspos.io',    pin:'5678', initials:'SC' },
  { id:'u003', name:'Jordan Lee',   role:'INVENTORY_STAFF', email:'jordan@nexuspos.io', pin:'9012', initials:'JL' },
  { id:'u004', name:'Maria Santos', role:'BUSINESS_OWNER',  email:'maria@nexuspos.io',  pin:'3456', initials:'MS' },
];

const ROLE_LABELS = {
  SUPER_ADMIN:     'Super Admin',
  RESELLER:        'Reseller',
  BUSINESS_OWNER:  'Owner',
  MANAGER:         'Manager',
  INVENTORY_STAFF: 'Inventory',
  CASHIER:         'Cashier',
};

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN:     { bg: '#4C0519', text: '#FB7185', border: '#9F1239' },
  RESELLER:        { bg: '#431407', text: '#FB923C', border: '#9A3412' },
  BUSINESS_OWNER:  { bg: '#451A03', text: '#FBBF24', border: '#92400E' },
  MANAGER:         { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
  INVENTORY_STAFF: { bg: '#14532D', text: '#4ADE80', border: '#15803D' },
  CASHIER:         { bg: '#2E1065', text: '#A78BFA', border: '#6D28D9' },
};

const CAN_ACCESS = {
  pos:       ['CASHIER','MANAGER','BUSINESS_OWNER','SUPER_ADMIN'],
  products:  ['MANAGER','BUSINESS_OWNER','SUPER_ADMIN','INVENTORY_STAFF'],
  inventory: ['MANAGER','BUSINESS_OWNER','SUPER_ADMIN','INVENTORY_STAFF'],
  sales:     ['CASHIER','MANAGER','BUSINESS_OWNER','SUPER_ADMIN'],
  sync:      ['MANAGER','BUSINESS_OWNER','SUPER_ADMIN'],
};

function canAccess(role, section) {
  return (CAN_ACCESS[section] || []).includes(role);
}

function generateMockSales() {
  const methods = ['cash','card','split'];
  const statuses = ['completed','completed','completed','completed','completed','refunded','voided'];
  return Array.from({ length: 38 }, (_, i) => {
    const date = new Date(Date.now() - i * 3600000 * (1 + Math.random() * 5));
    const prods = PRODUCTS_DATA.filter(() => Math.random() > 0.72).slice(0, 5);
    const items = (prods.length ? prods : [PRODUCTS_DATA[i % PRODUCTS_DATA.length]])
      .map(p => ({ ...p, qty: Math.ceil(Math.random() * 3) }));
    const subtotal = Math.round(items.reduce((s,it) => s + it.price * it.qty, 0) * 100) / 100;
    const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const tax = Math.round((subtotal - discount) * 0.1 * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    return {
      id: `ORD-${String(10000 + i).padStart(5,'0')}`,
      date, cashier: USERS_DATA[i % 2], items, subtotal, discount, tax, total,
      paymentMethod: methods[i % 3],
      status: statuses[i % statuses.length],
    };
  });
}

const TAX_RATE = 0.10;
const CURRENCY_SYMBOL = '$';
const STORE_NAME = 'NexusPOS — Main Branch';

Object.assign(window, {
  PRODUCTS_DATA, CATEGORIES_DATA, USERS_DATA,
  ROLE_LABELS, ROLE_BADGE_STYLES, CAN_ACCESS,
  canAccess, generateMockSales,
  TAX_RATE, CURRENCY_SYMBOL, STORE_NAME,
});
