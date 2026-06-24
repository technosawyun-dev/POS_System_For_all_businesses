import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/analytics_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/error_view.dart';
import '../../../models/analytics_model.dart';

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(analyticsProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(analyticsProvider);
    final periods = ['1d', '7d', '30d', '90d'];
    final periodLabels = ['Today', '7 Days', '30 Days', '90 Days'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: periods.length,
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.only(right: 8, top: 4, bottom: 4),
                child: FilterChip(
                  label: Text(periodLabels[i]),
                  selected: state.period == periods[i],
                  onSelected: (_) =>
                      ref.read(analyticsProvider.notifier).setPeriod(periods[i]),
                ),
              ),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(analyticsProvider.notifier).load(period: state.period),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? ErrorView(
                    message: state.error!,
                    onRetry: () => ref.read(analyticsProvider.notifier).load(),
                  )
                : ListView(
                    padding: const EdgeInsets.only(bottom: 24),
                    children: [
                      if (state.kpi != null) ...[
                        _KpiGrid(kpi: state.kpi!),
                        const SizedBox(height: 8),
                      ],
                      if (state.salesPoints.isNotEmpty) ...[
                        _SalesChart(points: state.salesPoints),
                        const SizedBox(height: 8),
                      ],
                      if (state.topProducts.isNotEmpty)
                        _TopProductsCard(products: state.topProducts),
                    ],
                  ),
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  final DashboardKpiModel kpi;
  const _KpiGrid({required this.kpi});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (_, c) => GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: Responsive.gridCols(c.maxWidth, phone: 2, tablet: 4, wide: 4),
      padding: const EdgeInsets.all(16),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _KpiCard(
          title: 'Revenue',
          value: CurrencyFormatter.format(kpi.totalRevenue),
          icon: Icons.monetization_on_outlined,
          color: AppColors.primary,
          growth: kpi.revenueGrowth,
        ),
        _KpiCard(
          title: 'Orders',
          value: kpi.totalOrders.toString(),
          icon: Icons.receipt_long_outlined,
          color: AppColors.secondary,
          growth: kpi.orderGrowth,
        ),
        _KpiCard(
          title: 'Avg Order',
          value: CurrencyFormatter.format(kpi.averageOrderValue),
          icon: Icons.bar_chart_rounded,
          color: AppColors.info,
        ),
        _KpiCard(
          title: 'Customers',
          value: kpi.totalCustomers.toString(),
          icon: Icons.people_outline,
          color: AppColors.warning,
        ),
      ],
    ));
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final double? growth;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.growth,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 6),
                Text(title,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
                const Spacer(),
                if (growth != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: growth! >= 0
                          ? AppColors.successLight
                          : AppColors.errorLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${growth! >= 0 ? '+' : ''}${growth!.toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: growth! >= 0 ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ),
              ],
            ),
            const Spacer(),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SalesChart extends StatelessWidget {
  final List<SalesSummaryPoint> points;
  const _SalesChart({required this.points});

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) return const SizedBox();

    final maxY = points.map((p) => p.revenue).reduce((a, b) => a > b ? a : b);
    final spots = points.asMap().entries.map((e) {
      return FlSpot(e.key.toDouble(), e.value.revenue);
    }).toList();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Revenue Trend',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            SizedBox(
              height: 180,
              child: LineChart(
                LineChartData(
                  gridData: const FlGridData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (v, _) {
                          final idx = v.toInt();
                          if (idx < 0 || idx >= points.length) {
                            return const SizedBox();
                          }
                          if (points.length <= 8 || idx % (points.length ~/ 4) == 0) {
                            final dt = points[idx].date;
                            return Text('${dt.day}/${dt.month}',
                                style: const TextStyle(
                                    fontSize: 10,
                                    color: AppColors.textSecondary));
                          }
                          return const SizedBox();
                        },
                        reservedSize: 24,
                      ),
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  minX: 0,
                  maxX: (points.length - 1).toDouble(),
                  minY: 0,
                  maxY: maxY * 1.2,
                  lineBarsData: [
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      color: AppColors.primary,
                      barWidth: 2.5,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        color: AppColors.primary.withValues(alpha: 0.1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopProductsCard extends StatelessWidget {
  final List<TopProductModel> products;
  const _TopProductsCard({required this.products});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Top Products',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ...products.take(10).toList().asMap().entries.map((e) {
              final i = e.key;
              final p = e.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                    Expanded(
                      child: Text(p.productName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13)),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(CurrencyFormatter.format(p.revenue),
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary)),
                        Text('${p.quantitySold} sold',
                            style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.textSecondary)),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
