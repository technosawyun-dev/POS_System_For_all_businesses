import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/customer_model.dart';

class CustomersRepository {
  final _dio = apiClient.dio;

  Future<({List<CustomerModel> items, int total})> listCustomers({
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    final response =
        await _dio.get(ApiEndpoints.customers, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => CustomerModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<CustomerModel> getCustomer(String id) async {
    final response = await _dio.get(ApiEndpoints.customer(id));
    return CustomerModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CustomerModel> createCustomer(Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.customers, data: data);
    return CustomerModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CustomerModel> updateCustomer(
      String id, Map<String, dynamic> data) async {
    final response =
        await _dio.put(ApiEndpoints.customer(id), data: data);
    return CustomerModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<Map<String, dynamic>>> getLedger(String id) async {
    final response =
        await _dio.get(ApiEndpoints.customerLedger(id));
    final raw = response.data as List<dynamic>? ?? [];
    return raw.cast<Map<String, dynamic>>();
  }
}

final customersRepositoryProvider =
    Provider((_) => CustomersRepository());
