import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/cashier_session/screens/open_session_screen.dart';
import '../../features/cashier_session/providers/session_provider.dart';
import '../../features/pos/screens/pos_screen.dart';
import '../../features/dashboard/screens/cashier_dashboard.dart';
import '../../features/dashboard/screens/manager_dashboard.dart';
import '../../features/dashboard/screens/super_admin_dashboard.dart';
import '../../features/dashboard/screens/reseller_dashboard.dart';
import '../../features/orders/screens/orders_screen.dart';
import '../../features/orders/screens/receipt_screen.dart';
import '../../features/customers/screens/customers_screen.dart';
import '../../features/products/screens/products_screen.dart';
import '../../features/inventory/screens/inventory_screen.dart';
import '../../features/analytics/screens/analytics_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/users/screens/users_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/procurement/screens/procurement_screen.dart';
import '../../features/admin/screens/tenants_screen.dart';
import '../../features/admin/screens/admin_users_screen.dart';
import '../../features/admin/screens/resellers_screen.dart';
import '../../features/admin/screens/plans_screen.dart';
import '../../features/admin/screens/subscriptions_screen.dart';
import '../../features/admin/screens/devices_screen.dart';
import '../../features/admin/screens/audit_screen.dart';
import '../../features/reseller/screens/reseller_dashboard_screen.dart';
import '../../features/reseller/screens/wallet_screen.dart';
import '../../features/reseller/screens/referrals_screen.dart';
import '../../features/reseller/screens/commissions_screen.dart';
import '../providers/auth_provider.dart';
import '../widgets/app_shell.dart';
import '../../models/user_model.dart';

final _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'shell');

final routerProvider = Provider<GoRouter>((ref) {
  final authListenable = _AuthListenable(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    refreshListenable: authListenable,
    initialLocation: '/login',
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final sessionState = ref.read(sessionProvider);
      final isLoggedIn = authState.isAuthenticated;
      final loc = state.matchedLocation;

      if (!isLoggedIn) {
        return loc == '/login' ? null : '/login';
      }
      if (loc == '/login') {
        return _homeRoute(authState.user!.role);
      }

      final isCashierHomeRoute =
          loc == '/pos' || loc == '/dashboard/cashier';
      if (authState.user!.isCashier && isCashierHomeRoute) {
        if (!sessionState.hasOpenSession) return '/session/open';
      }

      return null;
    },
    routes: [
      // Full-screen routes (no navigation shell)
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/pos',
        builder: (_, __) => const PosScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/session/open',
        builder: (_, __) => const OpenSessionScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/session/close',
        builder: (_, __) => const CloseSessionScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/receipt/:orderId',
        builder: (_, state) =>
            ReceiptScreen(orderId: state.pathParameters['orderId']!),
      ),

      // Shell routes (with navigation bar)
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) =>
            AppShell(child: child),
        routes: [
          // Dashboards
          GoRoute(
            path: '/dashboard/cashier',
            builder: (_, __) => const CashierDashboard(),
          ),
          GoRoute(
            path: '/dashboard/manager',
            builder: (_, __) => const ManagerDashboard(),
          ),
          GoRoute(
            path: '/dashboard/admin',
            builder: (_, __) => const SuperAdminDashboard(),
          ),
          GoRoute(
            path: '/dashboard/reseller',
            builder: (_, __) => const ResellerDashboard(),
          ),
          // Feature routes
          GoRoute(
            path: '/orders',
            builder: (_, __) => const OrdersScreen(),
          ),
          GoRoute(
            path: '/customers',
            builder: (_, __) => const CustomersScreen(),
          ),
          GoRoute(
            path: '/products',
            builder: (_, __) => const ProductsScreen(),
          ),
          GoRoute(
            path: '/inventory',
            builder: (_, __) => const InventoryScreen(),
          ),
          GoRoute(
            path: '/analytics',
            builder: (_, __) => const AnalyticsScreen(),
          ),
          GoRoute(
            path: '/procurement',
            builder: (_, __) => const ProcurementScreen(),
          ),
          GoRoute(
            path: '/users',
            builder: (_, __) => const UsersScreen(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (_, __) => const SettingsScreen(),
          ),
          // Admin portal
          GoRoute(
            path: '/admin/tenants',
            builder: (_, __) => const TenantsScreen(),
          ),
          GoRoute(
            path: '/admin/users',
            builder: (_, __) => const AdminUsersScreen(),
          ),
          GoRoute(
            path: '/admin/resellers',
            builder: (_, __) => const AdminResellersScreen(),
          ),
          GoRoute(
            path: '/admin/plans',
            builder: (_, __) => const PlansScreen(),
          ),
          GoRoute(
            path: '/admin/subscriptions',
            builder: (_, __) => const AdminSubscriptionsScreen(),
          ),
          GoRoute(
            path: '/admin/devices',
            builder: (_, __) => const DevicesScreen(),
          ),
          GoRoute(
            path: '/admin/audit',
            builder: (_, __) => const AuditScreen(),
          ),
          // Reseller portal
          GoRoute(
            path: '/reseller/dashboard',
            builder: (_, __) => const ResellerDashboardScreen(),
          ),
          GoRoute(
            path: '/reseller/wallet',
            builder: (_, __) => const WalletScreen(),
          ),
          GoRoute(
            path: '/reseller/referrals',
            builder: (_, __) => const ReferralsScreen(),
          ),
          GoRoute(
            path: '/reseller/commissions',
            builder: (_, __) => const CommissionsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.error}')),
    ),
  );
});

String _homeRoute(String role) {
  switch (role) {
    case UserRole.superAdmin:
      return '/dashboard/admin';
    case UserRole.reseller:
      return '/reseller/dashboard';
    case UserRole.businessOwner:
    case UserRole.manager:
      return '/dashboard/manager';
    case UserRole.cashier:
      return '/dashboard/cashier';
    case UserRole.inventoryStaff:
      return '/inventory';
    default:
      return '/dashboard/manager';
  }
}

class _AuthListenable extends ChangeNotifier {
  final Ref _ref;
  _AuthListenable(this._ref) {
    _ref.listen(authProvider, (_, __) => notifyListeners());
    _ref.listen(sessionProvider, (_, __) => notifyListeners());
  }
}

// Inline close-session screen
class CloseSessionScreen extends ConsumerStatefulWidget {
  const CloseSessionScreen({super.key});

  @override
  ConsumerState<CloseSessionScreen> createState() =>
      _CloseSessionScreenState();
}

class _CloseSessionScreenState
    extends ConsumerState<CloseSessionScreen> {
  final _controller = TextEditingController(text: '0');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Close Session')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Closing Cash Balance',
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            TextField(
              controller: _controller,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(prefixText: 'MMK '),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: sessionState.isLoading
                    ? null
                    : () async {
                        final router = GoRouter.of(context);
                        final ok = await ref
                            .read(sessionProvider.notifier)
                            .closeSession(
                              closingBalance:
                                  double.tryParse(_controller.text) ??
                                      0,
                            );
                        if (!mounted) return;
                        if (ok) router.go('/dashboard/cashier');
                      },
                child: sessionState.isLoading
                    ? const CircularProgressIndicator(
                        color: Colors.white)
                    : const Text('Close Session'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
