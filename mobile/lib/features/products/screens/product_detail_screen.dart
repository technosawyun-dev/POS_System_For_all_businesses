import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/products_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/info_row.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/product_model.dart';
import '../../../core/providers/auth_provider.dart';
import 'product_form_screen.dart';

final _productDetailProvider =
    FutureProvider.family<ProductModel, String>((ref, id) async {
  return ref.watch(productsRepositoryProvider).getProduct(id);
});

class ProductDetailScreen extends ConsumerWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productAsync = ref.watch(_productDetailProvider(productId));
    final user = ref.watch(currentUserProvider);
    final canEdit = user?.canManageProducts ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Product Details'),
        actions: [
          if (canEdit)
            productAsync.whenOrNull(
                  data: (p) => IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ProductFormScreen(product: p),
                        fullscreenDialog: true,
                      ),
                    ),
                  ),
                ) ??
                const SizedBox(),
        ],
      ),
      body: productAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(_productDetailProvider(productId)),
        ),
        data: (product) => ContentWrapper(
          maxWidth: 720,
          child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ProductHeader(product: product),
              InfoSection(
                title: 'PRICING',
                children: [
                  InfoRow(
                      label: 'Selling Price',
                      value: CurrencyFormatter.format(product.sellingPrice),
                      valueColor: AppColors.primary),
                  InfoRow(
                      label: 'Cost Price',
                      value: CurrencyFormatter.format(product.costPrice)),
                  if (product.taxRate > 0)
                    InfoRow(
                        label: 'Tax Rate',
                        value: '${product.taxRate.toStringAsFixed(1)}%'),
                ],
              ),
              InfoSection(
                title: 'DETAILS',
                children: [
                  if (product.sku != null)
                    InfoRow(label: 'SKU', value: product.sku!),
                  if (product.barcode != null)
                    InfoRow(label: 'Barcode', value: product.barcode!),
                  if (product.categoryName != null)
                    InfoRow(label: 'Category', value: product.categoryName!),
                  if (product.unit != null)
                    InfoRow(label: 'Unit', value: product.unit!),
                  InfoRow(
                      label: 'Type',
                      value: product.productType),
                  InfoRow(
                    label: 'Status',
                    value: product.isActive ? 'Active' : 'Inactive',
                    valueColor:
                        product.isActive ? AppColors.success : AppColors.error,
                  ),
                ],
              ),
              if (product.quantityOnHand != null)
                InfoSection(
                  title: 'STOCK',
                  children: [
                    InfoRow(
                      label: 'Quantity on Hand',
                      value: product.quantityOnHand!.toStringAsFixed(0),
                      valueColor: product.quantityOnHand! <= 0
                          ? AppColors.error
                          : AppColors.success,
                    ),
                  ],
                ),
              if (product.description != null &&
                  product.description!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('DESCRIPTION',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                              letterSpacing: 0.8)),
                      const SizedBox(height: 8),
                      Text(product.description!,
                          style: const TextStyle(fontSize: 14)),
                    ],
                  ),
                ),
              if (product.hasVariants) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Text('VARIANTS (${product.variants.length})',
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                          letterSpacing: 0.8)),
                ),
                ...product.variants.map((v) => Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      child: ListTile(
                        title: Text(v.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: v.sku != null
                            ? Text('SKU: ${v.sku}',
                                style: const TextStyle(fontSize: 12))
                            : null,
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(CurrencyFormatter.format(v.sellingPrice),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                            StatusBadge(
                                status: v.isActive ? 'ACTIVE' : 'INACTIVE'),
                          ],
                        ),
                      ),
                    )),
                const SizedBox(height: 16),
              ],
            ],
          ),
          ),
        ),
      ),
    );
  }
}

class _ProductHeader extends StatelessWidget {
  final ProductModel product;
  const _ProductHeader({required this.product});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      color: AppColors.primary,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.inventory_2_outlined,
                color: Colors.white, size: 32),
          ),
          const SizedBox(height: 12),
          Text(
            product.name,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            CurrencyFormatter.format(product.sellingPrice),
            style: const TextStyle(
                color: Colors.white70, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
