import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/order_model.dart';

class OrdersRepository {
  final _dio = apiClient.dio;

  Future<({List<OrderModel> items, int total})> listOrders({
    String? status,
    String? search,
    String? branchId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (status != null) 'order_status': status,
      if (search != null && search.isNotEmpty) 'search': search,
      if (branchId != null) 'branch_id': branchId,
    };
    final response =
        await _dio.get(ApiEndpoints.orders, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => OrderModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<OrderModel> getOrder(String id) async {
    final response = await _dio.get(ApiEndpoints.order(id));
    return OrderModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> voidOrder(String id, {String? reason}) async {
    await _dio.post(ApiEndpoints.voidOrder(id), data: {'reason': reason});
  }
}

final ordersRepositoryProvider =
    Provider((_) => OrdersRepository());
