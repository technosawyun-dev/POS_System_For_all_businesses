import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/auth_models.dart';
import '../../../models/user_model.dart';

class AuthRepository {
  Future<Map<String, dynamic>> login(LoginRequest request) async {
    try {
      final response = await apiClient.post(
        ApiEndpoints.login,
        data: request.toJson(),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<UserModel> getMe() async {
    try {
      final response = await apiClient.get(ApiEndpoints.me);
      return UserModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<void> logout() async {
    try {
      await apiClient.post(ApiEndpoints.logout);
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  Future<void> changePassword(ChangePasswordRequest request) async {
    try {
      await apiClient.post(
        ApiEndpoints.changePassword,
        data: request.toJson(),
      );
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }
}
