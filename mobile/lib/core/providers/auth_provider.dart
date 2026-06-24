import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../models/user_model.dart';
import '../../models/auth_models.dart';
import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../storage/secure_storage.dart';

// The single source of truth for authentication state
class AuthState {
  final UserModel? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    UserModel? user,
    bool clearUser = false,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorage _storage;

  AuthNotifier(this._storage) : super(const AuthState());

  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);
    try {
      final userJson = await _storage.getUserJson();
      final token = await _storage.getAccessToken();
      if (userJson != null && token != null) {
        final user = UserModel.fromJson(jsonDecode(userJson));
        state = AuthState(user: user);
        // Silently refresh user data in background
        _refreshUserData();
      } else {
        state = const AuthState();
      }
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(LoginRequest request) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await apiClient.post(
        ApiEndpoints.login,
        data: request.toJson(),
      );

      final data = response.data as Map<String, dynamic>;
      final accessToken = data['access_token'] as String;
      await _storage.saveAccessToken(accessToken);

      // Fetch user profile
      final userResponse = await apiClient.get(ApiEndpoints.me);
      final user = UserModel.fromJson(
          userResponse.data as Map<String, dynamic>);
      await _storage.saveUserJson(jsonEncode(user.toJson()));

      state = AuthState(user: user);
      return true;
    } on DioException catch (e) {
      final ex = AppException.fromDio(e);
      state = state.copyWith(isLoading: false, error: ex.message);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await apiClient.post(ApiEndpoints.logout);
    } catch (_) {}
    await _storage.clearAll();
    state = const AuthState();
  }

  Future<void> _refreshUserData() async {
    try {
      final userResponse = await apiClient.get(ApiEndpoints.me);
      final user =
          UserModel.fromJson(userResponse.data as Map<String, dynamic>);
      await _storage.saveUserJson(jsonEncode(user.toJson()));
      state = AuthState(user: user);
    } catch (_) {
      // Silently fail — user stays logged in with cached data
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

// Providers
final secureStorageProvider = Provider((ref) => SecureStorage());

final authProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return AuthNotifier(storage);
});

final currentUserProvider = Provider<UserModel?>((ref) {
  return ref.watch(authProvider).user;
});
