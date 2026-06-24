import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/reseller_wallet_model.dart';

class ResellerRepository {
  final _dio = apiClient.dio;

  Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await _dio.get(ApiEndpoints.resellerDashboard);
    return response.data as Map<String, dynamic>;
  }

  Future<ResellerWalletModel> getWallet() async {
    final response = await _dio.get(ApiEndpoints.resellerWallet);
    return ResellerWalletModel.fromJson(
        response.data as Map<String, dynamic>);
  }

  Future<({List<CommissionModel> items, int total})> listCommissions({
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
    };
    final response = await _dio.get(
        ApiEndpoints.resellerCommissions, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              CommissionModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<({List<ReferralModel> items, int total})> listReferrals({
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
    };
    final response = await _dio.get(
        ApiEndpoints.resellerReferrals, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              ReferralModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<void> requestPayout(double amount) async {
    await _dio.post(ApiEndpoints.resellerRequestPayout,
        data: {'amount': amount});
  }
}

final resellerRepositoryProvider =
    Provider((_) => ResellerRepository());
