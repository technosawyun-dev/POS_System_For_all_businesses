import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';
import '../../../models/user_model.dart';

class ManagerDashboard extends ConsumerWidget {
  const ManagerDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: Text(user?.role == UserRole.businessOwner
            ? 'Owner Dashboard'
            : 'Manager Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          PopupMenuButton(
            icon: const Icon(Icons.person_outline),
            itemBuilder: (_) => [
              const PopupMenuItem(
                  value: 'settings',
                  child: ListTile(
                      leading: Icon(Icons.settings_outlined),
                      title: Text('Settings'),
                      dense: true)),
              const PopupMenuItem(
                  value: 'logout',
                  child: ListTile(
                      leading: Icon(Icons.logout),
                      title: Text('Sign Out'),
                      dense: true)),
            ],
            onSelected: (v) {
              if (v == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome, ${user?.firstName ?? ''}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    UserRole.displayName(user?.role ?? ''),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text('Management',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),

            LayoutBuilder(builder: (_, c) => GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: Responsive.gridCols(c.maxWidth, phone: 3, tablet: 4, wide: 5),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.0,
              children: [
                _NavCard(Icons.point_of_sale_rounded, 'POS',
                    AppColors.primary, () => context.go('/pos')),
                _NavCard(Icons.bar_chart_rounded, 'Analytics',
                    AppColors.secondary, () => context.push('/analytics')),
                _NavCard(Icons.receipt_long_outlined, 'Orders',
                    AppColors.info, () => context.push('/orders')),
                _NavCard(Icons.inventory_2_outlined, 'Inventory',
                    AppColors.warning, () => context.push('/inventory')),
                _NavCard(Icons.people_outlined, 'Customers',
                    AppColors.success, () => context.push('/customers')),
                _NavCard(Icons.category_outlined, 'Products',
                    AppColors.cardColor, () => context.push('/products')),
                _NavCard(Icons.group_outlined, 'Staff',
                    AppColors.mobilePayColor, () => context.push('/users')),
                _NavCard(Icons.local_shipping_outlined, 'Procurement',
                    AppColors.textSecondary, () => context.push('/procurement')),
                _NavCard(Icons.tune_outlined, 'Settings',
                    AppColors.textSecondary, () => context.push('/settings')),
              ],
            )),
          ],
        ),
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _NavCard(this.icon, this.label, this.color, this.onTap);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
