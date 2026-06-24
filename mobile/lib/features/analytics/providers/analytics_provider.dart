import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/analytics_repository.dart';
import '../../../models/analytics_model.dart';

class AnalyticsState {
  final DashboardKpiModel? kpi;
  final List<SalesSummaryPoint> salesPoints;
  final List<TopProductModel> topProducts;
  final bool isLoading;
  final String? error;
  final String period;

  const AnalyticsState({
    this.kpi,
    this.salesPoints = const [],
    this.topProducts = const [],
    this.isLoading = false,
    this.error,
    this.period = '7d',
  });

  AnalyticsState copyWith({
    DashboardKpiModel? kpi,
    List<SalesSummaryPoint>? salesPoints,
    List<TopProductModel>? topProducts,
    bool? isLoading,
    String? error,
    String? period,
    bool clearError = false,
  }) {
    return AnalyticsState(
      kpi: kpi ?? this.kpi,
      salesPoints: salesPoints ?? this.salesPoints,
      topProducts: topProducts ?? this.topProducts,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      period: period ?? this.period,
    );
  }
}

class AnalyticsNotifier extends StateNotifier<AnalyticsState> {
  final AnalyticsRepository _repo;
  AnalyticsNotifier(this._repo) : super(const AnalyticsState());

  Future<void> load({String? period}) async {
    final selectedPeriod = period ?? state.period;
    state = AnalyticsState(isLoading: true, period: selectedPeriod);

    try {
      final results = await Future.wait([
        _repo.getDashboard(period: selectedPeriod),
        _repo.getSalesSummary(groupBy: selectedPeriod == '1d' ? 'hour' : 'day'),
        _repo.getTopProducts(limit: 10),
      ]);

      state = AnalyticsState(
        kpi: results[0] as DashboardKpiModel,
        salesPoints: results[1] as List<SalesSummaryPoint>,
        topProducts: results[2] as List<TopProductModel>,
        isLoading: false,
        period: selectedPeriod,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setPeriod(String period) {
    if (period == state.period) return;
    load(period: period);
  }
}

final analyticsProvider =
    StateNotifierProvider<AnalyticsNotifier, AnalyticsState>((ref) {
  return AnalyticsNotifier(ref.watch(analyticsRepositoryProvider));
});
