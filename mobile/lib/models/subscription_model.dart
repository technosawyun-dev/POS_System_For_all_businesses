class SubscriptionStatusModel {
  final String status;
  final String? planName;
  final DateTime? trialEndsAt;
  final DateTime? renewalDate;
  final int maxUsers;
  final int maxBranches;
  final int maxProducts;
  final int currentUsers;
  final int currentBranches;
  final int currentProducts;

  const SubscriptionStatusModel({
    required this.status,
    this.planName,
    this.trialEndsAt,
    this.renewalDate,
    required this.maxUsers,
    required this.maxBranches,
    required this.maxProducts,
    required this.currentUsers,
    required this.currentBranches,
    required this.currentProducts,
  });

  bool get isActive => status == 'ACTIVE';
  bool get isTrial => status == 'TRIAL';
  bool get isExpired => status == 'EXPIRED';
  bool get isSuspended => status == 'SUSPENDED';
  bool get hasAccess => isActive || isTrial;

  factory SubscriptionStatusModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionStatusModel(
      status: json['status'] as String? ?? 'EXPIRED',
      planName: json['plan_name'] as String?,
      trialEndsAt: json['trial_ends_at'] != null
          ? DateTime.parse(json['trial_ends_at'] as String)
          : null,
      renewalDate: json['renewal_date'] != null
          ? DateTime.parse(json['renewal_date'] as String)
          : null,
      maxUsers: json['max_users'] as int? ?? 0,
      maxBranches: json['max_branches'] as int? ?? 0,
      maxProducts: json['max_products'] as int? ?? 0,
      currentUsers: json['current_users'] as int? ?? 0,
      currentBranches: json['current_branches'] as int? ?? 0,
      currentProducts: json['current_products'] as int? ?? 0,
    );
  }
}

class SubscriptionPlanModel {
  final String id;
  final String name;
  final String? description;
  final double monthlyPrice;
  final int maxUsers;
  final int maxBranches;
  final int maxProducts;
  final bool isActive;
  final List<String> features;

  const SubscriptionPlanModel({
    required this.id,
    required this.name,
    this.description,
    required this.monthlyPrice,
    required this.maxUsers,
    required this.maxBranches,
    required this.maxProducts,
    required this.isActive,
    required this.features,
  });

  factory SubscriptionPlanModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlanModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      monthlyPrice: (json['monthly_price'] as num?)?.toDouble() ?? 0.0,
      maxUsers: json['max_users'] as int? ?? 0,
      maxBranches: json['max_branches'] as int? ?? 0,
      maxProducts: json['max_products'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      features: (json['features'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}
