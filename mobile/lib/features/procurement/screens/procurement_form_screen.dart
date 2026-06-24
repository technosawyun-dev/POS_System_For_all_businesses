import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/procurement_repository.dart';
import '../providers/procurement_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';

class ProcurementFormScreen extends ConsumerStatefulWidget {
  const ProcurementFormScreen({super.key});

  @override
  ConsumerState<ProcurementFormScreen> createState() =>
      _ProcurementFormScreenState();
}

class _ProcurementFormScreenState
    extends ConsumerState<ProcurementFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notes = TextEditingController();
  String? _selectedSupplierId;
  DateTime? _expectedDate;
  bool _isSaving = false;

  final List<_LineItemRow> _items = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (ref.read(procurementProvider).suppliers.isEmpty) {
        ref.read(procurementProvider.notifier).loadSuppliers();
      }
    });
    _addItem(); // start with one empty row
  }

  @override
  void dispose() {
    _notes.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _addItem() {
    setState(() => _items.add(_LineItemRow()));
  }

  void _removeItem(int index) {
    setState(() {
      _items[index].dispose();
      _items.removeAt(index);
    });
  }

  double get _total => _items.fold(0, (sum, item) {
        final qty = double.tryParse(item.qty.text) ?? 0;
        final cost = double.tryParse(item.unitCost.text) ?? 0;
        return sum + (qty * cost);
      });

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSupplierId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Please select a supplier'),
        backgroundColor: AppColors.warning,
      ));
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Add at least one item'),
        backgroundColor: AppColors.warning,
      ));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final repo = ref.read(procurementRepositoryProvider);
      final itemsData = _items
          .map((item) => {
                'product_name': item.productName.text.trim(),
                'quantity_ordered':
                    int.tryParse(item.qty.text) ?? 1,
                'unit_cost':
                    double.tryParse(item.unitCost.text) ?? 0.0,
              })
          .toList();

      final data = {
        'supplier_id': _selectedSupplierId,
        'items': itemsData,
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        if (_expectedDate != null)
          'expected_date':
              _expectedDate!.toIso8601String().substring(0, 10),
      };

      final po = await repo.createPurchaseOrder(data);
      ref.read(procurementProvider.notifier).addItem(po);
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
    final suppliers = ref.watch(procurementProvider).suppliers;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Purchase Order'),
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
            // Supplier
            DropdownButtonFormField<String>(
              initialValue: _selectedSupplierId,
              decoration: const InputDecoration(
                labelText: 'Supplier *',
                prefixIcon: Icon(Icons.business_outlined),
              ),
              items: suppliers
                  .map((s) => DropdownMenuItem(
                        value: s.id,
                        child: Text(s.name),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selectedSupplierId = v),
              validator: (v) =>
                  v == null ? 'Select a supplier' : null,
            ),
            const SizedBox(height: 16),
            // Expected date
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate:
                      _expectedDate ?? DateTime.now().add(const Duration(days: 7)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  setState(() => _expectedDate = picked);
                }
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Expected Date',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                ),
                child: Text(
                  _expectedDate != null
                      ? '${_expectedDate!.day}/${_expectedDate!.month}/${_expectedDate!.year}'
                      : 'Optional',
                  style: TextStyle(
                    color: _expectedDate != null
                        ? null
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Notes
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(
                labelText: 'Notes',
                prefixIcon: Icon(Icons.notes_outlined),
                alignLabelWithHint: true,
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 20),
            // Line items header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Line Items',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w700)),
                TextButton.icon(
                  onPressed: _addItem,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add Item'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ..._items.asMap().entries.map(
              (e) => _LineItemWidget(
                key: ValueKey(e.key),
                row: e.value,
                index: e.key,
                onRemove: _items.length > 1 ? () => _removeItem(e.key) : null,
              ),
            ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Estimated Total',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
                StatefulBuilder(
                  builder: (context, setInner) {
                    // Rebuild total when typing
                    return Text(
                      'MMK ${_total.toStringAsFixed(0)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: AppColors.primary),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
        ),
      ),
    );
  }
}

class _LineItemRow {
  final productName = TextEditingController();
  final qty = TextEditingController(text: '1');
  final unitCost = TextEditingController();

  void dispose() {
    productName.dispose();
    qty.dispose();
    unitCost.dispose();
  }
}

class _LineItemWidget extends StatelessWidget {
  final _LineItemRow row;
  final int index;
  final VoidCallback? onRemove;

  const _LineItemWidget({
    super.key,
    required this.row,
    required this.index,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Item ${index + 1}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
                const Spacer(),
                if (onRemove != null)
                  IconButton(
                    icon: const Icon(Icons.close,
                        size: 18, color: AppColors.error),
                    onPressed: onRemove,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: row.productName,
              decoration: const InputDecoration(
                hintText: 'Product name',
                isDense: true,
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: row.qty,
                    decoration: const InputDecoration(
                      labelText: 'Qty',
                      isDense: true,
                    ),
                    keyboardType: TextInputType.number,
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if (int.tryParse(v) == null) return 'Invalid';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: row.unitCost,
                    decoration: const InputDecoration(
                      labelText: 'Unit Cost',
                      prefixText: 'MMK ',
                      isDense: true,
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if (double.tryParse(v) == null) return 'Invalid';
                      return null;
                    },
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
