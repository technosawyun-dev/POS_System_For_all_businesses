import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../data/products_repository.dart';
import '../providers/products_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';
import '../../../models/product_model.dart';

class ProductFormScreen extends ConsumerStatefulWidget {
  final ProductModel? product;
  const ProductFormScreen({super.key, this.product});

  bool get isEdit => product != null;

  @override
  ConsumerState<ProductFormScreen> createState() =>
      _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _sku = TextEditingController();
  final _barcode = TextEditingController();
  final _sellingPrice = TextEditingController();
  final _costPrice = TextEditingController();
  final _description = TextEditingController();
  String? _selectedCategoryId;
  bool _isActive = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    if (p != null) {
      _name.text = p.name;
      _sku.text = p.sku ?? '';
      _barcode.text = p.barcode ?? '';
      _sellingPrice.text = p.sellingPrice.toStringAsFixed(0);
      _costPrice.text = p.costPrice.toStringAsFixed(0);
      _description.text = p.description ?? '';
      _selectedCategoryId = p.categoryId;
      _isActive = p.isActive;
    }
    Future.microtask(() {
      if (ref.read(productsProvider).categories.isEmpty) {
        ref.read(productsProvider.notifier).loadCategories();
      }
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _barcode.dispose();
    _sellingPrice.dispose();
    _costPrice.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _openCameraScanner() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _BarcodeScannerSheet(),
    );
    if (result != null && mounted) {
      setState(() => _barcode.text = result);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final repo = ref.read(productsRepositoryProvider);
      final data = {
        'name': _name.text.trim(),
        if (_sku.text.trim().isNotEmpty) 'sku': _sku.text.trim(),
        if (_barcode.text.trim().isNotEmpty)
          'barcode': _barcode.text.trim(),
        'selling_price': double.parse(_sellingPrice.text),
        'cost_price': _costPrice.text.isNotEmpty
            ? double.parse(_costPrice.text)
            : 0.0,
        if (_selectedCategoryId != null)
          'category_id': _selectedCategoryId,
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        'is_active': _isActive,
      };

      if (widget.isEdit) {
        final updated = await repo.updateProduct(widget.product!.id, data);
        ref.read(productsProvider.notifier).updateItem(updated);
      } else {
        final created = await repo.createProduct(data);
        ref.read(productsProvider.notifier).addItem(created);
      }

      if (mounted) Navigator.of(context).pop();
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
    final categories = ref.watch(productsProvider).categories;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEdit ? 'Edit Product' : 'New Product'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _save,
            child: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
      body: ContentWrapper(
        child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Name
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                labelText: 'Product Name *',
                prefixIcon: Icon(Icons.inventory_2_outlined),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            // SKU
            TextFormField(
              controller: _sku,
              decoration: const InputDecoration(
                labelText: 'SKU',
                prefixIcon: Icon(Icons.label_outline),
              ),
            ),
            const SizedBox(height: 16),
            // Barcode — camera scan button available on all screen sizes
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _barcode,
                    decoration: const InputDecoration(
                      labelText: 'Barcode',
                      prefixIcon: Icon(Icons.qr_code_outlined),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: IconButton.filled(
                    onPressed: _openCameraScanner,
                    icon: const Icon(Icons.qr_code_scanner_outlined),
                    tooltip: 'Scan barcode',
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Prices row
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _sellingPrice,
                    decoration: const InputDecoration(
                      labelText: 'Selling Price *',
                      prefixText: 'MMK ',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Required';
                      if (double.tryParse(v) == null) return 'Invalid';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _costPrice,
                    decoration: const InputDecoration(
                      labelText: 'Cost Price',
                      prefixText: 'MMK ',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) {
                      if (v != null &&
                          v.isNotEmpty &&
                          double.tryParse(v) == null) { return 'Invalid'; }
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Category
            if (categories.isNotEmpty)
              DropdownButtonFormField<String>(
                initialValue: _selectedCategoryId,
                decoration: const InputDecoration(
                  labelText: 'Category',
                  prefixIcon: Icon(Icons.category_outlined),
                ),
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('No category')),
                  ...categories.map((c) => DropdownMenuItem(
                        value: c.id,
                        child: Text(c.name),
                      )),
                ],
                onChanged: (v) => setState(() => _selectedCategoryId = v),
              ),
            if (categories.isNotEmpty) const SizedBox(height: 16),
            // Description
            TextFormField(
              controller: _description,
              decoration: const InputDecoration(
                labelText: 'Description',
                prefixIcon: Icon(Icons.notes_outlined),
                alignLabelWithHint: true,
              ),
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),
            // Active toggle
            SwitchListTile(
              title: const Text('Active'),
              subtitle: const Text('Product is available for sale'),
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
              activeThumbColor: AppColors.primary,
              activeTrackColor: AppColors.primaryLight,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            const SizedBox(height: 32),
          ],
        ),
        ),
      ),
    );
  }
}

class _BarcodeScannerSheet extends StatefulWidget {
  const _BarcodeScannerSheet();

  @override
  State<_BarcodeScannerSheet> createState() => _BarcodeScannerSheetState();
}

class _BarcodeScannerSheetState extends State<_BarcodeScannerSheet> {
  final _controller = MobileScannerController();
  bool _scanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.55,
      decoration: const BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
            child: Row(
              children: [
                const Icon(Icons.qr_code_scanner_outlined,
                    color: Colors.white, size: 20),
                const SizedBox(width: 10),
                const Text('Scan Barcode',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(20)),
              child: MobileScanner(
                controller: _controller,
                onDetect: (capture) {
                  if (_scanned) return;
                  final raw = capture.barcodes.isNotEmpty
                      ? capture.barcodes.first.rawValue
                      : null;
                  if (raw != null && raw.isNotEmpty) {
                    _scanned = true;
                    Navigator.of(context).pop(raw);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
