import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/purchase_order_model.dart';

class ProcurementRepository {
  final _dio = apiClient.dio;

  Future<({List<PurchaseOrderModel> items, int total})>
      listPurchaseOrders({
    String? status,
    String? supplierId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (status != null) 'status': status,
      if (supplierId != null) 'supplier_id': supplierId,
    };
    final response = await _dio.get(
        ApiEndpoints.purchaseOrders, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              PurchaseOrderModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<PurchaseOrderModel> getPurchaseOrder(String id) async {
    final response =
        await _dio.get('${ApiEndpoints.purchaseOrders}/$id');
    return PurchaseOrderModel.fromJson(
        response.data as Map<String, dynamic>);
  }

  Future<PurchaseOrderModel> createPurchaseOrder(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.purchaseOrders, data: data);
    return PurchaseOrderModel.fromJson(
        response.data as Map<String, dynamic>);
  }

  Future<List<SupplierModel>> getSuppliers() async {
    final response = await _dio.get(ApiEndpoints.suppliers);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return rawItems
        .map((e) => SupplierModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final procurementRepositoryProvider =
    Provider((_) => ProcurementRepository());
