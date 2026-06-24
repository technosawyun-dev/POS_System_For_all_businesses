import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/procurement_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/info_row.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/purchase_order_model.dart';

final _poDetailProvider =
    FutureProvider.family<PurchaseOrderModel, String>((ref, id) async {
  return ref.watch(procurementRepositoryProvider).getPurchaseOrder(id);
});

class ProcurementDetailScreen extends ConsumerWidget {
  final String orderId;
  const ProcurementDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final poAsync = ref.watch(_poDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Purchase Order')),
      body: poAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(_poDetailProvider(orderId)),
        ),
        data: (po) => ContentWrapper(
          maxWidth: 720,
          child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PoHeader(po: po),
              InfoSection(
                title: 'ORDER INFO',
                children: [
                  InfoRow(label: 'Order #', value: po.orderNumber),
                  if (po.supplierName != null)
                    InfoRow(label: 'Supplier', value: po.supplierName!),
                  InfoRow(
                    label: 'Order Date',
                    value:
                        '${po.orderDate.day}/${po.orderDate.month}/${po.orderDate.year}',
                  ),
                  if (po.expectedDate != null)
                    InfoRow(
                      label: 'Expected',
                      value:
                          '${po.expectedDate!.day}/${po.expectedDate!.month}/${po.expectedDate!.year}',
                    ),
                  InfoRow(
                    label: 'Total',
                    value: CurrencyFormatter.format(po.totalAmount),
                    valueColor: AppColors.primary,
                  ),
                ],
              ),
              if (po.notes != null && po.notes!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('NOTES',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                              letterSpacing: 0.8)),
                      const SizedBox(height: 6),
                      Text(po.notes!,
                          style: const TextStyle(fontSize: 14)),
                    ],
                  ),
                ),
              if (po.items.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Text(
                    'LINE ITEMS (${po.items.length})',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.8),
                  ),
                ),
                ...po.items.map((item) => _LineItemTile(item: item)),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(
                        CurrencyFormatter.format(po.totalAmount),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          ),
        ),
      ),
    );
  }
}

class _PoHeader extends StatelessWidget {
  final PurchaseOrderModel po;
  const _PoHeader({required this.po});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      color: AppColors.primary,
      child: Column(
        children: [
          Text(
            po.orderNumber,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          StatusBadge(status: po.status),
        ],
      ),
    );
  }
}

class _LineItemTile extends StatelessWidget {
  final PurchaseOrderItemModel item;
  const _LineItemTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.productName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        'Ordered: ${item.quantityOrdered}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Received: ${item.quantityReceived}',
                        style: TextStyle(
                          fontSize: 12,
                          color: item.quantityReceived >= item.quantityOrdered
                              ? AppColors.success
                              : AppColors.warning,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  CurrencyFormatter.format(item.lineTotal),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14),
                ),
                Text(
                  '@ ${CurrencyFormatter.format(item.unitCost)}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
