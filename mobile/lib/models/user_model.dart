class UserModel {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? phone;
  final String role;
  final String status;
  final String? tenantId;
  final String? primaryBranchId;
  final String? avatarUrl;

  const UserModel({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.phone,
    required this.role,
    required this.status,
    this.tenantId,
    this.primaryBranchId,
    this.avatarUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  bool get isSuperAdmin => role == UserRole.superAdmin;
  bool get isReseller => role == UserRole.reseller;
  bool get isBusinessOwner => role == UserRole.businessOwner;
  bool get isManager => role == UserRole.manager;
  bool get isCashier => role == UserRole.cashier;
  bool get isInventoryStaff => role == UserRole.inventoryStaff;

  bool get isTenantAdmin =>
      role == UserRole.businessOwner || role == UserRole.manager;

  bool get canAccessAnalytics =>
      isSuperAdmin || isReseller || isBusinessOwner || isManager;

  bool get canAccessProcurement =>
      isSuperAdmin || isBusinessOwner || isManager;

  bool get canManageProducts =>
      isSuperAdmin || isBusinessOwner || isManager || isInventoryStaff;

  bool get canVoidOrders => isSuperAdmin || isBusinessOwner || isManager;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      tenantId: json['tenant_id'] as String?,
      primaryBranchId: json['primary_branch_id'] as String?,
      avatarUrl: json['avatar_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'first_name': firstName,
        'last_name': lastName,
        'phone': phone,
        'role': role,
        'status': status,
        'tenant_id': tenantId,
        'primary_branch_id': primaryBranchId,
        'avatar_url': avatarUrl,
      };

  UserModel copyWith({
    String? id,
    String? email,
    String? firstName,
    String? lastName,
    String? phone,
    String? role,
    String? status,
    String? tenantId,
    String? primaryBranchId,
    String? avatarUrl,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      status: status ?? this.status,
      tenantId: tenantId ?? this.tenantId,
      primaryBranchId: primaryBranchId ?? this.primaryBranchId,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }
}

class UserRole {
  static const String superAdmin = 'SUPER_ADMIN';
  static const String reseller = 'RESELLER';
  static const String businessOwner = 'BUSINESS_OWNER';
  static const String manager = 'MANAGER';
  static const String cashier = 'CASHIER';
  static const String inventoryStaff = 'INVENTORY_STAFF';

  static String displayName(String role) {
    switch (role) {
      case superAdmin: return 'Super Admin';
      case reseller: return 'Reseller';
      case businessOwner: return 'Business Owner';
      case manager: return 'Manager';
      case cashier: return 'Cashier';
      case inventoryStaff: return 'Inventory Staff';
      default: return role;
    }
  }
}
