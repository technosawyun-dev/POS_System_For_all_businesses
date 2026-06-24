class CashierSessionModel {
  final String id;
  final String branchId;
  final String cashierUserId;
  final String status;
  final DateTime openedAt;
  final DateTime? closedAt;
  final double openingBalance;
  final double? closingBalance;
  final double? variance;

  const CashierSessionModel({
    required this.id,
    required this.branchId,
    required this.cashierUserId,
    required this.status,
    required this.openedAt,
    this.closedAt,
    required this.openingBalance,
    this.closingBalance,
    this.variance,
  });

  bool get isOpen => status == SessionStatus.open;
  bool get isClosed => status == SessionStatus.closed;
  bool get isReconciled => status == SessionStatus.reconciled;

  factory CashierSessionModel.fromJson(Map<String, dynamic> json) {
    return CashierSessionModel(
      id: json['id'] as String,
      branchId: json['branch_id'] as String,
      cashierUserId: json['cashier_user_id'] as String,
      status: json['status'] as String,
      openedAt: DateTime.parse(json['opened_at'] as String),
      closedAt: json['closed_at'] != null
          ? DateTime.parse(json['closed_at'] as String)
          : null,
      openingBalance:
          (json['opening_balance'] as num?)?.toDouble() ?? 0.0,
      closingBalance:
          (json['closing_balance'] as num?)?.toDouble(),
      variance: (json['variance'] as num?)?.toDouble(),
    );
  }
}

class SessionStatus {
  static const String open = 'OPEN';
  static const String closed = 'CLOSED';
  static const String reconciled = 'RECONCILED';
}
