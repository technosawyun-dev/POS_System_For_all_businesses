import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/inventory_provider.dart';
import '../data/inventory_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../models/user_model.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(inventoryProvider.notifier).load());
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
      ref.read(inventoryProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(inventoryProvider);
    final user = ref.watch(currentUserProvider);
    final canAdjust = user?.canManageProducts ?? false;
    final lowStockCount = state.items.where((s) => s.isLowStock).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          if (lowStockCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Chip(
                avatar: const Icon(Icons.warning_amber_outlined,
                    size: 16, color: AppColors.warning),
                label: Text('$lowStockCount low',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.warning)),
                backgroundColor: AppColors.warningLight,
                side: BorderSide.none,
              ),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(100),
          child: Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by product name...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              ref
                                  .read(inventoryProvider.notifier)
                                  .search('');
                            },
                          )
                        : null,
                    isDense: true,
                    contentPadding:
                        const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onChanged: (v) =>
                      ref.read(inventoryProvider.notifier).search(v),
                ),
              ),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: const Text('All Stock'),
                        selected: !state.lowStockOnly,
                        onSelected: (_) => ref
                            .read(inventoryProvider.notifier)
                            .load(refresh: true, lowStockOnly: false),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        avatar: const Icon(
                            Icons.warning_amber_outlined,
                            size: 14),
                        label: const Text('Low Stock'),
                        selected: state.lowStockOnly,
                        onSelected: (_) => ref
                            .read(inventoryProvider.notifier)
                            .toggleLowStockFilter(),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(inventoryProvider.notifier).load(refresh: true),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () =>
                        ref.read(inventoryProvider.notifier).load(refresh: true),
                  )
                : state.items.isEmpty
                    ? const EmptyView(
                        icon: Icons.warehouse_outlined,
                        title: 'No stock data found',
                        subtitle:
                            'Stock levels appear after products are created',
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.only(bottom: 80),
                        itemCount: state.items.length +
                            (state.isLoadingMore ? 1 : 0),
                        itemBuilder: (_, i) {
                          if (i >= state.items.length) {
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                          return _StockTile(
                            stock: state.items[i],
                            canAdjust: canAdjust,
                            onAdjust: canAdjust
                                ? () => _showAdjustSheet(
                                    context, state.items[i], user)
                                : null,
                          );
                        },
                      ),
      ),
    );
  }

  void _showAdjustSheet(
      BuildContext context, StockLevelModel stock, UserModel? user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      constraints: Responsive.bottomSheetConstraints(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AdjustStockSheet(
        stock: stock,
        branchId: user?.primaryBranchId ?? '',
        onSuccess: () =>
            ref.read(inventoryProvider.notifier).load(refresh: true),
      ),
    );
  }
}

class _StockTile extends StatelessWidget {
  final StockLevelModel stock;
  final bool canAdjust;
  final VoidCallback? onAdjust;

  const _StockTile({
    required this.stock,
    required this.canAdjust,
    this.onAdjust,
  });

  @override
  Widget build(BuildContext context) {
    final qty = stock.quantityOnHand;
    final isLow = stock.isLowStock;
    final isOut = qty <= 0;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isOut
                    ? AppColors.errorLight
                    : isLow
                        ? AppColors.warningLight
                        : AppColors.successLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isOut
                    ? Icons.remove_circle_outline
                    : isLow
                        ? Icons.warning_amber_outlined
                        : Icons.check_circle_outline,
                color: isOut
                    ? AppColors.error
                    : isLow
                        ? AppColors.warning
                        : AppColors.success,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stock.productName,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (stock.sku != null)
                    Text('SKU: ${stock.sku}',
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  qty.toStringAsFixed(0),
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: isOut
                        ? AppColors.error
                        : isLow
                            ? AppColors.warning
                            : AppColors.textPrimary,
                  ),
                ),
                if (stock.reorderPoint != null)
                  Text(
                    'Min: ${stock.reorderPoint!.toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textSecondary),
                  ),
              ],
            ),
            if (canAdjust) ...[
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.edit_outlined,
                    size: 18, color: AppColors.textSecondary),
                tooltip: 'Adjust Stock',
                onPressed: onAdjust,
                padding: EdgeInsets.zero,
                constraints:
                    const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AdjustStockSheet extends ConsumerStatefulWidget {
  final StockLevelModel stock;
  final String branchId;
  final VoidCallback onSuccess;

  const _AdjustStockSheet({
    required this.stock,
    required this.branchId,
    required this.onSuccess,
  });

  @override
  ConsumerState<_AdjustStockSheet> createState() =>
      _AdjustStockSheetState();
}

class _AdjustStockSheetState extends ConsumerState<_AdjustStockSheet> {
  final _adjustment = TextEditingController();
  String _reason = 'CORRECTION';
  bool _isSaving = false;

  final _reasons = [
    ('CORRECTION', 'Correction'),
    ('PURCHASE', 'Purchase'),
    ('RETURN', 'Return'),
    ('DAMAGE', 'Damage/Loss'),
    ('OTHER', 'Other'),
  ];

  @override
  void dispose() {
    _adjustment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_adjustment.text);
    if (amount == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter a valid number (e.g. 10 or -5)')));
      return;
    }
    if (widget.branchId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No branch assigned to your account')));
      return;
    }
    setState(() => _isSaving = true);
    try {
      await ref.read(inventoryRepositoryProvider).adjustStock(
            productId: widget.stock.productId,
            branchId: widget.branchId,
            adjustment: amount,
            reason: _reason,
          );
      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = widget.stock.quantityOnHand;
    final delta = double.tryParse(_adjustment.text) ?? 0;
    final newQty = current + delta;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(widget.stock.productName,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop()),
            ],
          ),
          Text('Current: ${current.toStringAsFixed(0)} units',
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 20),
          TextField(
            controller: _adjustment,
            decoration: const InputDecoration(
              labelText: 'Adjustment (e.g. +10 or -5)',
              hintText: '10',
              prefixIcon: Icon(Icons.swap_vert),
            ),
            keyboardType:
                const TextInputType.numberWithOptions(signed: true, decimal: true),
            onChanged: (_) => setState(() {}),
            autofocus: true,
          ),
          const SizedBox(height: 12),
          // Reason dropdown
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(
                labelText: 'Reason',
                prefixIcon: Icon(Icons.info_outline)),
            items: _reasons
                .map((r) =>
                    DropdownMenuItem(value: r.$1, child: Text(r.$2)))
                .toList(),
            onChanged: (v) => setState(() => _reason = v ?? 'CORRECTION'),
          ),
          const SizedBox(height: 12),
          // Preview
          if (_adjustment.text.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: newQty >= 0
                    ? AppColors.successLight
                    : AppColors.errorLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('New Quantity',
                      style: TextStyle(fontWeight: FontWeight.w500)),
                  Text(
                    newQty.toStringAsFixed(0),
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                      color: newQty >= 0
                          ? AppColors.success
                          : AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _submit,
              child: _isSaving
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Apply Adjustment'),
            ),
          ),
        ],
      ),
    );
  }
}
