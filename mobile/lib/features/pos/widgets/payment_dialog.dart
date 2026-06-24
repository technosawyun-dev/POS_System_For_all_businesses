import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../models/order_model.dart';
import '../data/pos_repository.dart';

class PaymentDialog extends StatefulWidget {
  final double totalAmount;
  final void Function(List<CheckoutPayment>) onConfirm;

  const PaymentDialog({
    super.key,
    required this.totalAmount,
    required this.onConfirm,
  });

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  String _selectedMethod = PaymentMethod.cash;
  final _amountController = TextEditingController();
  final _refController = TextEditingController();
  final List<_SplitPaymentEntry> _splits = [];
  bool _isSplitMode = false;

  @override
  void initState() {
    super.initState();
    _amountController.text =
        widget.totalAmount.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _refController.dispose();
    super.dispose();
  }

  double get _enteredAmount =>
      double.tryParse(_amountController.text) ?? 0;

  double get _splitTotal =>
      _splits.fold(0, (sum, s) => sum + s.amount);

  double get _remainingForSplit =>
      widget.totalAmount - _splitTotal;

  double get _change =>
      _isSplitMode ? 0 : _enteredAmount - widget.totalAmount;

  void _confirm() {
    if (_isSplitMode) {
      if (_splitTotal < widget.totalAmount) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Total payments must cover the full amount'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      widget.onConfirm(
          _splits.map((s) => s.toCheckoutPayment()).toList());
    } else {
      if (_enteredAmount < widget.totalAmount) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Amount is less than the total'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      widget.onConfirm([
        CheckoutPayment(
          paymentMethod: _selectedMethod,
          amount: widget.totalAmount,
          referenceNumber: _refController.text.isNotEmpty
              ? _refController.text
              : null,
        ),
      ]);
    }
  }

  void _addSplit() {
    final amount = double.tryParse(_amountController.text) ?? 0;
    if (amount <= 0) return;
    setState(() {
      _splits.add(_SplitPaymentEntry(
        method: _selectedMethod,
        amount: amount,
        reference: _refController.text.isNotEmpty
            ? _refController.text
            : null,
      ));
      _amountController.text =
          _remainingForSplit.toStringAsFixed(0);
      _refController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    const Text('Payment',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),

                // Total
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      const Text('Total Amount',
                          style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary)),
                      const SizedBox(height: 4),
                      Text(
                        CurrencyFormatter.format(widget.totalAmount),
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),

                // Split mode toggle
                Row(
                  children: [
                    const Text('Split Payment',
                        style: TextStyle(fontSize: 14)),
                    const SizedBox(width: 8),
                    Switch(
                      value: _isSplitMode,
                      onChanged: (v) => setState(() {
                        _isSplitMode = v;
                        _splits.clear();
                        _amountController.text =
                            widget.totalAmount.toStringAsFixed(0);
                      }),
                      activeThumbColor: AppColors.primary,
                      activeTrackColor: AppColors.primaryLight,
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Split payments list
                if (_splits.isNotEmpty) ...[
                  ...List.generate(_splits.length, (i) {
                    final s = _splits[i];
                    return ListTile(
                      dense: true,
                      leading: const Icon(Icons.check_circle,
                          color: AppColors.success, size: 18),
                      title: Text(PaymentMethod.displayName(s.method)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(CurrencyFormatter.format(s.amount),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600)),
                          IconButton(
                            icon: const Icon(Icons.close,
                                size: 16, color: AppColors.error),
                            onPressed: () =>
                                setState(() => _splits.removeAt(i)),
                          ),
                        ],
                      ),
                    );
                  }),
                  const Divider(),
                  if (_remainingForSplit > 0)
                    Text(
                      'Remaining: ${CurrencyFormatter.format(_remainingForSplit)}',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.warning),
                    ),
                  const SizedBox(height: 8),
                ],

                // Payment method selection
                const Text('Payment Method',
                    style: TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 8),
                _PaymentMethodGrid(
                  selected: _selectedMethod,
                  onSelect: (m) =>
                      setState(() => _selectedMethod = m),
                ),
                const SizedBox(height: 16),

                // Amount field
                TextFormField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true),
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    labelText: _isSplitMode
                        ? 'Amount for this payment'
                        : 'Amount Tendered',
                    prefixText: 'MMK ',
                  ),
                  onChanged: (_) => setState(() {}),
                ),

                // Reference field (for card/mobile payments)
                if (_selectedMethod != PaymentMethod.cash) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _refController,
                    decoration: const InputDecoration(
                      labelText: 'Reference / Transaction ID',
                      prefixIcon: Icon(Icons.receipt_long_outlined),
                    ),
                  ),
                ],

                // Change due (single payment cash only)
                if (!_isSplitMode &&
                    _selectedMethod == PaymentMethod.cash &&
                    _change > 0) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.successLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment:
                          MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Change Due',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppColors.success)),
                        Text(
                          CurrencyFormatter.format(_change),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // Action buttons
                if (_isSplitMode && _remainingForSplit > 0)
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _addSplit,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Payment'),
                    ),
                  ),

                if (!_isSplitMode || _splitTotal >= widget.totalAmount)
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _confirm,
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Confirm Payment'),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PaymentMethodGrid extends StatelessWidget {
  final String selected;
  final void Function(String) onSelect;

  const _PaymentMethodGrid(
      {required this.selected, required this.onSelect});

  static const _methods = [
    (PaymentMethod.cash, Icons.payments_outlined, AppColors.cashColor),
    (PaymentMethod.card, Icons.credit_card_outlined, AppColors.cardColor),
    (PaymentMethod.kpay, Icons.phone_android_outlined, AppColors.mobilePayColor),
    (PaymentMethod.wavepay, Icons.waves_outlined, AppColors.mobilePayColor),
    (PaymentMethod.ayaPay, Icons.account_balance_wallet_outlined, AppColors.mobilePayColor),
    (PaymentMethod.cbPay, Icons.account_balance_wallet_outlined, AppColors.mobilePayColor),
    (PaymentMethod.bankTransfer, Icons.account_balance_outlined, AppColors.info),
    (PaymentMethod.storeCredit, Icons.loyalty_outlined, AppColors.secondary),
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _methods.map((m) {
        final isSelected = selected == m.$1;
        return GestureDetector(
          onTap: () => onSelect(m.$1),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected ? m.$3.withValues(alpha: 0.1) : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected ? m.$3 : AppColors.border,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(m.$2, size: 16, color: isSelected ? m.$3 : AppColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                  PaymentMethod.displayName(m.$1),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                    color: isSelected ? m.$3 : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _SplitPaymentEntry {
  final String method;
  final double amount;
  final String? reference;

  const _SplitPaymentEntry(
      {required this.method, required this.amount, this.reference});

  CheckoutPayment toCheckoutPayment() => CheckoutPayment(
        paymentMethod: method,
        amount: amount,
        referenceNumber: reference,
      );
}
