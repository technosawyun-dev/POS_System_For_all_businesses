class ResellerWalletModel {
  final double balance;
  final double totalEarned;
  final double totalPaidOut;
  final List<WalletTransactionModel> transactions;

  const ResellerWalletModel({
    required this.balance,
    required this.totalEarned,
    required this.totalPaidOut,
    required this.transactions,
  });

  factory ResellerWalletModel.fromJson(Map<String, dynamic> json) {
    final rawTx = json['transactions'] as List<dynamic>? ?? [];
    return ResellerWalletModel(
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      totalEarned: (json['total_earned'] as num?)?.toDouble() ?? 0.0,
      totalPaidOut: (json['total_paid_out'] as num?)?.toDouble() ?? 0.0,
      transactions: rawTx
          .map((e) =>
              WalletTransactionModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class WalletTransactionModel {
  final String id;
  final String transactionType;
  final double amount;
  final String? description;
  final DateTime createdAt;

  const WalletTransactionModel({
    required this.id,
    required this.transactionType,
    required this.amount,
    this.description,
    required this.createdAt,
  });

  bool get isCredit => transactionType == 'CREDIT' || transactionType == 'COMMISSION';
  bool get isDebit => transactionType == 'DEBIT' || transactionType == 'PAYOUT';

  factory WalletTransactionModel.fromJson(Map<String, dynamic> json) {
    return WalletTransactionModel(
      id: json['id'] as String,
      transactionType: json['transaction_type'] as String? ?? 'CREDIT',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class CommissionModel {
  final String id;
  final String tenantName;
  final double amount;
  final String status;
  final DateTime earnedAt;

  const CommissionModel({
    required this.id,
    required this.tenantName,
    required this.amount,
    required this.status,
    required this.earnedAt,
  });

  factory CommissionModel.fromJson(Map<String, dynamic> json) {
    return CommissionModel(
      id: json['id'] as String,
      tenantName: json['tenant_name'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'PENDING',
      earnedAt: DateTime.parse(json['earned_at'] as String? ?? json['created_at'] as String),
    );
  }
}

class ReferralModel {
  final String id;
  final String businessName;
  final String status;
  final String subscriptionStatus;
  final DateTime joinedAt;
  final double totalCommissionsEarned;

  const ReferralModel({
    required this.id,
    required this.businessName,
    required this.status,
    required this.subscriptionStatus,
    required this.joinedAt,
    required this.totalCommissionsEarned,
  });

  factory ReferralModel.fromJson(Map<String, dynamic> json) {
    return ReferralModel(
      id: json['id'] as String,
      businessName: json['business_name'] as String? ?? '',
      status: json['status'] as String? ?? 'ACTIVE',
      subscriptionStatus: json['subscription_status'] as String? ?? 'ACTIVE',
      joinedAt: DateTime.parse(json['joined_at'] as String? ?? json['created_at'] as String),
      totalCommissionsEarned:
          (json['total_commissions_earned'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
