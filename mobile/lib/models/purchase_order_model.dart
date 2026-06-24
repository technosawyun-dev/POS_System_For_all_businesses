class PurchaseOrderModel {
  final String id;
  final String orderNumber;
  final String supplierId;
  final String? supplierName;
  final String status;
  final double totalAmount;
  final DateTime orderDate;
  final DateTime? expectedDate;
  final String? notes;
  final List<PurchaseOrderItemModel> items;

  const PurchaseOrderModel({
    required this.id,
    required this.orderNumber,
    required this.supplierId,
    this.supplierName,
    required this.status,
    required this.totalAmount,
    required this.orderDate,
    this.expectedDate,
    this.notes,
    required this.items,
  });

  bool get isDraft => status == 'DRAFT';
  bool get isOrdered => status == 'ORDERED';
  bool get isReceived => status == 'RECEIVED';
  bool get isPartial => status == 'PARTIAL';
  bool get isCancelled => status == 'CANCELLED';

  factory PurchaseOrderModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return PurchaseOrderModel(
      id: json['id'] as String,
      orderNumber: json['order_number'] as String? ?? '',
      supplierId: json['supplier_id'] as String? ?? '',
      supplierName: json['supplier_name'] as String?,
      status: json['status'] as String? ?? 'DRAFT',
      totalAmount: (json['total_amount'] as num?)?.toDouble() ?? 0.0,
      orderDate: DateTime.parse(json['order_date'] as String),
      expectedDate: json['expected_date'] != null
          ? DateTime.parse(json['expected_date'] as String)
          : null,
      notes: json['notes'] as String?,
      items: rawItems
          .map((e) =>
              PurchaseOrderItemModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class PurchaseOrderItemModel {
  final String id;
  final String productId;
  final String productName;
  final int quantityOrdered;
  final int quantityReceived;
  final double unitCost;

  const PurchaseOrderItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantityOrdered,
    required this.quantityReceived,
    required this.unitCost,
  });

  double get lineTotal => quantityOrdered * unitCost;
  int get pendingQty => quantityOrdered - quantityReceived;

  factory PurchaseOrderItemModel.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderItemModel(
      id: json['id'] as String,
      productId: json['product_id'] as String? ?? '',
      productName: json['product_name'] as String? ?? '',
      quantityOrdered: json['quantity_ordered'] as int? ?? 0,
      quantityReceived: json['quantity_received'] as int? ?? 0,
      unitCost: (json['unit_cost'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class SupplierModel {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final bool isActive;

  const SupplierModel({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.address,
    required this.isActive,
  });

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    return SupplierModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      address: json['address'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
