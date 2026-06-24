import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../cashier_session/providers/session_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../models/cashier_session_model.dart';

class CashierDashboard extends ConsumerWidget {
  const CashierDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final sessionState = ref.watch(sessionProvider);
    final session = sessionState.session;

    final screenWidth = MediaQuery.of(context).size.width;
    final isTablet = screenWidth >= 700;

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${user?.firstName ?? 'Cashier'}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
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
            // Session status card
            _SessionCard(session: session),
            const SizedBox(height: 20),

            // Quick actions
            const Text('Quick Actions',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            LayoutBuilder(builder: (_, c) => GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: Responsive.gridCols(c.maxWidth, phone: 2, tablet: 3, wide: 4),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.4,
              children: [
                _ActionCard(
                  icon: Icons.point_of_sale_rounded,
                  label: 'New Sale',
                  color: AppColors.primary,
                  onTap: isTablet && session?.isOpen == true
                      ? () => context.go('/pos')
                      : null,
                ),
                _ActionCard(
                  icon: Icons.receipt_long_outlined,
                  label: 'Order History',
                  color: AppColors.secondary,
                  onTap: () => context.push('/orders'),
                ),
                _ActionCard(
                  icon: Icons.people_outlined,
                  label: 'Customers',
                  color: AppColors.info,
                  onTap: () => context.push('/customers'),
                ),
                _ActionCard(
                  icon: session?.isOpen == true
                      ? Icons.lock_outlined
                      : Icons.lock_open_outlined,
                  label: session?.isOpen == true
                      ? 'Close Session'
                      : 'Open Session',
                  color: session?.isOpen == true
                      ? AppColors.warning
                      : AppColors.success,
                  onTap: () => session?.isOpen == true
                      ? context.push('/session/close')
                      : context.push('/session/open'),
                ),
              ],
            )),

            if (session?.isOpen == true) ...[
              const SizedBox(height: 20),
              const Text('Today\'s Session',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              _SessionStats(session: session!),
            ],
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final CashierSessionModel? session;

  const _SessionCard({this.session});

  @override
  Widget build(BuildContext context) {
    final isOpen = session?.isOpen == true;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isOpen ? AppColors.successLight : AppColors.warningLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isOpen ? AppColors.success : AppColors.warning,
        ),
      ),
      child: Row(
        children: [
          Icon(
            isOpen ? Icons.radio_button_checked : Icons.radio_button_unchecked,
            color: isOpen ? AppColors.success : AppColors.warning,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isOpen ? 'Session Open' : 'No Active Session',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: isOpen ? AppColors.success : AppColors.warning,
                  ),
                ),
                if (session != null)
                  Text(
                    'Opening balance: ${CurrencyFormatter.format(session!.openingBalance)}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionStats extends StatelessWidget {
  final CashierSessionModel session;

  const _SessionStats({required this.session});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: [
          _StatRow(
            label: 'Opening Balance',
            value: CurrencyFormatter.format(session.openingBalance),
          ),
          const Divider(height: 16),
          _StatRow(
            label: 'Session Started',
            value: _formatTime(session.openedAt),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;

  const _StatRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary)),
        Text(value,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1.0,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
