import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/cashier_session_model.dart';
import '../../../models/pagination_model.dart';

class SessionRepository {
  Future<CashierSessionModel> openSession({
    required String branchId,
    required double openingBalance,
  }) async {
    try {
      final response = await apiClient.post(
        ApiEndpoints.cashierSessions,
        data: {
          'branch_id': branchId,
          'opening_balance': openingBalance,
        },
      );
      return CashierSessionModel.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<CashierSessionModel> closeSession({
    required String sessionId,
    required double closingBalance,
    String? notes,
  }) async {
    try {
      final response = await apiClient.post(
        ApiEndpoints.closeSession(sessionId),
        data: {
          'closing_balance': closingBalance,
          if (notes != null) 'notes': notes,
        },
      );
      return CashierSessionModel.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<CashierSessionModel> getSession(String sessionId) async {
    try {
      final response =
          await apiClient.get(ApiEndpoints.cashierSession(sessionId));
      return CashierSessionModel.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<PaginatedResponse<CashierSessionModel>> listSessions({
    String? branchId,
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final response = await apiClient.get(
        ApiEndpoints.cashierSessions,
        params: {
          if (branchId != null) 'branch_id': branchId,
          if (status != null) 'status': status,
          'page': page,
          'page_size': pageSize,
        },
      );
      return PaginatedResponse.fromJson(
        response.data as Map<String, dynamic>,
        CashierSessionModel.fromJson,
      );
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  // Find currently open session for this cashier
  Future<CashierSessionModel?> getOpenSession({String? branchId}) async {
    try {
      final response = await listSessions(
        branchId: branchId,
        status: SessionStatus.open,
        pageSize: 5,
      );
      if (response.items.isNotEmpty) return response.items.first;
      return null;
    } catch (_) {
      return null;
    }
  }
}
