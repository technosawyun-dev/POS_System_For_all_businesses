import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/admin_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../models/subscription_model.dart';

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(plansProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(plansProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Billing Plans')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(plansProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () =>
                        ref.read(plansProvider.notifier).load(refresh: true),
                  )
                : state.items.isEmpty
                    ? const EmptyView(
                        icon: Icons.subscriptions_outlined,
                        title: 'No billing plans configured',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: state.items.length,
                        itemBuilder: (_, i) => _PlanCard(plan: state.items[i]),
                      ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final SubscriptionPlanModel plan;
  const _PlanCard({required this.plan});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(plan.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: plan.isActive ? AppColors.successLight : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    plan.isActive ? 'Active' : 'Inactive',
                    style: TextStyle(
                      fontSize: 12,
                      color: plan.isActive ? AppColors.success : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            if (plan.description != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(plan.description!,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
              ),
            const Divider(height: 20),
            Row(
              children: [
                _PlanLimit(
                    icon: Icons.people_outline,
                    label: 'Users',
                    value: plan.maxUsers == 0 ? '∞' : plan.maxUsers.toString()),
                _PlanLimit(
                    icon: Icons.store_outlined,
                    label: 'Branches',
                    value: plan.maxBranches == 0
                        ? '∞'
                        : plan.maxBranches.toString()),
                _PlanLimit(
                    icon: Icons.inventory_2_outlined,
                    label: 'Products',
                    value: plan.maxProducts == 0
                        ? '∞'
                        : plan.maxProducts.toString()),
                const Spacer(),
                Text(
                  '${CurrencyFormatter.format(plan.monthlyPrice)}/mo',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.primary,
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

class _PlanLimit extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _PlanLimit(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Column(
        children: [
          Icon(icon, size: 16, color: AppColors.textSecondary),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          Text(label,
              style: const TextStyle(
                  fontSize: 10, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}
