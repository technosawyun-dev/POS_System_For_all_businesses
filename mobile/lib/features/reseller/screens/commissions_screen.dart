import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/reseller_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/reseller_wallet_model.dart';

class CommissionsScreen extends ConsumerStatefulWidget {
  const CommissionsScreen({super.key});

  @override
  ConsumerState<CommissionsScreen> createState() => _CommissionsScreenState();
}

class _CommissionsScreenState extends ConsumerState<CommissionsScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        ref.read(resellerCommissionsProvider.notifier).load());
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        ref.read(resellerCommissionsProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resellerCommissionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Commissions')),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(resellerCommissionsProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () => ref
                        .read(resellerCommissionsProvider.notifier)
                        .load(refresh: true),
                  )
                : state.items.isEmpty
                    ? const EmptyView(
                        icon: Icons.money_outlined,
                        title: 'No commissions yet',
                        subtitle: 'Earn commissions when your clients subscribe',
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.only(bottom: 16),
                        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                        itemBuilder: (_, i) {
                          if (i >= state.items.length) {
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                          return _CommissionTile(commission: state.items[i]);
                        },
                      ),
      ),
    );
  }
}

class _CommissionTile extends StatelessWidget {
  final CommissionModel commission;
  const _CommissionTile({required this.commission});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.successLight,
          child: Text(
            commission.tenantName.isNotEmpty
                ? commission.tenantName[0].toUpperCase()
                : '?',
            style: const TextStyle(
                color: AppColors.success, fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(commission.tenantName,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(
          '${commission.earnedAt.day}/${commission.earnedAt.month}/${commission.earnedAt.year}',
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              CurrencyFormatter.format(commission.amount),
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppColors.success),
            ),
            const SizedBox(height: 4),
            StatusBadge(status: commission.status),
          ],
        ),
      ),
    );
  }
}
