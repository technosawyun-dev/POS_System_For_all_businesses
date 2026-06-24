class DeviceModel {
  final String id;
  final String deviceIdentifier;
  final String? deviceName;
  final String platform;
  final String status;
  final DateTime? lastSeenAt;
  final DateTime registeredAt;
  final String? tenantId;
  final String? branchId;
  final String? appVersion;

  const DeviceModel({
    required this.id,
    required this.deviceIdentifier,
    this.deviceName,
    required this.platform,
    required this.status,
    this.lastSeenAt,
    required this.registeredAt,
    this.tenantId,
    this.branchId,
    this.appVersion,
  });

  bool get isActive => status == 'ACTIVE';

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    return DeviceModel(
      id: json['id'] as String,
      deviceIdentifier: json['device_identifier'] as String? ?? '',
      deviceName: json['device_name'] as String?,
      platform: json['platform'] as String? ?? 'ANDROID',
      status: json['status'] as String? ?? 'ACTIVE',
      lastSeenAt: json['last_seen_at'] != null
          ? DateTime.parse(json['last_seen_at'] as String)
          : null,
      registeredAt: DateTime.parse(
          json['registered_at'] as String? ?? json['created_at'] as String),
      tenantId: json['tenant_id'] as String?,
      branchId: json['branch_id'] as String?,
      appVersion: json['app_version'] as String?,
    );
  }
}
