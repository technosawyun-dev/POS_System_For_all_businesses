class OrderModel {
  final String id;
  final String orderNumber;
  final String branchId;
  final String? cashierSessionId;
  final String? customerId;
  final String? customerName;
  final String orderStatus;
  final String paymentStatus;
  final double grossTotal;
  final double taxTotal;
  final double discountTotal;
  final double netTotal;
  final String? notes;
  final DateTime createdAt;
  final DateTime? completedAt;
  final List<OrderItemModel> items;
  final List<PaymentModel> payments;

  const OrderModel({
    required this.id,
    required this.orderNumber,
    required this.branchId,
    this.cashierSessionId,
    this.customerId,
    this.customerName,
    required this.orderStatus,
    required this.paymentStatus,
    required this.grossTotal,
    required this.taxTotal,
    required this.discountTotal,
    required this.netTotal,
    this.notes,
    required this.createdAt,
    this.completedAt,
    required this.items,
    required this.payments,
  });

  bool get isCompleted => orderStatus == 'COMPLETED';
  bool get isVoided => orderStatus == 'VOIDED';
  bool get isPaid => paymentStatus == 'PAID';

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final rawPayments = json['payments'] as List<dynamic>? ?? [];
    return OrderModel(
      id: json['id'] as String,
      orderNumber: json['order_number'] as String,
      branchId: json['branch_id'] as String,
      cashierSessionId: json['cashier_session_id'] as String?,
      customerId: json['customer_id'] as String?,
      customerName: json['customer_name'] as String?,
      orderStatus: json['order_status'] as String? ?? 'COMPLETED',
      paymentStatus: json['payment_status'] as String? ?? 'PAID',
      grossTotal: (json['gross_total'] as num?)?.toDouble() ?? 0.0,
      taxTotal: (json['tax_total'] as num?)?.toDouble() ?? 0.0,
      discountTotal:
          (json['discount_total'] as num?)?.toDouble() ?? 0.0,
      netTotal: (json['net_total'] as num?)?.toDouble() ?? 0.0,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      items: rawItems
          .map((e) => OrderItemModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      payments: rawPayments
          .map((e) => PaymentModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class OrderItemModel {
  final String id;
  final String productId;
  final String productName;
  final String? variantId;
  final String? variantName;
  final int quantityOrdered;
  final double unitPrice;
  final double discountAmount;
  final double taxRate;

  const OrderItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    this.variantId,
    this.variantName,
    required this.quantityOrdered,
    required this.unitPrice,
    required this.discountAmount,
    required this.taxRate,
  });

  double get lineTotal =>
      (unitPrice * quantityOrdered) * (1 + taxRate / 100) -
      (discountAmount * quantityOrdered);

  String get displayName =>
      variantName != null ? '$productName - $variantName' : productName;

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    return OrderItemModel(
      id: json['id'] as String,
      productId: json['product_id'] as String,
      productName: json['product_name'] as String? ?? '',
      variantId: json['variant_id'] as String?,
      variantName: json['variant_name'] as String?,
      quantityOrdered: json['quantity_ordered'] as int? ?? 1,
      unitPrice: (json['unit_price'] as num?)?.toDouble() ?? 0.0,
      discountAmount:
          (json['discount_amount'] as num?)?.toDouble() ?? 0.0,
      taxRate: (json['tax_rate'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class PaymentModel {
  final String id;
  final String orderId;
  final String paymentMethod;
  final double amount;
  final String paymentStatus;
  final String? referenceNumber;
  final DateTime? paidAt;

  const PaymentModel({
    required this.id,
    required this.orderId,
    required this.paymentMethod,
    required this.amount,
    required this.paymentStatus,
    this.referenceNumber,
    this.paidAt,
  });

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    return PaymentModel(
      id: json['id'] as String,
      orderId: json['order_id'] as String,
      paymentMethod: json['payment_method'] as String,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      paymentStatus: json['payment_status'] as String? ?? 'COMPLETED',
      referenceNumber: json['reference_number'] as String?,
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'] as String)
          : null,
    );
  }
}

class PaymentMethod {
  static const String cash = 'CASH';
  static const String card = 'CARD';
  static const String kpay = 'KPAY';
  static const String wavepay = 'WAVEPAY';
  static const String ayaPay = 'AYA_PAY';
  static const String cbPay = 'CB_PAY';
  static const String bankTransfer = 'BANK_TRANSFER';
  static const String mobilePayment = 'MOBILE_PAYMENT';
  static const String storeCredit = 'STORE_CREDIT';

  static const List<String> all = [
    cash, card, kpay, wavepay, ayaPay, cbPay, bankTransfer, mobilePayment, storeCredit,
  ];

  static String displayName(String method) {
    switch (method) {
      case cash: return 'Cash';
      case card: return 'Card';
      case kpay: return 'KPay';
      case wavepay: return 'Wave Pay';
      case ayaPay: return 'AYA Pay';
      case cbPay: return 'CB Pay';
      case bankTransfer: return 'Bank Transfer';
      case mobilePayment: return 'Mobile Payment';
      case storeCredit: return 'Store Credit';
      default: return method;
    }
  }
}
