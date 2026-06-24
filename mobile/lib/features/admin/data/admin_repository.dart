import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/tenant_model.dart';
import '../../../models/user_model.dart';
import '../../../models/device_model.dart';
import '../../../models/audit_log_model.dart';
import '../../../models/subscription_model.dart';

class AdminRepository {
  final _dio = apiClient.dio;

  // Tenants
  Future<({List<TenantModel> items, int total})> listTenants({
    String? status,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (status != null) 'status': status,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    final response =
        await _dio.get(ApiEndpoints.tenants, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => TenantModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  // All Users
  Future<({List<UserModel> items, int total})> listAllUsers({
    String? role,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (role != null) 'role': role,
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

  // Resellers
  Future<({List<ResellerModel> items, int total})> listResellers({
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    final response = await _dio.get(
        ApiEndpoints.resellers, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              ResellerModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  // Subscription Plans
  Future<List<SubscriptionPlanModel>> listPlans() async {
    final response = await _dio.get(ApiEndpoints.subscriptionPlans);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return rawItems
        .map((e) =>
            SubscriptionPlanModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // Subscriptions
  Future<({List<Map<String, dynamic>> items, int total})>
      listSubscriptions({
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (status != null) 'status': status,
    };
    final response = await _dio.get(
        ApiEndpoints.adminSubscriptions, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems.cast<Map<String, dynamic>>(),
      total: data['total'] as int? ?? 0,
    );
  }

  // Devices
  Future<({List<DeviceModel> items, int total})> listDevices({
    String? tenantId,
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (tenantId != null) 'tenant_id': tenantId,
      if (status != null) 'status': status,
    };
    final response =
        await _dio.get(ApiEndpoints.devices, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) => DeviceModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  // Audit Logs
  Future<({List<AuditLogModel> items, int total})> listAuditLogs({
    String? entityType,
    String? action,
    int page = 1,
    int pageSize = 30,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (entityType != null) 'entity_type': entityType,
      if (action != null) 'action': action,
    };
    final response = await _dio.get(
        ApiEndpoints.auditLogs, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              AuditLogModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }
}

final adminRepositoryProvider = Provider((_) => AdminRepository());
