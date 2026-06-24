import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/reseller_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../models/reseller_wallet_model.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(resellerWalletProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resellerWalletProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(resellerWalletProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () =>
                        ref.read(resellerWalletProvider.notifier).load(refresh: true),
                  )
                : state.wallet == null
                    ? const Center(child: Text('Wallet not found'))
                    : ListView(
                        children: [
                          _WalletHeader(wallet: state.wallet!),
                          _RequestPayoutButton(wallet: state.wallet!),
                          const Padding(
                            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                            child: Text('Transaction History',
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700)),
                          ),
                          if (state.wallet!.transactions.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(32),
                              child: Center(
                                  child: Text(
                                'No transactions yet',
                                style: TextStyle(
                                    color: AppColors.textSecondary),
                              )),
                            )
                          else
                            ...state.wallet!.transactions
                                .map((tx) => _TransactionTile(tx: tx)),
                          const SizedBox(height: 32),
                        ],
                      ),
      ),
    );
  }
}

class _WalletHeader extends StatelessWidget {
  final ResellerWalletModel wallet;
  const _WalletHeader({required this.wallet});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Text('Available Balance',
              style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Text(
            CurrencyFormatter.format(wallet.balance),
            style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w800),
          ),
          const Divider(color: Colors.white24, height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _WalletStat(
                  label: 'Total Earned',
                  value: CurrencyFormatter.formatCompact(wallet.totalEarned)),
              _WalletStat(
                  label: 'Total Paid',
                  value: CurrencyFormatter.formatCompact(wallet.totalPaidOut)),
            ],
          ),
        ],
      ),
    );
  }
}

class _WalletStat extends StatelessWidget {
  final String label;
  final String value;
  const _WalletStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 16)),
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}

class _RequestPayoutButton extends ConsumerWidget {
  final ResellerWalletModel wallet;
  const _RequestPayoutButton({required this.wallet});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (wallet.balance <= 0) return const SizedBox();
    final state = ref.watch(resellerWalletProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ElevatedButton.icon(
        onPressed: state.isLoading
            ? null
            : () => _showPayoutDialog(context, ref, wallet.balance),
        icon: const Icon(Icons.payments_outlined),
        label: const Text('Request Payout'),
      ),
    );
  }

  void _showPayoutDialog(
      BuildContext context, WidgetRef ref, double maxAmount) {
    final controller = TextEditingController(
        text: maxAmount.toStringAsFixed(0));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Payout'),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: 'Amount (max ${CurrencyFormatter.format(maxAmount)})',
            prefixText: 'MMK ',
          ),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(controller.text) ?? 0;
              if (amount <= 0 || amount > maxAmount) return;
              Navigator.pop(ctx);
              final ok = await ref
                  .read(resellerWalletProvider.notifier)
                  .requestPayout(amount);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(
                      ok ? 'Payout requested successfully' : 'Failed to request payout'),
                  backgroundColor: ok ? AppColors.success : AppColors.error,
                ));
              }
            },
            child: const Text('Request'),
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final WalletTransactionModel tx;
  const _TransactionTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor:
            tx.isCredit ? AppColors.successLight : AppColors.errorLight,
        child: Icon(
          tx.isCredit ? Icons.arrow_downward : Icons.arrow_upward,
          color: tx.isCredit ? AppColors.success : AppColors.error,
          size: 18,
        ),
      ),
      title: Text(tx.description ?? tx.transactionType,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
      subtitle: Text(
        '${tx.createdAt.day}/${tx.createdAt.month}/${tx.createdAt.year}',
        style: const TextStyle(fontSize: 11),
      ),
      trailing: Text(
        '${tx.isCredit ? '+' : '-'}${CurrencyFormatter.format(tx.amount)}',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: tx.isCredit ? AppColors.success : AppColors.error,
          fontSize: 14,
        ),
      ),
    );
  }
}
