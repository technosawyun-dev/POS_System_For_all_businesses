class ApiEndpoints {
  // Auth
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/change-password';

  // Users
  static const String users = '/users';
  static String user(String id) => '/users/$id';

  // Devices
  static const String devices = '/devices';
  static String device(String id) => '/devices/$id';
  static String deviceHeartbeat(String id) => '/devices/$id/heartbeat';

  // Products
  static const String products = '/products';
  static String product(String id) => '/products/$id';
  static String productVariants(String id) => '/products/$id/variants';

  // Categories
  static const String categories = '/categories';

  // Brands
  static const String brands = '/brands';

  // Inventory
  static const String stockLevels = '/inventory/stock-levels';
  static const String stockMovements = '/inventory/movements';
  static const String inventoryAdjustments = '/inventory/adjustments';

  // Customers
  static const String customers = '/customers';
  static String customer(String id) => '/customers/$id';
  static const String customerSearch = '/customers/search';
  static String customerLedger(String id) => '/customers/$id/ledger';
  static String customerPayments(String id) => '/customers/$id/payments';

  // Cashier Sessions
  static const String cashierSessions = '/cashier-sessions';
  static String cashierSession(String id) => '/cashier-sessions/$id';
  static String closeSession(String id) => '/cashier-sessions/$id/close';

  // Sales / Cart
  static const String carts = '/sales/carts';
  static String cart(String id) => '/sales/carts/$id';
  static String cartItems(String id) => '/sales/carts/$id/items';
  static String cartItem(String cartId, String itemId) =>
      '/sales/carts/$cartId/items/$itemId';
  static const String checkout = '/sales/checkout';

  // Orders
  static const String orders = '/sales/orders';
  static String order(String id) => '/sales/orders/$id';
  static String voidOrder(String id) => '/sales/orders/$id/void';

  // Payments / Refunds
  static const String payments = '/payments';
  static String refund(String orderId) => '/payments/$orderId/refund';
  static const String refunds = '/payments/refunds';

  // Receipts
  static const String receipts = '/receipts';
  static String receiptByOrder(String orderId) => '/receipts/order/$orderId';

  // Sync
  static const String syncPush = '/sync/push';
  static const String syncPull = '/sync/pull';

  // Analytics
  static const String analyticsDashboard = '/analytics/dashboard';
  static const String analyticsSalesSummary = '/analytics/sales/summary';
  static const String analyticsTopProducts = '/analytics/sales/top-products';

  // Notifications
  static const String notifications = '/notifications';
  static const String notificationUnreadCount = '/notifications/unread-count';
  static String markNotificationRead(String id) => '/notifications/$id/read';
  static const String markAllRead = '/notifications/read-all';

  // Subscriptions
  static const String subscriptionStatus = '/subscriptions/status';

  // Tenants
  static const String tenants = '/tenants';
  static String tenantSettings(String id) => '/tenants/$id/settings';

  // Procurement
  static const String purchaseOrders = '/procurement/purchase-orders';
  static const String goodsReceipts = '/procurement/receipts';
  static const String payables = '/procurement/payables';

  // Suppliers
  static const String suppliers = '/suppliers';

  // Branches
  static String branches(String tenantId) => '/tenants/$tenantId/branches';

  // Resellers (admin view)
  static const String resellers = '/resellers';
  static String reseller(String id) => '/resellers/$id';

  // Reseller portal (own data)
  static const String resellerDashboard = '/reseller/dashboard';
  static const String resellerWallet = '/reseller/wallet';
  static const String resellerCommissions = '/reseller/commissions';
  static const String resellerReferrals = '/reseller/referrals';
  static const String resellerPayouts = '/reseller/payouts';
  static const String resellerRequestPayout = '/reseller/request-payout';

  // Subscription plans
  static const String subscriptionPlans = '/subscriptions/plans';
  static const String adminSubscriptions = '/admin/subscriptions';

  // Audit logs
  static const String auditLogs = '/audit';

  // Stock levels (parameterized)
  static String stockLevelsByBranch(String branchId) =>
      '/inventory/stock-levels?branch_id=$branchId';
}
