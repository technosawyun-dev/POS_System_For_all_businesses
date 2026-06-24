class CartModel {
  final String id;
  final String branchId;
  final String? cashierSessionId;
  final String? customerId;
  final String? customerName;
  final List<CartItemModel> items;
  final String? notes;

  const CartModel({
    required this.id,
    required this.branchId,
    this.cashierSessionId,
    this.customerId,
    this.customerName,
    required this.items,
    this.notes,
  });

  double get subtotal =>
      items.fold(0, (sum, item) => sum + item.lineTotal);

  double get taxTotal =>
      items.fold(0, (sum, item) => sum + item.taxAmount);

  double get discountTotal =>
      items.fold(0, (sum, item) => sum + (item.discountAmount * item.quantity));

  double get total => subtotal + taxTotal - discountTotal;

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  factory CartModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return CartModel(
      id: json['id'] as String,
      branchId: json['branch_id'] as String,
      cashierSessionId: json['cashier_session_id'] as String?,
      customerId: json['customer_id'] as String?,
      customerName: json['customer_name'] as String?,
      items: rawItems
          .map((e) => CartItemModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      notes: json['notes'] as String?,
    );
  }
}

class CartItemModel {
  final String id;
  final String productId;
  final String productName;
  final String? variantId;
  final String? variantName;
  final int quantity;
  final double unitPrice;
  final double discountAmount;
  final double taxRate;
  final String? sku;
  final String? barcode;

  const CartItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    this.variantId,
    this.variantName,
    required this.quantity,
    required this.unitPrice,
    required this.discountAmount,
    required this.taxRate,
    this.sku,
    this.barcode,
  });

  double get lineSubtotal => unitPrice * quantity;
  double get taxAmount => lineSubtotal * (taxRate / 100);
  double get lineTotal => lineSubtotal + taxAmount;

  String get displayName =>
      variantName != null ? '$productName - $variantName' : productName;

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      id: json['id'] as String,
      productId: json['product_id'] as String,
      productName: json['product_name'] as String? ?? '',
      variantId: json['variant_id'] as String?,
      variantName: json['variant_name'] as String?,
      quantity: json['quantity'] as int? ?? 1,
      unitPrice: (json['unit_price'] as num?)?.toDouble() ?? 0.0,
      discountAmount:
          (json['discount_amount'] as num?)?.toDouble() ?? 0.0,
      taxRate: (json['tax_rate'] as num?)?.toDouble() ?? 0.0,
      sku: json['sku'] as String?,
      barcode: json['barcode'] as String?,
    );
  }

  CartItemModel copyWith({int? quantity, double? unitPrice, double? discountAmount}) {
    return CartItemModel(
      id: id,
      productId: productId,
      productName: productName,
      variantId: variantId,
      variantName: variantName,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      discountAmount: discountAmount ?? this.discountAmount,
      taxRate: taxRate,
      sku: sku,
      barcode: barcode,
    );
  }
}

// Local cart item before server sync
class LocalCartItem {
  final String productId;
  final String productName;
  final String? variantId;
  final String? variantName;
  int quantity;
  final double unitPrice;
  double discountAmount;
  final double taxRate;
  final String? sku;
  final String? barcode;

  LocalCartItem({
    required this.productId,
    required this.productName,
    this.variantId,
    this.variantName,
    required this.quantity,
    required this.unitPrice,
    required this.discountAmount,
    required this.taxRate,
    this.sku,
    this.barcode,
  });

  double get lineSubtotal => unitPrice * quantity;
  double get taxAmount => lineSubtotal * (taxRate / 100);
  double get lineTotal => lineSubtotal + taxAmount;

  String get displayName =>
      variantName != null ? '$productName - $variantName' : productName;

  String get key => variantId ?? productId;
}
