import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/products_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/product_model.dart';
import '../../../core/providers/auth_provider.dart';
import 'product_detail_screen.dart';
import 'product_form_screen.dart';

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      await ref.read(productsProvider.notifier).load();
      await ref.read(productsProvider.notifier).loadCategories();
    });
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(productsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productsProvider);
    final user = ref.watch(currentUserProvider);
    final canCreate = user?.canManageProducts ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(100),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search products...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              ref.read(productsProvider.notifier).search('');
                            },
                          )
                        : null,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onChanged: (v) => ref.read(productsProvider.notifier).search(v),
                ),
              ),
              if (state.categories.isNotEmpty)
                SizedBox(
                  height: 40,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: state.categories.length + 1,
                    itemBuilder: (_, i) {
                      if (i == 0) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: const Text('All'),
                            selected: state.categoryFilter == null,
                            onSelected: (_) => ref
                                .read(productsProvider.notifier)
                                .filterCategory(null),
                          ),
                        );
                      }
                      final cat = state.categories[i - 1];
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(cat.name),
                          selected: state.categoryFilter == cat.id,
                          onSelected: (_) => ref
                              .read(productsProvider.notifier)
                              .filterCategory(cat.id),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton(
              onPressed: () => _showForm(context, null),
              child: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.read(productsProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () => ref.read(productsProvider.notifier).load(refresh: true),
                  )
                : state.items.isEmpty
                    ? EmptyView(
                        icon: Icons.inventory_2_outlined,
                        title: 'No products found',
                        action: canCreate
                            ? ElevatedButton.icon(
                                onPressed: () => _showForm(context, null),
                                icon: const Icon(Icons.add),
                                label: const Text('Add Product'),
                              )
                            : null,
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.only(bottom: 80),
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
                          return _ProductTile(
                            product: state.items[i],
                            canEdit: canCreate,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ProductDetailScreen(
                                    productId: state.items[i].id),
                              ),
                            ),
                            onEdit: canCreate
                                ? () => _showForm(context, state.items[i])
                                : null,
                          );
                        },
                      ),
      ),
    );
  }

  void _showForm(BuildContext context, ProductModel? product) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ProductFormScreen(product: product),
      fullscreenDialog: true,
    ));
  }
}

class _ProductTile extends StatelessWidget {
  final ProductModel product;
  final bool canEdit;
  final VoidCallback? onTap;
  final VoidCallback? onEdit;

  const _ProductTile({
    required this.product,
    required this.canEdit,
    this.onTap,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.inventory_2_outlined,
                  color: AppColors.textSecondary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(product.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ),
                      StatusBadge(
                          status: product.isActive ? 'ACTIVE' : 'INACTIVE'),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (product.sku != null)
                        Text('SKU: ${product.sku}',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textSecondary)),
                      if (product.categoryName != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.infoLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(product.categoryName!,
                              style: const TextStyle(
                                  fontSize: 10, color: AppColors.info)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        CurrencyFormatter.format(product.sellingPrice),
                        style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13),
                      ),
                      if (product.quantityOnHand != null)
                        Text(
                          'Stock: ${product.quantityOnHand!.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 11,
                            color: (product.quantityOnHand ?? 0) > 0
                                ? AppColors.success
                                : AppColors.error,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (canEdit)
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 18,
                    color: AppColors.textSecondary),
                onPressed: onEdit,
              ),
          ],
        ),
      ),
      ),
    );
  }
}
