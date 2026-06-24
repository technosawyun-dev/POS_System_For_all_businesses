class CustomerModel {
  final String id;
  final String customerCode;
  final String name;
  final String? phone;
  final String? email;
  final double creditLimit;
  final double currentBalance;
  final bool isActive;

  const CustomerModel({
    required this.id,
    required this.customerCode,
    required this.name,
    this.phone,
    this.email,
    required this.creditLimit,
    required this.currentBalance,
    required this.isActive,
  });

  bool get hasCredit => creditLimit > 0;
  double get availableCredit => creditLimit - currentBalance;

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id'] as String,
      customerCode: json['customer_code'] as String? ?? '',
      name: json['name'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      creditLimit: (json['credit_limit'] as num?)?.toDouble() ?? 0.0,
      currentBalance:
          (json['current_balance'] as num?)?.toDouble() ?? 0.0,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
