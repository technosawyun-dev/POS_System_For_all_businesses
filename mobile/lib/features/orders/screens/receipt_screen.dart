import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/orders_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/info_row.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/hardware/printer_service.dart';
import '../../../models/order_model.dart';

final _orderDetailProvider =
    FutureProvider.family<OrderModel, String>((ref, id) async {
  final repo = ref.watch(ordersRepositoryProvider);
  return repo.getOrder(id);
});

class ReceiptScreen extends ConsumerWidget {
  final String orderId;
  const ReceiptScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(_orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receipt'),
        actions: [
          orderAsync.whenOrNull(
            data: (order) => IconButton(
              icon: const Icon(Icons.print_outlined),
              tooltip: 'Print Receipt',
              onPressed: () => _printReceipt(context, order),
            ),
          ) ?? const SizedBox(),
        ],
      ),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(_orderDetailProvider(orderId)),
        ),
        data: (order) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _ReceiptHeader(order: order),
              const SizedBox(height: 16),
              _ItemsCard(order: order),
              const SizedBox(height: 8),
              _TotalsCard(order: order),
              const SizedBox(height: 8),
              _PaymentsCard(order: order),
              const SizedBox(height: 24),
              _PrintButton(order: order),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _printReceipt(BuildContext context, OrderModel order) async {
    final ok = await printerService.printReceipt(order, openDrawer: false);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:
            Text(ok ? 'Sent to printer' : 'No printer connected. Connect in settings.'),
        backgroundColor: ok ? AppColors.success : AppColors.error,
      ),
    );
  }
}

class _ReceiptHeader extends StatelessWidget {
  final OrderModel order;
  const _ReceiptHeader({required this.order});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Icon(Icons.receipt_long, size: 48, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(
              order.orderNumber,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                StatusBadge(status: order.orderStatus),
                const SizedBox(width: 8),
                StatusBadge(status: order.paymentStatus),
              ],
            ),
            const Divider(height: 24),
            InfoRow(
              label: 'Date',
              value: _fmt(order.createdAt),
            ),
            if (order.customerName != null)
              InfoRow(label: 'Customer', value: order.customerName!),
            if (order.cashierSessionId != null)
              InfoRow(label: 'Session', value: order.cashierSessionId!.substring(0, 8)),
          ],
        ),
      ),
    );
  }

  String _fmt(DateTime dt) =>
      '${dt.day}/${dt.month}/${dt.year}  ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
}

class _ItemsCard extends StatelessWidget {
  final OrderModel order;
  const _ItemsCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Items',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5)),
            const SizedBox(height: 12),
            ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.displayName,
                                style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w500)),
                            Text(
                              '${item.quantityOrdered} × ${CurrencyFormatter.format(item.unitPrice)}',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(item.lineTotal),
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  final OrderModel order;
  const _TotalsCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            InfoRow(
                label: 'Subtotal',
                value: CurrencyFormatter.format(order.grossTotal)),
            if (order.taxTotal > 0)
              InfoRow(
                  label: 'Tax',
                  value: CurrencyFormatter.format(order.taxTotal),
                  valueColor: AppColors.textPrimary),
            if (order.discountTotal > 0)
              InfoRow(
                  label: 'Discount',
                  value: '- ${CurrencyFormatter.format(order.discountTotal)}',
                  valueColor: AppColors.success),
            const Divider(),
            Row(
              children: [
                const Expanded(
                    child: Text('Total',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15))),
                Text(
                  CurrencyFormatter.format(order.netTotal),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
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

class _PaymentsCard extends StatelessWidget {
  final OrderModel order;
  const _PaymentsCard({required this.order});

  @override
  Widget build(BuildContext context) {
    if (order.payments.isEmpty) return const SizedBox();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Payments',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5)),
            const SizedBox(height: 12),
            ...order.payments.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(PaymentMethod.displayName(p.paymentMethod),
                                style: const TextStyle(fontSize: 13)),
                            if (p.referenceNumber != null)
                              Text('Ref: ${p.referenceNumber}',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(p.amount),
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}

class _PrintButton extends StatelessWidget {
  final OrderModel order;
  const _PrintButton({required this.order});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        onPressed: () async {
          final ok =
              await printerService.printReceipt(order, openDrawer: false);
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(ok
                ? 'Sent to printer'
                : 'No printer connected. Go to Settings → Printers.'),
            backgroundColor: ok ? AppColors.success : AppColors.warning,
          ));
        },
        icon: const Icon(Icons.print_outlined),
        label: const Text('Print Receipt'),
      ),
    );
  }
}
