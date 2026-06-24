import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/pos_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../models/cart_model.dart';

class CartPanel extends ConsumerWidget {
  final String branchId;
  final String sessionId;
  final VoidCallback onCheckout;
  final VoidCallback onClear;

  const CartPanel({
    super.key,
    required this.branchId,
    required this.sessionId,
    required this.onCheckout,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartParams = (branchId: branchId, sessionId: sessionId);
    final cartState = ref.watch(posCartProvider(cartParams));

    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 8, 12),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(
                bottom: BorderSide(color: AppColors.divider)),
          ),
          child: Row(
            children: [
              const Icon(Icons.shopping_cart_outlined,
                  size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              const Text(
                'Cart',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600),
              ),
              if (cartState.itemCount > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${cartState.itemCount}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
              const Spacer(),
              if (cartState.customer != null)
                Chip(
                  avatar: const Icon(Icons.person_outline,
                      size: 14, color: AppColors.primary),
                  label: Text(
                    cartState.customer!.name,
                    style: const TextStyle(fontSize: 11),
                  ),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => ref
                      .read(posCartProvider(cartParams).notifier)
                      .setCustomer(null),
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
              if (!cartState.isEmpty)
                IconButton(
                  icon: const Icon(Icons.delete_outline,
                      color: AppColors.error),
                  tooltip: 'Clear cart',
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('Clear Cart?'),
                        content: const Text(
                            'This will remove all items from the cart.'),
                        actions: [
                          TextButton(
                              onPressed: () =>
                                  Navigator.pop(context),
                              child: const Text('Cancel')),
                          ElevatedButton(
                            onPressed: () {
                              Navigator.pop(context);
                              onClear();
                            },
                            style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.error),
                            child: const Text('Clear'),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),

        // Cart items
        Expanded(
          child: cartState.isEmpty
              ? _EmptyCart()
              : ListView.separated(
                  padding: const EdgeInsets.only(top: 8),
                  itemCount: cartState.items.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 56),
                  itemBuilder: (ctx, idx) {
                    final item = cartState.items[idx];
                    return _CartItemRow(
                      item: item,
                      onIncrement: () => ref
                          .read(posCartProvider(cartParams).notifier)
                          .incrementItem(item.key),
                      onDecrement: () => ref
                          .read(posCartProvider(cartParams).notifier)
                          .decrementItem(item.key),
                      onRemove: () => ref
                          .read(posCartProvider(cartParams).notifier)
                          .removeItem(item.key),
                    );
                  },
                ),
        ),

        // Summary + checkout
        if (!cartState.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(
                  top: BorderSide(color: AppColors.divider)),
            ),
            child: Column(
              children: [
                _SummaryRow(
                    label: 'Subtotal',
                    value: CurrencyFormatter.format(
                        cartState.subtotal)),
                if (cartState.taxTotal > 0)
                  _SummaryRow(
                      label: 'Tax',
                      value:
                          CurrencyFormatter.format(cartState.taxTotal)),
                if (cartState.discountTotal > 0)
                  _SummaryRow(
                    label: 'Discount',
                    value:
                        '- ${CurrencyFormatter.format(cartState.discountTotal)}',
                    valueColor: AppColors.success,
                  ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700)),
                    Text(
                      CurrencyFormatter.format(cartState.total),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: cartState.isCheckingOut
                        ? null
                        : onCheckout,
                    icon: cartState.isCheckingOut
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.payment_rounded),
                    label: Text(
                      cartState.isCheckingOut
                          ? 'Processing...'
                          : 'Charge  ${CurrencyFormatter.format(cartState.total)}',
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CartItemRow extends StatelessWidget {
  final LocalCartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;

  const _CartItemRow({
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          // Qty badge
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${item.quantity}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Name + price
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.displayName,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  CurrencyFormatter.format(item.unitPrice),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          // Line total
          Text(
            CurrencyFormatter.format(item.lineSubtotal),
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(width: 4),
          // Controls
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SmallBtn(
                  icon: Icons.add, color: AppColors.success,
                  onTap: onIncrement),
              const SizedBox(height: 2),
              _SmallBtn(
                icon: item.quantity <= 1
                    ? Icons.delete_outline
                    : Icons.remove,
                color: item.quantity <= 1
                    ? AppColors.error
                    : AppColors.textSecondary,
                onTap: item.quantity <= 1 ? onRemove : onDecrement,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SmallBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _SmallBtn(
      {required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(icon, size: 14, color: color),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _SummaryRow(
      {required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: valueColor ?? AppColors.textPrimary)),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shopping_cart_outlined,
              size: 48, color: AppColors.textDisabled),
          const SizedBox(height: 12),
          const Text(
            'Cart is empty',
            style:
                TextStyle(fontSize: 14, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          const Text(
            'Tap a product to add it',
            style: TextStyle(
                fontSize: 12, color: AppColors.textDisabled),
          ),
        ],
      ),
    );
  }
}
