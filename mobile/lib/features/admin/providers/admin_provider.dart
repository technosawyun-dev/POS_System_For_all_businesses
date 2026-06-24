import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/admin_repository.dart';
import '../../../models/tenant_model.dart';
import '../../../models/user_model.dart';
import '../../../models/device_model.dart';
import '../../../models/audit_log_model.dart';
import '../../../models/subscription_model.dart';

// Tenants
class TenantsState {
  final List<TenantModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const TenantsState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
  });

  TenantsState copyWith({
    List<TenantModel>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    bool clearError = false,
  }) =>
      TenantsState(
        items: items ?? this.items,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        error: clearError ? null : (error ?? this.error),
        hasMore: hasMore ?? this.hasMore,
        page: page ?? this.page,
      );
}

class TenantsNotifier extends StateNotifier<TenantsState> {
  final AdminRepository _repo;
  TenantsNotifier(this._repo) : super(const TenantsState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) {
      state = const TenantsState(isLoading: true);
    }
    try {
      final result = await _repo.listTenants(page: 1);
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
      final result = await _repo.listTenants(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) {
      state = state.copyWith(isLoadingMore: false);
    }
  }
}

// Admin Users
class AdminUsersState {
  final List<UserModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const AdminUsersState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
  });

  AdminUsersState copyWith({
    List<UserModel>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => AdminUsersState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class AdminUsersNotifier extends StateNotifier<AdminUsersState> {
  final AdminRepository _repo;
  AdminUsersNotifier(this._repo) : super(const AdminUsersState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const AdminUsersState(isLoading: true);
    try {
      final result = await _repo.listAllUsers(page: 1);
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
      final result = await _repo.listAllUsers(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

// Resellers
class AdminResellersState {
  final List<ResellerModel> items;
  final bool isLoading;
  final String? error;

  const AdminResellersState({this.items = const [], this.isLoading = false, this.error});

  AdminResellersState copyWith({List<ResellerModel>? items, bool? isLoading, String? error, bool clearError = false}) =>
      AdminResellersState(
        items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
      );
}

class AdminResellersNotifier extends StateNotifier<AdminResellersState> {
  final AdminRepository _repo;
  AdminResellersNotifier(this._repo) : super(const AdminResellersState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const AdminResellersState(isLoading: true);
    try {
      final result = await _repo.listResellers();
      state = state.copyWith(items: result.items, isLoading: false, clearError: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

// Plans
class PlansState {
  final List<SubscriptionPlanModel> items;
  final bool isLoading;
  final String? error;

  const PlansState({this.items = const [], this.isLoading = false, this.error});

  PlansState copyWith({List<SubscriptionPlanModel>? items, bool? isLoading, String? error, bool clearError = false}) =>
      PlansState(
        items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
      );
}

class PlansNotifier extends StateNotifier<PlansState> {
  final AdminRepository _repo;
  PlansNotifier(this._repo) : super(const PlansState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const PlansState(isLoading: true);
    try {
      final items = await _repo.listPlans();
      state = state.copyWith(items: items, isLoading: false, clearError: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

// Devices
class DevicesState {
  final List<DeviceModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const DevicesState({
    this.items = const [], this.isLoading = false, this.isLoadingMore = false,
    this.error, this.hasMore = true, this.page = 1,
  });

  DevicesState copyWith({
    List<DeviceModel>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => DevicesState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class DevicesNotifier extends StateNotifier<DevicesState> {
  final AdminRepository _repo;
  DevicesNotifier(this._repo) : super(const DevicesState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const DevicesState(isLoading: true);
    try {
      final result = await _repo.listDevices(page: 1);
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
      final result = await _repo.listDevices(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

// Audit Logs
class AuditLogsState {
  final List<AuditLogModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const AuditLogsState({
    this.items = const [], this.isLoading = false, this.isLoadingMore = false,
    this.error, this.hasMore = true, this.page = 1,
  });

  AuditLogsState copyWith({
    List<AuditLogModel>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => AuditLogsState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class AuditLogsNotifier extends StateNotifier<AuditLogsState> {
  final AdminRepository _repo;
  AuditLogsNotifier(this._repo) : super(const AuditLogsState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const AuditLogsState(isLoading: true);
    try {
      final result = await _repo.listAuditLogs(page: 1);
      state = state.copyWith(
        items: result.items, isLoading: false,
        hasMore: result.items.length >= 30, page: 1, clearError: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore || state.isLoading) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final result = await _repo.listAuditLogs(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 30,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

// Subscriptions
class AdminSubscriptionsState {
  final List<Map<String, dynamic>> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;

  const AdminSubscriptionsState({
    this.items = const [], this.isLoading = false, this.isLoadingMore = false,
    this.error, this.hasMore = true, this.page = 1,
  });

  AdminSubscriptionsState copyWith({
    List<Map<String, dynamic>>? items, bool? isLoading, bool? isLoadingMore,
    String? error, bool? hasMore, int? page, bool clearError = false,
  }) => AdminSubscriptionsState(
    items: items ?? this.items, isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
    hasMore: hasMore ?? this.hasMore, page: page ?? this.page,
  );
}

class AdminSubscriptionsNotifier extends StateNotifier<AdminSubscriptionsState> {
  final AdminRepository _repo;
  AdminSubscriptionsNotifier(this._repo) : super(const AdminSubscriptionsState());

  Future<void> load({bool refresh = false}) async {
    if (refresh || state.items.isEmpty) state = const AdminSubscriptionsState(isLoading: true);
    try {
      final result = await _repo.listSubscriptions(page: 1);
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
      final result = await _repo.listSubscriptions(page: state.page + 1);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        isLoadingMore: false, hasMore: result.items.length >= 20,
        page: state.page + 1,
      );
    } catch (_) { state = state.copyWith(isLoadingMore: false); }
  }
}

// Providers
final tenantsProvider =
    StateNotifierProvider<TenantsNotifier, TenantsState>((ref) =>
        TenantsNotifier(ref.watch(adminRepositoryProvider)));

final adminUsersProvider =
    StateNotifierProvider<AdminUsersNotifier, AdminUsersState>((ref) =>
        AdminUsersNotifier(ref.watch(adminRepositoryProvider)));

final adminResellersProvider =
    StateNotifierProvider<AdminResellersNotifier, AdminResellersState>(
        (ref) => AdminResellersNotifier(ref.watch(adminRepositoryProvider)));

final plansProvider =
    StateNotifierProvider<PlansNotifier, PlansState>((ref) =>
        PlansNotifier(ref.watch(adminRepositoryProvider)));

final devicesProvider =
    StateNotifierProvider<DevicesNotifier, DevicesState>((ref) =>
        DevicesNotifier(ref.watch(adminRepositoryProvider)));

final auditLogsProvider =
    StateNotifierProvider<AuditLogsNotifier, AuditLogsState>((ref) =>
        AuditLogsNotifier(ref.watch(adminRepositoryProvider)));

final adminSubscriptionsProvider =
    StateNotifierProvider<AdminSubscriptionsNotifier, AdminSubscriptionsState>(
        (ref) => AdminSubscriptionsNotifier(ref.watch(adminRepositoryProvider)));
