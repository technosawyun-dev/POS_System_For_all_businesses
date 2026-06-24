import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/inventory_repository.dart';

class InventoryState {
  final List<StockLevelModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? searchQuery;
  final bool lowStockOnly;

  const InventoryState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.searchQuery,
    this.lowStockOnly = false,
  });

  InventoryState copyWith({
    List<StockLevelModel>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? searchQuery,
    bool? lowStockOnly,
    bool clearError = false,
  }) {
    return InventoryState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      searchQuery: searchQuery ?? this.searchQuery,
      lowStockOnly: lowStockOnly ?? this.lowStockOnly,
    );
  }
}

class InventoryNotifier extends StateNotifier<InventoryState> {
  final InventoryRepository _repo;
  InventoryNotifier(this._repo) : super(const InventoryState());

  Future<void> load({
    bool refresh = false,
    String? search,
    bool? lowStockOnly,
  }) async {
    if (refresh || search != state.searchQuery || lowStockOnly != state.lowStockOnly) {
      state = InventoryState(
        isLoading: true,
        searchQuery: search ?? state.searchQuery,
        lowStockOnly: lowStockOnly ?? state.lowStockOnly,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.getStockLevels(
        search: state.searchQuery,
        lowStockOnly: state.lowStockOnly ? true : null,
        page: 1,
      );
      state = state.copyWith(
        items: result.items,
        isLoading: false,
        hasMore: result.items.length >= 50,
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
      final result = await _repo.getStockLevels(
        search: state.searchQuery,
        lowStockOnly: state.lowStockOnly ? true : null,
        page: state.page + 1,
      );
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false,
        hasMore: result.items.length >= 50,
        page: state.page + 1,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void toggleLowStockFilter() {
    load(refresh: true, lowStockOnly: !state.lowStockOnly);
  }

  void search(String query) {
    load(refresh: true, search: query.isEmpty ? null : query);
  }
}

final inventoryProvider =
    StateNotifierProvider<InventoryNotifier, InventoryState>((ref) {
  return InventoryNotifier(ref.watch(inventoryRepositoryProvider));
});
