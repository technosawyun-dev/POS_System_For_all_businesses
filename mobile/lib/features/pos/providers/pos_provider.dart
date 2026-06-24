import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/pos_repository.dart';
import '../../../models/product_model.dart';
import '../../../models/cart_model.dart';
import '../../../models/order_model.dart';
import '../../../models/customer_model.dart';


// POS Cart State
class PosCartState {
  final List<LocalCartItem> items;
  final CustomerModel? customer;
  final String? serverCartId;
  final bool isSyncing;
  final bool isCheckingOut;
  final String? error;
  final OrderModel? lastCompletedOrder;

  const PosCartState({
    this.items = const [],
    this.customer,
    this.serverCartId,
    this.isSyncing = false,
    this.isCheckingOut = false,
    this.error,
    this.lastCompletedOrder,
  });

  double get subtotal =>
      items.fold(0, (sum, i) => sum + i.lineSubtotal);
  double get taxTotal =>
      items.fold(0, (sum, i) => sum + i.taxAmount);
  double get discountTotal =>
      items.fold(0, (sum, i) => sum + i.discountAmount * i.quantity);
  double get total => subtotal + taxTotal - discountTotal;
  int get itemCount =>
      items.fold(0, (sum, i) => sum + i.quantity);
  bool get isEmpty => items.isEmpty;

  PosCartState copyWith({
    List<LocalCartItem>? items,
    CustomerModel? customer,
    bool clearCustomer = false,
    String? serverCartId,
    bool clearCartId = false,
    bool? isSyncing,
    bool? isCheckingOut,
    String? error,
    bool clearError = false,
    OrderModel? lastCompletedOrder,
    bool clearLastOrder = false,
  }) {
    return PosCartState(
      items: items ?? this.items,
      customer: clearCustomer ? null : customer ?? this.customer,
      serverCartId:
          clearCartId ? null : serverCartId ?? this.serverCartId,
      isSyncing: isSyncing ?? this.isSyncing,
      isCheckingOut: isCheckingOut ?? this.isCheckingOut,
      error: clearError ? null : error ?? this.error,
      lastCompletedOrder: clearLastOrder
          ? null
          : lastCompletedOrder ?? this.lastCompletedOrder,
    );
  }
}

class PosCartNotifier extends StateNotifier<PosCartState> {
  final PosRepository _repo;
  final String _branchId;
  final String _sessionId;

  PosCartNotifier(this._repo, this._branchId, this._sessionId)
      : super(const PosCartState());

  void addItem(ProductModel product, {ProductVariantModel? variant}) {
    final key = variant?.id ?? product.id;
    final existingIndex =
        state.items.indexWhere((i) => i.key == key);

    if (existingIndex >= 0) {
      final updated = List<LocalCartItem>.from(state.items);
      updated[existingIndex].quantity++;
      state = state.copyWith(items: updated);
    } else {
      final newItem = LocalCartItem(
        productId: product.id,
        productName: product.name,
        variantId: variant?.id,
        variantName: variant?.name,
        quantity: 1,
        unitPrice: variant?.sellingPrice ?? product.sellingPrice,
        discountAmount: 0,
        taxRate: product.taxRate,
        sku: variant?.sku ?? product.sku,
        barcode: variant?.barcode ?? product.barcode,
      );
      state = state.copyWith(items: [...state.items, newItem]);
    }
  }

  void removeItem(String key) {
    final updated = state.items.where((i) => i.key != key).toList();
    state = state.copyWith(items: updated);
  }

  void incrementItem(String key) {
    final updated = List<LocalCartItem>.from(state.items);
    final idx = updated.indexWhere((i) => i.key == key);
    if (idx >= 0) updated[idx].quantity++;
    state = state.copyWith(items: updated);
  }

  void decrementItem(String key) {
    final updated = List<LocalCartItem>.from(state.items);
    final idx = updated.indexWhere((i) => i.key == key);
    if (idx >= 0) {
      if (updated[idx].quantity <= 1) {
        updated.removeAt(idx);
      } else {
        updated[idx].quantity--;
      }
    }
    state = state.copyWith(items: updated);
  }

  void setDiscount(String key, double discount) {
    final updated = List<LocalCartItem>.from(state.items);
    final idx = updated.indexWhere((i) => i.key == key);
    if (idx >= 0) updated[idx].discountAmount = discount;
    state = state.copyWith(items: updated);
  }

  void setCustomer(CustomerModel? customer) {
    if (customer == null) {
      state = state.copyWith(clearCustomer: true);
    } else {
      state = state.copyWith(customer: customer);
    }
  }

  void clearCart() {
    state = const PosCartState();
  }

  // Build the server-side cart and process checkout in a single flow
  Future<OrderModel?> checkout(
      List<CheckoutPayment> payments) async {
    if (state.items.isEmpty) return null;

    state = state.copyWith(isCheckingOut: true, clearError: true);
    try {
      // Step 1: Create cart on server
      final serverCart = await _repo.createCart(
        branchId: _branchId,
        cashierSessionId: _sessionId,
        customerId: state.customer?.id,
      );

      // Step 2: Add all items
      for (final item in state.items) {
        await _repo.addToCart(
          cartId: serverCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
        );
      }

      // Step 3: Checkout
      final order = await _repo.checkout(
        branchId: _branchId,
        cashierSessionId: _sessionId,
        cartId: serverCart.id,
        payments: payments,
        customerId: state.customer?.id,
      );

      state = PosCartState(lastCompletedOrder: order);
      return order;
    } catch (e) {
      state = state.copyWith(
          isCheckingOut: false, error: e.toString());
      return null;
    }
  }

  void clearLastOrder() =>
      state = state.copyWith(clearLastOrder: true);
  void clearError() => state = state.copyWith(clearError: true);
}

// Product List State
class ProductListState {
  final List<ProductModel> products;
  final bool isLoading;
  final bool hasMore;
  final String? error;
  final String search;
  final String? categoryId;
  final int page;

  const ProductListState({
    this.products = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.error,
    this.search = '',
    this.categoryId,
    this.page = 1,
  });

  ProductListState copyWith({
    List<ProductModel>? products,
    bool? isLoading,
    bool? hasMore,
    String? error,
    bool clearError = false,
    String? search,
    String? categoryId,
    bool clearCategory = false,
    int? page,
  }) {
    return ProductListState(
      products: products ?? this.products,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      error: clearError ? null : error ?? this.error,
      search: search ?? this.search,
      categoryId:
          clearCategory ? null : categoryId ?? this.categoryId,
      page: page ?? this.page,
    );
  }
}

class ProductListNotifier extends StateNotifier<ProductListState> {
  final PosRepository _repo;
  final String? _branchId;

  ProductListNotifier(this._repo, this._branchId)
      : super(const ProductListState()) {
    loadProducts();
  }

  Future<void> loadProducts({bool refresh = false}) async {
    if (state.isLoading) return;
    final page = refresh ? 1 : state.page;
    state = state.copyWith(isLoading: true, clearError: true,
        page: page,
        products: refresh ? [] : state.products);
    try {
      final result = await _repo.getProducts(
        branchId: _branchId,
        search: state.search.isEmpty ? null : state.search,
        categoryId: state.categoryId,
        page: page,
      );
      state = state.copyWith(
        products: refresh
            ? result.items
            : [...state.products, ...result.items],
        isLoading: false,
        hasMore: result.hasMore,
        page: page + 1,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> search(String query) async {
    state = state.copyWith(
        search: query, products: [], page: 1, hasMore: true);
    await loadProducts(refresh: true);
  }

  Future<void> filterByCategory(String? categoryId) async {
    state = state.copyWith(
      categoryId: categoryId,
      clearCategory: categoryId == null,
      products: [],
      page: 1,
      hasMore: true,
    );
    await loadProducts(refresh: true);
  }
}

// Providers
final posRepositoryProvider = Provider((ref) => PosRepository());

// Cart provider — parameterized by branchId + sessionId
final posCartProvider = StateNotifierProvider.family<PosCartNotifier,
    PosCartState, ({String branchId, String sessionId})>((ref, params) {
  return PosCartNotifier(
    ref.watch(posRepositoryProvider),
    params.branchId,
    params.sessionId,
  );
});

// Product list provider — parameterized by branchId
final productListProvider = StateNotifierProvider.family<
    ProductListNotifier, ProductListState, String?>((ref, branchId) {
  return ProductListNotifier(ref.watch(posRepositoryProvider), branchId);
});
