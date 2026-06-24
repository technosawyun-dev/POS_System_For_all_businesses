class DashboardKpiModel {
  final double totalRevenue;
  final int totalOrders;
  final double averageOrderValue;
  final int totalCustomers;
  final double? revenueGrowth;
  final double? orderGrowth;

  const DashboardKpiModel({
    required this.totalRevenue,
    required this.totalOrders,
    required this.averageOrderValue,
    required this.totalCustomers,
    this.revenueGrowth,
    this.orderGrowth,
  });

  factory DashboardKpiModel.fromJson(Map<String, dynamic> json) {
    return DashboardKpiModel(
      totalRevenue: (json['total_revenue'] as num?)?.toDouble() ?? 0.0,
      totalOrders: json['total_orders'] as int? ?? 0,
      averageOrderValue:
          (json['average_order_value'] as num?)?.toDouble() ?? 0.0,
      totalCustomers: json['total_customers'] as int? ?? 0,
      revenueGrowth:
          (json['revenue_growth'] as num?)?.toDouble(),
      orderGrowth: (json['order_growth'] as num?)?.toDouble(),
    );
  }
}

class SalesSummaryPoint {
  final DateTime date;
  final double revenue;
  final int orders;

  const SalesSummaryPoint({
    required this.date,
    required this.revenue,
    required this.orders,
  });

  factory SalesSummaryPoint.fromJson(Map<String, dynamic> json) {
    return SalesSummaryPoint(
      date: DateTime.parse(json['date'] as String),
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
      orders: json['orders'] as int? ?? 0,
    );
  }
}

class TopProductModel {
  final String productId;
  final String productName;
  final int quantitySold;
  final double revenue;

  const TopProductModel({
    required this.productId,
    required this.productName,
    required this.quantitySold,
    required this.revenue,
  });

  factory TopProductModel.fromJson(Map<String, dynamic> json) {
    return TopProductModel(
      productId: json['product_id'] as String? ?? '',
      productName: json['product_name'] as String? ?? '',
      quantitySold: json['quantity_sold'] as int? ?? 0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
