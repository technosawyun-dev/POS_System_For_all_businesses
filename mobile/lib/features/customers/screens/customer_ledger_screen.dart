import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/customers_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';

final _ledgerProvider = FutureProvider.family<
    List<Map<String, dynamic>>, String>((ref, customerId) async {
  return ref.watch(customersRepositoryProvider).getLedger(customerId);
});

class CustomerLedgerScreen extends ConsumerWidget {
  final String customerId;
  final String customerName;

  const CustomerLedgerScreen({
    super.key,
    required this.customerId,
    required this.customerName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ledgerAsync = ref.watch(_ledgerProvider(customerId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Ledger', style: TextStyle(fontSize: 16)),
            Text(customerName,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w400)),
          ],
        ),
      ),
      body: ledgerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(_ledgerProvider(customerId)),
        ),
        data: (entries) => entries.isEmpty
            ? const EmptyView(
                icon: Icons.receipt_long_outlined,
                title: 'No ledger entries',
                subtitle: 'Transactions will appear here',
              )
            : ListView.builder(
                padding: const EdgeInsets.only(bottom: 16),
                itemCount: entries.length,
                itemBuilder: (_, i) => _LedgerEntryTile(entry: entries[i]),
              ),
      ),
    );
  }
}

class _LedgerEntryTile extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _LedgerEntryTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final type = entry['entry_type'] as String? ?? 'TRANSACTION';
    final amount = (entry['amount'] as num?)?.toDouble() ?? 0;
    final balance = (entry['running_balance'] as num?)?.toDouble();
    final description = entry['description'] as String? ??
        entry['reference'] as String? ?? type;
    final rawDate = entry['created_at'] as String? ??
        entry['entry_date'] as String?;
    DateTime? date;
    if (rawDate != null) {
      try {
        date = DateTime.parse(rawDate);
      } catch (_) {}
    }
    final isCredit = type.contains('PAYMENT') ||
        type.contains('CREDIT') ||
        amount > 0;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor:
              isCredit ? AppColors.successLight : AppColors.primaryLight,
          radius: 20,
          child: Icon(
            isCredit ? Icons.arrow_downward : Icons.arrow_upward,
            color: isCredit ? AppColors.success : AppColors.primary,
            size: 16,
          ),
        ),
        title: Text(
          description,
          style: const TextStyle(
              fontWeight: FontWeight.w500, fontSize: 13),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: date != null
            ? Text(
                '${date.day}/${date.month}/${date.year}',
                style: const TextStyle(fontSize: 11),
              )
            : null,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              CurrencyFormatter.format(amount.abs()),
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: isCredit ? AppColors.success : AppColors.primary,
              ),
            ),
            if (balance != null)
              Text(
                'Bal: ${CurrencyFormatter.formatCompact(balance)}',
                style: const TextStyle(
                    fontSize: 10, color: AppColors.textSecondary),
              ),
          ],
        ),
      ),
    );
  }
}
