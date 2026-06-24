import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../models/notification_model.dart';

class NotificationsRepository {
  final _dio = apiClient.dio;

  Future<({List<NotificationModel> items, int total})> listNotifications({
    bool? unreadOnly,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'page_size': pageSize,
      if (unreadOnly == true) 'unread_only': true,
    };
    final response = await _dio.get(
        ApiEndpoints.notifications, queryParameters: params);
    final data = response.data as Map<String, dynamic>;
    final rawItems = data['items'] as List<dynamic>? ?? [];
    return (
      items: rawItems
          .map((e) =>
              NotificationModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: data['total'] as int? ?? 0,
    );
  }

  Future<int> getUnreadCount() async {
    final response = await _dio.get(ApiEndpoints.notificationUnreadCount);
    final data = response.data as Map<String, dynamic>;
    return data['count'] as int? ?? 0;
  }

  Future<void> markRead(String id) async {
    await _dio.post(ApiEndpoints.markNotificationRead(id));
  }

  Future<void> markAllRead() async {
    await _dio.post(ApiEndpoints.markAllRead);
  }
}

final notificationsRepositoryProvider =
    Provider((_) => NotificationsRepository());
