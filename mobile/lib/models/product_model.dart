class ProductModel {
  final String id;
  final String name;
  final String? sku;
  final String? barcode;
  final String? qrCode;
  final double sellingPrice;
  final double costPrice;
  final double taxRate;
  final String productType;
  final bool isActive;
  final String? categoryId;
  final String? categoryName;
  final String? brandId;
  final String? brandName;
  final String? imageUrl;
  final String? description;
  final String? unit;
  final List<ProductVariantModel> variants;
  // Stock from inventory (injected when fetching products for POS)
  final double? quantityOnHand;

  const ProductModel({
    required this.id,
    required this.name,
    this.sku,
    this.barcode,
    this.qrCode,
    required this.sellingPrice,
    required this.costPrice,
    required this.taxRate,
    required this.productType,
    required this.isActive,
    this.categoryId,
    this.categoryName,
    this.brandId,
    this.brandName,
    this.imageUrl,
    this.description,
    this.unit,
    this.variants = const [],
    this.quantityOnHand,
  });

  bool get isVariable => productType == 'VARIABLE';
  bool get isSimple => productType == 'SIMPLE';
  bool get hasVariants => variants.isNotEmpty;

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final variantsList = json['variants'] as List<dynamic>? ?? [];
    return ProductModel(
      id: json['id'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String?,
      barcode: json['barcode'] as String?,
      qrCode: json['qr_code'] as String?,
      sellingPrice:
          (json['selling_price'] as num?)?.toDouble() ?? 0.0,
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0.0,
      taxRate: (json['tax_rate'] as num?)?.toDouble() ?? 0.0,
      productType: json['product_type'] as String? ?? 'SIMPLE',
      isActive: json['is_active'] as bool? ?? true,
      categoryId: json['category_id'] as String?,
      categoryName: json['category_name'] as String?,
      brandId: json['brand_id'] as String?,
      brandName: json['brand_name'] as String?,
      imageUrl: json['image_url'] as String?,
      description: json['description'] as String?,
      unit: json['unit'] as String?,
      variants: variantsList
          .map((v) =>
              ProductVariantModel.fromJson(v as Map<String, dynamic>))
          .toList(),
      quantityOnHand:
          (json['quantity_on_hand'] as num?)?.toDouble(),
    );
  }
}

class ProductVariantModel {
  final String id;
  final String productId;
  final String name;
  final String? sku;
  final String? barcode;
  final double sellingPrice;
  final double costPrice;
  final String? attr1Name;
  final String? attr1Value;
  final String? attr2Name;
  final String? attr2Value;
  final bool isActive;
  final double? quantityOnHand;

  const ProductVariantModel({
    required this.id,
    required this.productId,
    required this.name,
    this.sku,
    this.barcode,
    required this.sellingPrice,
    required this.costPrice,
    this.attr1Name,
    this.attr1Value,
    this.attr2Name,
    this.attr2Value,
    required this.isActive,
    this.quantityOnHand,
  });

  factory ProductVariantModel.fromJson(Map<String, dynamic> json) {
    return ProductVariantModel(
      id: json['id'] as String,
      productId: json['product_id'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String?,
      barcode: json['barcode'] as String?,
      sellingPrice:
          (json['selling_price'] as num?)?.toDouble() ?? 0.0,
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0.0,
      attr1Name: json['attr1_name'] as String?,
      attr1Value: json['attr1_value'] as String?,
      attr2Name: json['attr2_name'] as String?,
      attr2Value: json['attr2_value'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      quantityOnHand:
          (json['quantity_on_hand'] as num?)?.toDouble(),
    );
  }
}
