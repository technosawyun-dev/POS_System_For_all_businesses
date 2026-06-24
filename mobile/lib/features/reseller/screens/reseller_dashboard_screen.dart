import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/reseller_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/error_view.dart';

class ResellerDashboardScreen extends ConsumerStatefulWidget {
  const ResellerDashboardScreen({super.key});

  @override
  ConsumerState<ResellerDashboardScreen> createState() =>
      _ResellerDashboardScreenState();
}

class _ResellerDashboardScreenState extends ConsumerState<ResellerDashboardScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(resellerDashboardProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resellerDashboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reseller Portal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(resellerDashboardProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () =>
                        ref.read(resellerDashboardProvider.notifier).load(refresh: true),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Stats grid
                      if (state.stats != null) ...[
                        LayoutBuilder(builder: (_, c) => GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: Responsive.gridCols(c.maxWidth, phone: 2, tablet: 4, wide: 4),
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.6,
                          children: [
                            _StatCard(
                              title: 'Total Clients',
                              value: (state.stats!['total_clients'] as int? ?? 0)
                                  .toString(),
                              icon: Icons.business_outlined,
                              color: AppColors.primary,
                            ),
                            _StatCard(
                              title: 'Active Clients',
                              value: (state.stats!['active_clients'] as int? ?? 0)
                                  .toString(),
                              icon: Icons.check_circle_outline,
                              color: AppColors.success,
                            ),
                            _StatCard(
                              title: 'Total Commissions',
                              value: CurrencyFormatter.format(
                                  (state.stats!['total_commissions'] as num?)
                                          ?.toDouble() ??
                                      0),
                              icon: Icons.monetization_on_outlined,
                              color: AppColors.secondary,
                            ),
                            _StatCard(
                              title: 'Wallet Balance',
                              value: CurrencyFormatter.format(
                                  (state.stats!['wallet_balance'] as num?)
                                          ?.toDouble() ??
                                      0),
                              icon: Icons.account_balance_wallet_outlined,
                              color: AppColors.warning,
                            ),
                          ],
                        )),
                        const SizedBox(height: 24),
                      ],

                      // Quick actions
                      const Text('Quick Actions',
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _ActionCard(
                              icon: Icons.account_balance_wallet_outlined,
                              label: 'Wallet',
                              color: AppColors.primary,
                              onTap: () => context.push('/reseller/wallet'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ActionCard(
                              icon: Icons.business_outlined,
                              label: 'My Clients',
                              color: AppColors.secondary,
                              onTap: () => context.push('/reseller/referrals'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ActionCard(
                              icon: Icons.money_outlined,
                              label: 'Commissions',
                              color: AppColors.success,
                              onTap: () => context.push('/reseller/commissions'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            const Spacer(),
            Text(value,
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w800, color: color)),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}
