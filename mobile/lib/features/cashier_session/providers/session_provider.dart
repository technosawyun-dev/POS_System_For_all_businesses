import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/session_repository.dart';
import '../../../models/cashier_session_model.dart';

class SessionState {
  final CashierSessionModel? session;
  final bool isLoading;
  final String? error;

  const SessionState({this.session, this.isLoading = false, this.error});

  bool get hasOpenSession =>
      session != null && session!.status == SessionStatus.open;

  SessionState copyWith({
    CashierSessionModel? session,
    bool clearSession = false,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return SessionState(
      session: clearSession ? null : session ?? this.session,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class SessionNotifier extends StateNotifier<SessionState> {
  final SessionRepository _repo;

  SessionNotifier(this._repo) : super(const SessionState());

  Future<void> loadOpenSession({String? branchId}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final session = await _repo.getOpenSession(branchId: branchId);
      state = SessionState(session: session);
    } catch (e) {
      state = SessionState(error: e.toString());
    }
  }

  Future<bool> openSession({
    required String branchId,
    required double openingBalance,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final session = await _repo.openSession(
        branchId: branchId,
        openingBalance: openingBalance,
      );
      state = SessionState(session: session);
      return true;
    } catch (e) {
      state = SessionState(error: e.toString());
      return false;
    }
  }

  Future<bool> closeSession({
    required double closingBalance,
    String? notes,
  }) async {
    final sessionId = state.session?.id;
    if (sessionId == null) return false;

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final closed = await _repo.closeSession(
        sessionId: sessionId,
        closingBalance: closingBalance,
        notes: notes,
      );
      state = SessionState(session: closed);
      return true;
    } catch (e) {
      state = SessionState(error: e.toString(), session: state.session);
      return false;
    }
  }

  void clearError() => state = state.copyWith(clearError: true);
}

final sessionRepositoryProvider =
    Provider((ref) => SessionRepository());

final sessionProvider =
    StateNotifierProvider<SessionNotifier, SessionState>((ref) {
  return SessionNotifier(ref.watch(sessionRepositoryProvider));
});
