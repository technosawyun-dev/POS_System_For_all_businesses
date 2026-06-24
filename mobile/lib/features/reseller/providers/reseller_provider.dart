import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/reseller_repository.dart';
import '../../../models/reseller_wallet_model.dart';

class ResellerDashboardState {
  final Map<String, dynamic>? stats;
  final bool isLoading;
  final String? error;

  const ResellerDashboardState({this.stats, this.isLoading = false, this.error});

  ResellerDashboardState copyWith({
    Map<String, dynamic>? stats, bool? isLoading, String? error, bool clearError = false,
  }) => ResellerDashboardState(
    stats: stats ?? this.stats, isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
  );
}

class ResellerDashboardNotifier extends StateNotifier<ResellerDashboardState> {
  final ResellerRepository _repo;
  ResellerDashboardNotifier(this._repo) : super(const ResellerDashboardState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.stats == null) state = const ResellerDashboardState(isLoading: true);
    try {
      final stats = await _repo.getDashboardStats();
      state = state.copyWith(stats: stats, isLoading: false, clearError: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

class ResellerWalletState {
  final ResellerWalletModel? wallet;
  final bool isLoading;
  final String? error;

  const ResellerWalletState({this.wallet, this.isLoading = false, this.error});

  ResellerWalletState copyWith({
    ResellerWalletModel? wallet, bool? isLoading, String? error, bool clearError = false,
  }) => ResellerWalletState(
    wallet: wallet ?? this.wallet, isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
  );
}

class ResellerWalletNotifier extends StateNotifier<ResellerWalletState> {
  final ResellerRepository _repo;
  ResellerWalletNotifier(this._repo) : super(const ResellerWalletState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.wallet == null) state = const ResellerWalletState(isLoading: true);
    try {
      final wallet = await _repo.getWallet();
      state = state.copyWith(wallet: wallet, isLoading: false, clearError: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> requestPayout(double amount) async {
    try {
      await _repo.requestPayout(amount);
      await load(refresh: true);
      return true;
    } catch (_) {
      return false;
    }
  }
}

class ResellerCommissionsState {
  final List<CommissionModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const ResellerCommissionsState({
    this.items = const [], this.isLoading = false, this.isLoadingMore = false,
    this.error, this.hasMore = true, this.page = 1,
  });

  ResellerCommissionsState copyWith({
    List<CommissionModel>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => ResellerCommissionsState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class ResellerCommissionsNotifier extends StateNotifier<ResellerCommissionsState> {
  final ResellerRepository _repo;
  ResellerCommissionsNotifier(this._repo) : super(const ResellerCommissionsState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const ResellerCommissionsState(isLoading: true);
    try {
      final result = await _repo.listCommissions(page: 1);
      state = state.copyWith(
        items: result.items, isLoading: false,
        hasMore: result.items.length >= 20, page: 1, clearError: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore || state.isLoading) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final result = await _repo.listCommissions(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

class ResellerReferralsState {
  final List<ReferralModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const ResellerReferralsState({
    this.items = const [], this.isLoading = false, this.isLoadingMore = false,
    this.error, this.hasMore = true, this.page = 1,
  });

  ResellerReferralsState copyWith({
    List<ReferralModel>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => ResellerReferralsState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class ResellerReferralsNotifier extends StateNotifier<ResellerReferralsState> {
  final ResellerRepository _repo;
  ResellerReferralsNotifier(this._repo) : super(const ResellerReferralsState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const ResellerReferralsState(isLoading: true);
    try {
      final result = await _repo.listReferrals(page: 1);
      state = state.copyWith(
        items: result.items, isLoading: false,
        hasMore: result.items.length >= 20, page: 1, clearError: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore || state.isLoading) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final result = await _repo.listReferrals(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

final resellerDashboardProvider =
    StateNotifierProvider<ResellerDashboardNotifier, ResellerDashboardState>(
        (ref) => ResellerDashboardNotifier(ref.watch(resellerRepositoryProvider)));

final resellerWalletProvider =
    StateNotifierProvider<ResellerWalletNotifier, ResellerWalletState>(
        (ref) => ResellerWalletNotifier(ref.watch(resellerRepositoryProvider)));

final resellerCommissionsProvider =
    StateNotifierProvider<ResellerCommissionsNotifier, ResellerCommissionsState>(
        (ref) => ResellerCommissionsNotifier(ref.watch(resellerRepositoryProvider)));

final resellerReferralsProvider =
    StateNotifierProvider<ResellerReferralsNotifier, ResellerReferralsState>(
        (ref) => ResellerReferralsNotifier(ref.watch(resellerRepositoryProvider)));
