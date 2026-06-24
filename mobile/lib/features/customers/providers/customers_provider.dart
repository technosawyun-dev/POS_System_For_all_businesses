import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/customers_repository.dart';
import '../../../models/customer_model.dart';

class CustomersState {
  final List<CustomerModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? searchQuery;

  const CustomersState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.searchQuery,
  });

  CustomersState copyWith({
    List<CustomerModel>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? searchQuery,
    bool clearError = false,
  }) {
    return CustomersState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class CustomersNotifier extends StateNotifier<CustomersState> {
  final CustomersRepository _repo;
  CustomersNotifier(this._repo) : super(const CustomersState());

  Future<void> load({bool refresh = false, String? search}) async {
    if (refresh || search != state.searchQuery) {
      state = CustomersState(
        isLoading: true,
        searchQuery: search ?? state.searchQuery,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.listCustomers(
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
      final result = await _repo.listCustomers(
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

  void search(String query) {
    load(refresh: true, search: query.isEmpty ? null : query);
  }

  void addItem(CustomerModel customer) {
    state = state.copyWith(items: [customer, ...state.items]);
  }

  void updateItem(CustomerModel updated) {
    state = state.copyWith(
      items: state.items.map((c) => c.id == updated.id ? updated : c).toList(),
    );
  }
}

final customersProvider =
    StateNotifierProvider<CustomersNotifier, CustomersState>((ref) {
  return CustomersNotifier(ref.watch(customersRepositoryProvider));
});
