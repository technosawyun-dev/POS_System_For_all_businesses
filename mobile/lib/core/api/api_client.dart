import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';
import 'api_endpoints.dart';

class ApiClient {
  static ApiClient? _instance;
  late Dio _dio;
  final SecureStorage _secureStorage = SecureStorage();

  // Prevent concurrent refresh calls
  bool _isRefreshing = false;
  final List<Function> _pendingRequests = [];

  ApiClient._internal();

  static ApiClient get instance {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  Future<void> initialize() async {
    final baseUrl = await _secureStorage.getBaseUrl();
    _dio = Dio(BaseOptions(
      baseUrl: '$baseUrl${AppConstants.apiPrefix}',
      connectTimeout: AppConstants.connectTimeout,
      receiveTimeout: AppConstants.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  Future<void> updateBaseUrl(String url) async {
    await _secureStorage.saveBaseUrl(url);
    _dio.options.baseUrl = '$url${AppConstants.apiPrefix}';
  }

  void _onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _secureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  void _onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      if (_isRefreshing) {
        // Queue request until refresh completes
        _pendingRequests.add(() async {
          final token = await _secureStorage.getAccessToken();
          err.requestOptions.headers['Authorization'] = 'Bearer $token';
          try {
            final response = await _dio.fetch(err.requestOptions);
            handler.resolve(response);
          } catch (e) {
            handler.reject(err);
          }
        });
        return;
      }

      _isRefreshing = true;
      try {
        final refreshToken = await _secureStorage.getRefreshToken();
        if (refreshToken == null) throw Exception('No refresh token');

        final refreshDio = Dio(BaseOptions(
          baseUrl: _dio.options.baseUrl,
          connectTimeout: AppConstants.connectTimeout,
          receiveTimeout: AppConstants.receiveTimeout,
        ));

        final response = await refreshDio.post(
          ApiEndpoints.refresh,
          options: Options(headers: {
            'Cookie': 'refresh_token=$refreshToken',
          }),
        );

        final newAccessToken = response.data['access_token'] as String;
        await _secureStorage.saveAccessToken(newAccessToken);

        // Retry original request
        err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
        final retryResponse = await _dio.fetch(err.requestOptions);

        // Drain pending queue
        for (final pending in _pendingRequests) {
          pending();
        }
        _pendingRequests.clear();

        handler.resolve(retryResponse);
      } catch (_) {
        // Refresh failed — force logout
        await _secureStorage.clearAll();
        _pendingRequests.clear();
        handler.reject(err);
      } finally {
        _isRefreshing = false;
      }
      return;
    }
    handler.next(err);
  }

  Dio get dio => _dio;

  // Convenience wrappers
  Future<Response> get(String path,
      {Map<String, dynamic>? params, Options? options}) {
    return _dio.get(path,
        queryParameters: params, options: options);
  }

  Future<Response> post(String path,
      {dynamic data, Map<String, dynamic>? params, Options? options}) {
    return _dio.post(path,
        data: data, queryParameters: params, options: options);
  }

  Future<Response> patch(String path,
      {dynamic data, Options? options}) {
    return _dio.patch(path, data: data, options: options);
  }

  Future<Response> delete(String path, {Options? options}) {
    return _dio.delete(path, options: options);
  }
}

// Global singleton shorthand
final apiClient = ApiClient.instance;

class AppException implements Exception {
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? details;

  AppException(this.message, {this.statusCode, this.details});

  factory AppException.fromDio(DioException e) {
    final statusCode = e.response?.statusCode;
    final data = e.response?.data;
    String message;

    if (data is Map && data.containsKey('detail')) {
      final detail = data['detail'];
      if (detail is String) {
        message = detail;
      } else if (detail is List && detail.isNotEmpty) {
        message = detail.first['msg']?.toString() ?? 'Validation error';
      } else {
        message = detail.toString();
      }
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      message = 'Connection timed out. Check your network.';
    } else if (e.type == DioExceptionType.connectionError) {
      message = 'Cannot reach server. Check your connection.';
    } else {
      message = 'An error occurred (${statusCode ?? 'unknown'})';
    }

    return AppException(message,
        statusCode: statusCode,
        details: data is Map<String, dynamic> ? data : null);
  }

  @override
  String toString() => message;
}
