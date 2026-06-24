import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/products_repository.dart';
import '../../../models/product_model.dart';
import '../../../models/category_model.dart';

class ProductsState {
  final List<ProductModel> items;
  final List<CategoryModel> categories;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? searchQuery;
  final String? categoryFilter;

  const ProductsState({
    this.items = const [],
    this.categories = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.searchQuery,
    this.categoryFilter,
  });

  ProductsState copyWith({
    List<ProductModel>? items,
    List<CategoryModel>? categories,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? searchQuery,
    String? categoryFilter,
    bool clearError = false,
    bool clearCategory = false,
  }) {
    return ProductsState(
      items: items ?? this.items,
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      searchQuery: searchQuery ?? this.searchQuery,
      categoryFilter:
          clearCategory ? null : (categoryFilter ?? this.categoryFilter),
    );
  }
}

class ProductsNotifier extends StateNotifier<ProductsState> {
  final ProductsRepository _repo;
  ProductsNotifier(this._repo) : super(const ProductsState());

  Future<void> load({
    bool refresh = false,
    String? search,
    String? categoryId,
  }) async {
    if (refresh || search != state.searchQuery || categoryId != state.categoryFilter) {
      state = ProductsState(
        isLoading: true,
        categories: state.categories,
        searchQuery: search ?? state.searchQuery,
        categoryFilter: categoryId ?? state.categoryFilter,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.listProducts(
        search: state.searchQuery,
        categoryId: state.categoryFilter,
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
      final result = await _repo.listProducts(
        search: state.searchQuery,
        categoryId: state.categoryFilter,
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

  Future<void> loadCategories() async {
    try {
      final cats = await _repo.getCategories();
      state = state.copyWith(categories: cats);
    } catch (_) {}
  }

  void search(String query) {
    load(refresh: true, search: query.isEmpty ? null : query, categoryId: state.categoryFilter);
  }

  void filterCategory(String? id) {
    if (id == state.categoryFilter) return;
    load(refresh: true, search: state.searchQuery, categoryId: id);
  }

  void addItem(ProductModel product) {
    state = state.copyWith(items: [product, ...state.items]);
  }

  void updateItem(ProductModel updated) {
    state = state.copyWith(
      items: state.items.map((p) => p.id == updated.id ? updated : p).toList(),
    );
  }
}

final productsProvider =
    StateNotifierProvider<ProductsNotifier, ProductsState>((ref) {
  return ProductsNotifier(ref.watch(productsRepositoryProvider));
});
