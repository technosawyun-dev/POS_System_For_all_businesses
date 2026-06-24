class AppConstants {
  // API
  static const String baseUrl = 'http://10.0.2.2:8000';
  static const String apiPrefix = '/api/v1';
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Storage keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'user_data';
  static const String deviceIdKey = 'device_id';
  static const String baseUrlKey = 'base_url';

  // Pagination
  static const int defaultPageSize = 20;

  // POS
  static const int maxCartItems = 100;
  static const Duration syncInterval = Duration(minutes: 5);

  // App
  static const String appName = 'SawYun POS';
  static const String appVersion = '1.0.0';
  static const String platform = 'ANDROID';
}
