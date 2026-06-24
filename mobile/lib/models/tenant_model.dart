class TenantModel {
  final String id;
  final String businessName;
  final String? businessCode;
  final String status;
  final String? phone;
  final String? email;
  final String? address;
  final DateTime createdAt;
  final int? userCount;
  final int? branchCount;

  const TenantModel({
    required this.id,
    required this.businessName,
    this.businessCode,
    required this.status,
    this.phone,
    this.email,
    this.address,
    required this.createdAt,
    this.userCount,
    this.branchCount,
  });

  bool get isActive => status == 'ACTIVE';
  bool get isSuspended => status == 'SUSPENDED';

  factory TenantModel.fromJson(Map<String, dynamic> json) {
    return TenantModel(
      id: json['id'] as String,
      businessName: json['business_name'] as String? ?? '',
      businessCode: json['business_code'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      address: json['address'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      userCount: json['user_count'] as int?,
      branchCount: json['branch_count'] as int?,
    );
  }
}

class ResellerModel {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String status;
  final double commissionRate;
  final double walletBalance;
  final int clientCount;
  final DateTime createdAt;

  const ResellerModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.status,
    required this.commissionRate,
    required this.walletBalance,
    required this.clientCount,
    required this.createdAt,
  });

  factory ResellerModel.fromJson(Map<String, dynamic> json) {
    return ResellerModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      commissionRate:
          (json['commission_rate'] as num?)?.toDouble() ?? 0.0,
      walletBalance:
          (json['wallet_balance'] as num?)?.toDouble() ?? 0.0,
      clientCount: json['client_count'] as int? ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
