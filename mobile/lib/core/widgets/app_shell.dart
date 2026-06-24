import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../../features/notifications/providers/notifications_provider.dart';

class AppShell extends ConsumerWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final unreadCount = ref.watch(unreadCountProvider);
    final location = GoRouterState.of(context).matchedLocation;

    if (user == null) return child;

    final items = _navItems(user.role);
    final selectedIdx = _selectedIndex(location, items);
    final isTablet = MediaQuery.of(context).size.width >= 600;
    final isWideTablet = MediaQuery.of(context).size.width >= 840;

    if (isTablet) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              extended: isWideTablet,
              selectedIndex: selectedIdx < 0 ? 0 : selectedIdx,
              onDestinationSelected: (i) => context.go(items[i].path),
              destinations: items.map((item) {
                final isNotif = item.path == '/notifications';
                final badgeIcon = Icon(item.icon);
                final badgeSelectedIcon = Icon(item.selectedIcon);
                return NavigationRailDestination(
                  icon: isNotif && unreadCount > 0
                      ? Badge(
                          label: Text('$unreadCount',
                              style: const TextStyle(fontSize: 10)),
                          child: badgeIcon)
                      : badgeIcon,
                  selectedIcon: isNotif && unreadCount > 0
                      ? Badge(
                          label: Text('$unreadCount',
                              style: const TextStyle(fontSize: 10)),
                          child: badgeSelectedIcon)
                      : badgeSelectedIcon,
                  label: Text(item.label),
                );
              }).toList(),
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(child: child),
          ],
        ),
      );
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIdx < 0 ? 0 : selectedIdx,
        onDestinationSelected: (i) => context.go(items[i].path),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        destinations: items.map((item) {
          final isNotif = item.path == '/notifications';
          return NavigationDestination(
            icon: isNotif && unreadCount > 0
                ? Badge(
                    label: Text('$unreadCount',
                        style: const TextStyle(fontSize: 10)),
                    child: Icon(item.icon))
                : Icon(item.icon),
            selectedIcon: Icon(item.selectedIcon),
            label: item.label,
          );
        }).toList(),
      ),
    );
  }

  static int _selectedIndex(String location, List<_NavItem> items) {
    for (int i = 0; i < items.length; i++) {
      if (location == items[i].path) return i;
    }
    for (int i = 0; i < items.length; i++) {
      if (items[i].path != '/' && location.startsWith(items[i].path)) return i;
    }
    return 0;
  }

  static List<_NavItem> _navItems(String role) {
    switch (role) {
      case UserRole.superAdmin:
        return const [
          _NavItem(label: 'Businesses', icon: Icons.business_outlined, selectedIcon: Icons.business, path: '/admin/tenants'),
          _NavItem(label: 'Users', icon: Icons.people_outline, selectedIcon: Icons.people, path: '/admin/users'),
          _NavItem(label: 'Devices', icon: Icons.devices_outlined, selectedIcon: Icons.devices, path: '/admin/devices'),
          _NavItem(label: 'Audit', icon: Icons.history_outlined, selectedIcon: Icons.history, path: '/admin/audit'),
          _NavItem(label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, path: '/settings'),
        ];
      case UserRole.reseller:
        return const [
          _NavItem(label: 'Overview', icon: Icons.dashboard_outlined, selectedIcon: Icons.dashboard, path: '/reseller/dashboard'),
          _NavItem(label: 'Clients', icon: Icons.business_outlined, selectedIcon: Icons.business, path: '/reseller/referrals'),
          _NavItem(label: 'Commissions', icon: Icons.payments_outlined, selectedIcon: Icons.payments, path: '/reseller/commissions'),
          _NavItem(label: 'Wallet', icon: Icons.account_balance_wallet_outlined, selectedIcon: Icons.account_balance_wallet, path: '/reseller/wallet'),
          _NavItem(label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, path: '/settings'),
        ];
      case UserRole.inventoryStaff:
        return const [
          _NavItem(label: 'Inventory', icon: Icons.warehouse_outlined, selectedIcon: Icons.warehouse, path: '/inventory'),
          _NavItem(label: 'Products', icon: Icons.inventory_2_outlined, selectedIcon: Icons.inventory_2, path: '/products'),
          _NavItem(label: 'Notifications', icon: Icons.notifications_outlined, selectedIcon: Icons.notifications, path: '/notifications'),
          _NavItem(label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, path: '/settings'),
        ];
      case UserRole.cashier:
        return const [
          _NavItem(label: 'Dashboard', icon: Icons.dashboard_outlined, selectedIcon: Icons.dashboard, path: '/dashboard/cashier'),
          _NavItem(label: 'Orders', icon: Icons.receipt_long_outlined, selectedIcon: Icons.receipt_long, path: '/orders'),
          _NavItem(label: 'Customers', icon: Icons.people_outline, selectedIcon: Icons.people, path: '/customers'),
          _NavItem(label: 'Notifications', icon: Icons.notifications_outlined, selectedIcon: Icons.notifications, path: '/notifications'),
          _NavItem(label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, path: '/settings'),
        ];
      case UserRole.businessOwner:
      case UserRole.manager:
      default:
        return const [
          _NavItem(label: 'Dashboard', icon: Icons.dashboard_outlined, selectedIcon: Icons.dashboard, path: '/dashboard/manager'),
          _NavItem(label: 'Orders', icon: Icons.receipt_long_outlined, selectedIcon: Icons.receipt_long, path: '/orders'),
          _NavItem(label: 'Products', icon: Icons.inventory_2_outlined, selectedIcon: Icons.inventory_2, path: '/products'),
          _NavItem(label: 'Inventory', icon: Icons.warehouse_outlined, selectedIcon: Icons.warehouse, path: '/inventory'),
          _NavItem(label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, path: '/settings'),
        ];
    }
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String path;
  const _NavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.path,
  });
}
