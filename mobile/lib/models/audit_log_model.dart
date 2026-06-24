class AuditLogModel {
  final String id;
  final String? userId;
  final String? userEmail;
  final String action;
  final String entityType;
  final String? entityId;
  final Map<String, dynamic>? changes;
  final String? ipAddress;
  final DateTime createdAt;

  const AuditLogModel({
    required this.id,
    this.userId,
    this.userEmail,
    required this.action,
    required this.entityType,
    this.entityId,
    this.changes,
    this.ipAddress,
    required this.createdAt,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    return AuditLogModel(
      id: json['id'] as String,
      userId: json['user_id'] as String?,
      userEmail: json['user_email'] as String?,
      action: json['action'] as String? ?? '',
      entityType: json['entity_type'] as String? ?? '',
      entityId: json['entity_id'] as String?,
      changes: json['changes'] as Map<String, dynamic>?,
      ipAddress: json['ip_address'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
