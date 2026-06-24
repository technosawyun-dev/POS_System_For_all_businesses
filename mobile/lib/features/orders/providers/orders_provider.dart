import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/orders_repository.dart';
import '../../../models/order_model.dart';

class OrdersState {
  final List<OrderModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? statusFilter;
  final String? searchQuery;

  const OrdersState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.statusFilter,
    this.searchQuery,
  });

  OrdersState copyWith({
    List<OrderModel>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? statusFilter,
    String? searchQuery,
    bool clearError = false,
  }) {
    return OrdersState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      statusFilter: statusFilter ?? this.statusFilter,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class OrdersNotifier extends StateNotifier<OrdersState> {
  final OrdersRepository _repo;
  OrdersNotifier(this._repo) : super(const OrdersState());

  Future<void> load({
    bool refresh = false,
    String? statusFilter,
    String? searchQuery,
  }) async {
    if (refresh || statusFilter != state.statusFilter || searchQuery != state.searchQuery) {
      state = OrdersState(
        isLoading: true,
        statusFilter: statusFilter ?? state.statusFilter,
        searchQuery: searchQuery ?? state.searchQuery,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.listOrders(
        status: state.statusFilter,
        search: state.searchQuery,
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
      final result = await _repo.listOrders(
        status: state.statusFilter,
        search: state.searchQuery,
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

  void setFilter(String? status) {
    if (status == state.statusFilter) return;
    load(refresh: true, statusFilter: status, searchQuery: state.searchQuery);
  }

  void search(String query) {
    load(refresh: true, statusFilter: state.statusFilter, searchQuery: query.isEmpty ? null : query);
  }
}

final ordersProvider =
    StateNotifierProvider<OrdersNotifier, OrdersState>((ref) {
  return OrdersNotifier(ref.watch(ordersRepositoryProvider));
});
