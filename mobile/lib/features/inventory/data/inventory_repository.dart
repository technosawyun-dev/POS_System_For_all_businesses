import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

class StockLevelModel {
  final String productId;
  final String productName;
  final String? sku;
  final double quantityOnHand;
  final double? reorderPoint;
  final String? branchId;
  final String? branchName;

  const StockLevelModel({
    required this.productId,
    required this.productName,
    this.sku,
    required this.quantityOnHand,
    this.reorderPoint,
    this.branchId,
    this.branchName,
  });

  bool get isLowStock =>
      reorderPoint != null && quantityOnHand <= reorderPoint!;

  factory StockLevelModel.fromJson(Map<String, dynamic> json) {
    return StockLevelModel(
      productId: json['product_id'] as String? ?? '',
      productName: json['product_name'] as String? ?? '',
      sku: json['sku'] as String?,
      quantityOnHand:
          (json['quantity_on_hand'] as num?)?.toDouble() ?? 0.0,
      reorderPoint:
          (json['reorder_point'] as num?)?.toDouble(),
      branchId: json['branch_id'] as String?,
      branchName: json['branch_name'] as String?,
    );
  }
}

class StockMovementModel {
  final String id;
  final String productName;
  final String movementType;
  final double quantity;
  final String? reference;
  final DateTime createdAt;

  const StockMovementModel({
    required this.id,
    required this.productName,
    required this.movementType,
    required this.quantity,
    this.reference,
    required this.createdAt,
  });

  factory StockMovementModel.fromJson(Map<String, dynamic> json) {
    return StockMovementModel(
      id: json['id'] as String,
      productName: json['product_name'] as String? ?? '',
      movementType: json['movement_type'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0.0,
      reference: json['reference'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class InventoryRepository {
  final _dio = apiClient.dio;

  Future<({List<StockLevelModel> items, int total})> getStockLevels({
    String? branchId,
    String? search,
    bool? lowStockOnly,
    int page = 1,
    int pageSize = 50,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (branchId != null) 'branch_id': branchId,
      if (search != null && search.isNotEmpty) 'search': search,
      if (lowStockOnly == true) 'low_stock_only': true,
    };
    final response = await _dio.get(
        ApiEndpoints.stockLevels, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              StockLevelModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? rawItems.length,
    );
  }

  Future<void> adjustStock({
    required String productId,
    required String branchId,
    required double adjustment,
    required String reason,
  }) async {
    await _dio.post(ApiEndpoints.inventoryAdjustments, data: {
      'product_id': productId,
      'branch_id': branchId,
      'adjustment': adjustment,
      'reason': reason,
    });
  }

  Future<List<StockMovementModel>> getMovements({
    String? productId,
    int page = 1,
    int pageSize = 30,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (productId != null) 'product_id': productId,
    };
    final response = await _dio.get(
        ApiEndpoints.stockMovements, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final raw = data['items'] as List<dynamic>? ?? [];
    return raw
        .map((e) =>
            StockMovementModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final inventoryRepositoryProvider =
    Provider((_) => InventoryRepository());
