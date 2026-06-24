import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/product_model.dart';
import '../../../models/category_model.dart';

class ProductsRepository {
  final _dio = apiClient.dio;

  Future<({List<ProductModel> items, int total})> listProducts({
    String? search,
    String? categoryId,
    bool? isActive,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'category_id': categoryId,
      if (isActive != null) 'is_active': isActive,
    };
    final response =
        await _dio.get(ApiEndpoints.products, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => ProductModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<ProductModel> getProduct(String id) async {
    final response = await _dio.get(ApiEndpoints.product(id));
    return ProductModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ProductModel> createProduct(Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.products, data: data);
    return ProductModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ProductModel> updateProduct(
      String id, Map<String, dynamic> data) async {
    final response =
        await _dio.put(ApiEndpoints.product(id), data: data);
    return ProductModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<CategoryModel>> getCategories() async {
    final response = await _dio.get(ApiEndpoints.categories);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? (response.data as List<dynamic>? ?? []);
    return rawItems
        .map((e) => CategoryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final productsRepositoryProvider =
    Provider((_) => ProductsRepository());
