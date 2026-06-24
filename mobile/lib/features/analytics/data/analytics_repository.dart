import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/analytics_model.dart';

class AnalyticsRepository {
  final _dio = apiClient.dio;

  Future<DashboardKpiModel> getDashboard({
    String? branchId,
    String? period,
  }) async {
    final params = <String, dynamic>{
      if (branchId != null) 'branch_id': branchId,
      if (period != null) 'period': period,
    };
    final response = await _dio.get(
        ApiEndpoints.analyticsDashboard, queryParameters: params);
    return DashboardKpiModel.fromJson(
        response.data as Map<String, dynamic>);
  }

  Future<List<SalesSummaryPoint>> getSalesSummary({
    String? from,
    String? to,
    String groupBy = 'day',
    String? branchId,
  }) async {
    final params = <String, dynamic>{
      'group_by': groupBy,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await _dio.get(
        ApiEndpoints.analyticsSalesSummary, queryParameters: params);
    final raw = response.data as List<dynamic>? ?? [];
    return raw
        .map((e) =>
            SalesSummaryPoint.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<TopProductModel>> getTopProducts({
    String? from,
    String? to,
    int limit = 10,
    String? branchId,
  }) async {
    final params = <String, dynamic>{
      'limit': limit,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await _dio.get(
        ApiEndpoints.analyticsTopProducts, queryParameters: params);
    final raw = response.data as List<dynamic>? ?? [];
    return raw
        .map((e) =>
            TopProductModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final analyticsRepositoryProvider =
    Provider((_) => AnalyticsRepository());
