import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/admin_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/tenant_model.dart';

class AdminResellersScreen extends ConsumerStatefulWidget {
  const AdminResellersScreen({super.key});

  @override
  ConsumerState<AdminResellersScreen> createState() =>
      _AdminResellersScreenState();
}

class _AdminResellersScreenState extends ConsumerState<AdminResellersScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(adminResellersProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(adminResellersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Resellers')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(adminResellersProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () =>
                        ref.read(adminResellersProvider.notifier).load(refresh: true),
                  )
                : state.items.isEmpty
                    ? const EmptyView(
                        icon: Icons.handshake_outlined,
                        title: 'No resellers yet',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: 16),
                        itemCount: state.items.length,
                        itemBuilder: (_, i) =>
                            _ResellerCard(reseller: state.items[i]),
                      ),
      ),
    );
  }
}

class _ResellerCard extends StatelessWidget {
  final ResellerModel reseller;
  const _ResellerCard({required this.reseller});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.secondary.withValues(alpha: 0.1),
              radius: 22,
              child: Text(
                reseller.name.isNotEmpty ? reseller.name[0].toUpperCase() : '?',
                style: const TextStyle(
                    color: AppColors.secondary, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(reseller.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  Text(reseller.email,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  Text('${reseller.clientCount} clients',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textSecondary)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusBadge(status: reseller.status),
                const SizedBox(height: 4),
                Text(
                  CurrencyFormatter.format(reseller.walletBalance),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.primary),
                ),
                Text('${reseller.commissionRate.toStringAsFixed(1)}% rate',
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textSecondary)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
