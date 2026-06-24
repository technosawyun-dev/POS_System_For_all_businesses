import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/pos_provider.dart';
import '../../../models/product_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';

class ProductGrid extends ConsumerStatefulWidget {
  final String? branchId;
  final String sessionId;
  final String branchIdForCart;
  final VoidCallback? onItemAdded;

  const ProductGrid({
    super.key,
    required this.branchId,
    required this.sessionId,
    required this.branchIdForCart,
    this.onItemAdded,
  });

  @override
  ConsumerState<ProductGrid> createState() => _ProductGridState();
}

class _ProductGridState extends ConsumerState<ProductGrid> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final productState =
        ref.watch(productListProvider(widget.branchId));
    final cartParams = (
      branchId: widget.branchIdForCart,
      sessionId: widget.sessionId
    );

    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search products or scan barcode...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 20),
                      onPressed: () {
                        _searchController.clear();
                        ref
                            .read(productListProvider(widget.branchId).notifier)
                            .search('');
                      },
                    )
                  : null,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 12),
            ),
            onChanged: (q) {
              ref
                  .read(productListProvider(widget.branchId).notifier)
                  .search(q);
            },
          ),
        ),

        // Product grid
        Expanded(
          child: productState.isLoading && productState.products.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : productState.products.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined,
                              size: 48, color: AppColors.textDisabled),
                          const SizedBox(height: 12),
                          Text(
                            productState.search.isNotEmpty
                                ? 'No products found for "${productState.search}"'
                                : 'No products available',
                            style: const TextStyle(
                                color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () => ref
                          .read(productListProvider(widget.branchId).notifier)
                          .loadProducts(refresh: true),
                      child: LayoutBuilder(builder: (ctx, constraints) {
                        final crossAxisCount =
                            constraints.maxWidth > 600 ? 4 : 3;
                        return GridView.builder(
                          padding: const EdgeInsets.all(8),
                          gridDelegate:
                              SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: crossAxisCount,
                            childAspectRatio: 0.75,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                          itemCount: productState.products.length +
                              (productState.hasMore ? 1 : 0),
                          itemBuilder: (ctx, idx) {
                            if (idx >= productState.products.length) {
                              // Load more trigger
                              WidgetsBinding.instance.addPostFrameCallback(
                                  (_) => ref
                                      .read(productListProvider(
                                              widget.branchId)
                                          .notifier)
                                      .loadProducts());
                              return const Center(
                                  child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2),
                              ));
                            }
                            final product =
                                productState.products[idx];
                            return _ProductCard(
                              product: product,
                              onTap: () {
                                if (product.isVariable &&
                                    product.hasVariants) {
                                  _showVariantPicker(
                                      context, product, cartParams);
                                } else {
                                  ref
                                      .read(posCartProvider(cartParams)
                                          .notifier)
                                      .addItem(product);
                                  widget.onItemAdded?.call();
                                }
                              },
                            );
                          },
                        );
                      }),
                    ),
        ),
      ],
    );
  }

  void _showVariantPicker(
    BuildContext context,
    ProductModel product,
    ({String branchId, String sessionId}) cartParams,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => _VariantPicker(
        product: product,
        onSelect: (variant) {
          ref
              .read(posCartProvider(cartParams).notifier)
              .addItem(product, variant: variant);
          Navigator.pop(ctx);
          widget.onItemAdded?.call();
        },
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback onTap;

  const _ProductCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product image / icon
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: product.imageUrl != null
                    ? ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(12)),
                        child: Image.network(
                          product.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.image_not_supported_outlined,
                            color: AppColors.textDisabled,
                            size: 32,
                          ),
                        ),
                      )
                    : Icon(
                        Icons.inventory_2_outlined,
                        size: 32,
                        color: AppColors.primary.withValues(alpha: 0.4),
                      ),
              ),
            ),

            // Product info
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      CurrencyFormatter.format(product.sellingPrice),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VariantPicker extends StatelessWidget {
  final ProductModel product;
  final void Function(ProductVariantModel) onSelect;

  const _VariantPicker(
      {required this.product, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Select variant for ${product.name}',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: product.variants.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (ctx, idx) {
                final v = product.variants[idx];
                return ListTile(
                  title: Text(v.name),
                  subtitle: v.attr1Value != null
                      ? Text('${v.attr1Name}: ${v.attr1Value}')
                      : null,
                  trailing: Text(
                    CurrencyFormatter.format(v.sellingPrice),
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                  onTap: () => onSelect(v),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
