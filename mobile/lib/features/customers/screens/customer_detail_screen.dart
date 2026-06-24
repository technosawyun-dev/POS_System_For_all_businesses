import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/customers_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/responsive.dart';
import 'customer_form_screen.dart';
import 'customer_ledger_screen.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/info_row.dart';
import '../../../models/customer_model.dart';
import '../../../models/user_model.dart';
import '../../../core/providers/auth_provider.dart';

final _customerDetailProvider =
    FutureProvider.family<CustomerModel, String>((ref, id) async {
  final repo = ref.watch(customersRepositoryProvider);
  return repo.getCustomer(id);
});

class CustomerDetailScreen extends ConsumerWidget {
  final String customerId;
  const CustomerDetailScreen({super.key, required this.customerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customerAsync = ref.watch(_customerDetailProvider(customerId));
    final user = ref.watch(currentUserProvider);
    final canEdit =
        user?.role != UserRole.cashier && user?.role != UserRole.inventoryStaff;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Details'),
        actions: [
          customerAsync.whenOrNull(
            data: (c) => IconButton(
              icon: const Icon(Icons.receipt_long_outlined),
              tooltip: 'Ledger',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => CustomerLedgerScreen(
                    customerId: c.id, customerName: c.name),
              )),
            ),
          ) ?? const SizedBox(),
          if (canEdit)
            customerAsync.whenOrNull(
              data: (c) => IconButton(
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CustomerFormScreen(customer: c),
                    fullscreenDialog: true,
                  ),
                ),
              ),
            ) ?? const SizedBox(),
        ],
      ),
      body: customerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(_customerDetailProvider(customerId)),
        ),
        data: (customer) => ContentWrapper(
          maxWidth: 720,
          child: SingleChildScrollView(
          child: Column(
            children: [
              _CustomerHeader(customer: customer),
              InfoSection(
                title: 'CONTACT',
                children: [
                  if (customer.phone != null)
                    InfoRow(label: 'Phone', value: customer.phone!),
                  if (customer.email != null)
                    InfoRow(label: 'Email', value: customer.email!),
                  InfoRow(label: 'Code', value: customer.customerCode),
                  InfoRow(
                    label: 'Status',
                    value: customer.isActive ? 'Active' : 'Inactive',
                    valueColor: customer.isActive ? AppColors.success : AppColors.error,
                  ),
                ],
              ),
              if (customer.creditLimit > 0)
                InfoSection(
                  title: 'CREDIT',
                  children: [
                    InfoRow(
                        label: 'Credit Limit',
                        value: CurrencyFormatter.format(customer.creditLimit)),
                    InfoRow(
                        label: 'Balance',
                        value: CurrencyFormatter.format(customer.currentBalance),
                        valueColor: customer.currentBalance > 0
                            ? AppColors.error
                            : AppColors.success),
                    InfoRow(
                        label: 'Available',
                        value: CurrencyFormatter.format(customer.availableCredit),
                        valueColor: AppColors.success),
                  ],
                ),
            ],
          ),
          ),
        ),
      ),
    );
  }
}

class _CustomerHeader extends StatelessWidget {
  final CustomerModel customer;
  const _CustomerHeader({required this.customer});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      color: AppColors.primary,
      child: Column(
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: Colors.white.withValues(alpha: 0.2),
            child: Text(
              customer.name.isNotEmpty ? customer.name[0].toUpperCase() : '?',
              style: const TextStyle(
                  color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            customer.name,
            style: const TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
          ),
          if (customer.phone != null)
            Text(customer.phone!,
                style: const TextStyle(color: Colors.white70, fontSize: 14)),
        ],
      ),
    );
  }
}
