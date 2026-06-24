import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/user_model.dart';

class UsersRepository {
  final _dio = apiClient.dio;

  Future<({List<UserModel> items, int total})> listUsers({
    String? role,
    String? status,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (role != null) 'role': role,
      if (status != null) 'status': status,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    final response =
        await _dio.get(ApiEndpoints.users, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<UserModel> getUser(String id) async {
    final response = await _dio.get(ApiEndpoints.user(id));
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<UserModel> createUser(Map<String, dynamic> data) async {
    final response = await _dio.post(ApiEndpoints.users, data: data);
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<UserModel> updateUser(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put(ApiEndpoints.user(id), data: data);
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deactivateUser(String id) async {
    await _dio.put(ApiEndpoints.user(id), data: {'status': 'INACTIVE'});
  }
}

final usersRepositoryProvider = Provider((_) => UsersRepository());
