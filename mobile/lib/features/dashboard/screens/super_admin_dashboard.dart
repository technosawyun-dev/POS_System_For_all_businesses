import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';

class SuperAdminDashboard extends ConsumerWidget {
  const SuperAdminDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Platform Admin'),
        actions: [
          PopupMenuButton(
            icon: const Icon(Icons.person_outline),
            itemBuilder: (_) => [
              const PopupMenuItem(
                  value: 'logout',
                  child: ListTile(
                      leading: Icon(Icons.logout),
                      title: Text('Sign Out'),
                      dense: true)),
            ],
            onSelected: (v) {
              if (v == 'logout') ref.read(authProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF311B92), Color(0xFF4527A0)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Platform Overview',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                  SizedBox(height: 4),
                  Text('Super Admin',
                      style:
                          TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text('Platform Management',
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
                _NavCard(Icons.business_outlined, 'Businesses',
                    AppColors.primary, () => context.push('/admin/tenants')),
                _NavCard(Icons.people_outlined, 'Users',
                    AppColors.secondary, () => context.push('/admin/users')),
                _NavCard(Icons.handshake_outlined, 'Resellers',
                    AppColors.info, () => context.push('/admin/resellers')),
                _NavCard(Icons.subscriptions_outlined, 'Plans',
                    AppColors.warning, () => context.push('/admin/plans')),
                _NavCard(Icons.receipt_outlined, 'Subscriptions',
                    AppColors.success, () => context.push('/admin/subscriptions')),
                _NavCard(Icons.bar_chart_rounded, 'Analytics',
                    AppColors.mobilePayColor, () => context.push('/analytics')),
                _NavCard(Icons.devices_outlined, 'Devices',
                    AppColors.cardColor, () => context.push('/admin/devices')),
                _NavCard(Icons.history_outlined, 'Audit Logs',
                    AppColors.textSecondary, () => context.push('/admin/audit')),
                _NavCard(Icons.notifications_outlined, 'Notifications',
                    AppColors.textSecondary, () => context.push('/notifications')),
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
