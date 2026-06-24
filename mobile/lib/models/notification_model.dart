class NotificationModel {
  final String id;
  final String title;
  final String message;
  final String notificationType;
  final bool isRead;
  final String? actionUrl;
  final DateTime createdAt;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.message,
    required this.notificationType,
    required this.isRead,
    this.actionUrl,
    required this.createdAt,
  });

  bool get isUnread => !isRead;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      notificationType: json['notification_type'] as String? ?? 'INFO',
      isRead: json['is_read'] as bool? ?? false,
      actionUrl: json['action_url'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  NotificationModel copyWith({bool? isRead}) => NotificationModel(
        id: id,
        title: title,
        message: message,
        notificationType: notificationType,
        isRead: isRead ?? this.isRead,
        actionUrl: actionUrl,
        createdAt: createdAt,
      );
}

class NotificationType {
  static const String info = 'INFO';
  static const String warning = 'WARNING';
  static const String success = 'SUCCESS';
  static const String error = 'ERROR';
  static const String order = 'ORDER';
  static const String payment = 'PAYMENT';
  static const String inventory = 'INVENTORY';
  static const String system = 'SYSTEM';
}
