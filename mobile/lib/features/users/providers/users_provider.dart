import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/users_repository.dart';
import '../../../models/user_model.dart';

class UsersState {
  final List<UserModel> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final bool hasMore;
  final int page;
  final String? searchQuery;
  final String? roleFilter;

  const UsersState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.hasMore = true,
    this.page = 1,
    this.searchQuery,
    this.roleFilter,
  });

  UsersState copyWith({
    List<UserModel>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool? hasMore,
    int? page,
    String? searchQuery,
    String? roleFilter,
    bool clearError = false,
  }) {
    return UsersState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      searchQuery: searchQuery ?? this.searchQuery,
      roleFilter: roleFilter ?? this.roleFilter,
    );
  }
}

class UsersNotifier extends StateNotifier<UsersState> {
  final UsersRepository _repo;
  UsersNotifier(this._repo) : super(const UsersState());

  Future<void> load({
    bool refresh = false,
    String? search,
    String? role,
  }) async {
    if (refresh || search != state.searchQuery || role != state.roleFilter) {
      state = UsersState(
        isLoading: true,
        searchQuery: search ?? state.searchQuery,
        roleFilter: role ?? state.roleFilter,
      );
    } else if (state.items.isEmpty) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final result = await _repo.listUsers(
        search: state.searchQuery,
        role: state.roleFilter,
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
      final result = await _repo.listUsers(
        search: state.searchQuery,
        role: state.roleFilter,
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
    load(refresh: true, search: query.isEmpty ? null : query, role: state.roleFilter);
  }

  void filterRole(String? role) {
    if (role == state.roleFilter) return;
    load(refresh: true, search: state.searchQuery, role: role);
  }

  void addItem(UserModel user) {
    state = state.copyWith(items: [user, ...state.items]);
  }

  void updateItem(UserModel updated) {
    state = state.copyWith(
      items: state.items.map((u) => u.id == updated.id ? updated : u).toList(),
    );
  }
}

final usersProvider =
    StateNotifierProvider<UsersNotifier, UsersState>((ref) {
  return UsersNotifier(ref.watch(usersRepositoryProvider));
});
