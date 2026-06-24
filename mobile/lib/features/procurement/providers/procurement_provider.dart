import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/procurement_repository.dart';
import '../../../models/purchase_order_model.dart';

class ProcurementState {
  final List<PurchaseOrderModel> items;
  final List<SupplierModel> suppliers;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? statusFilter;

  const ProcurementState({
    this.items = const [],
    this.suppliers = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.statusFilter,
  });

  ProcurementState copyWith({
    List<PurchaseOrderModel>? items,
    List<SupplierModel>? suppliers,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? statusFilter,
    bool clearError = false,
  }) {
    return ProcurementState(
      items: items ?? this.items,
      suppliers: suppliers ?? this.suppliers,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      statusFilter: statusFilter ?? this.statusFilter,
    );
  }
}

class ProcurementNotifier extends StateNotifier<ProcurementState> {
  final ProcurementRepository _repo;
  ProcurementNotifier(this._repo) : super(const ProcurementState());

  Future<void> load({bool refresh = false, String? status}) async {
    if (refresh || status != state.statusFilter) {
      state = ProcurementState(
        isLoading: true,
        suppliers: state.suppliers,
        statusFilter: status ?? state.statusFilter,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.listPurchaseOrders(
        status: state.statusFilter,
        page: 1,
      );
      state = state.copyWith(
        items: result.items,
        isLoading: false,
        hasMore: result.items.length >= 20,
        page: 1,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore || state.isLoading) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final result = await _repo.listPurchaseOrders(
        status: state.statusFilter,
        page: state.page + 1,
      );
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false,
        hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  Future<void> loadSuppliers() async {
    try {
      final suppliers = await _repo.getSuppliers();
      state = state.copyWith(suppliers: suppliers);
    } catch (_) {}
  }

  void filterStatus(String? status) {
    if (status == state.statusFilter) return;
    load(refresh: true, status: status);
  }

  void addItem(PurchaseOrderModel po) {
    state = state.copyWith(items: [po, ...state.items]);
  }
}

final procurementProvider =
    StateNotifierProvider<ProcurementNotifier, ProcurementState>((ref) {
  return ProcurementNotifier(ref.watch(procurementRepositoryProvider));
});
