import 'package:flutter/widgets.dart';

import '../api/kcpl_api.dart' show ApiException;
import '../auth/auth_repository.dart';
import '../push/push_service.dart';
import '../session_host.dart';
import 'ops_api.dart';
import 'ops_models.dart';

enum OpsStatus { starting, unconfigured, signedOut, signedIn }

/// The staff app's state: who is signed in and their role and branches.
class OpsController extends SessionHost {
  OpsController({required this.auth, required this.api, required bool configured, PushService? push})
    : push = push ?? NoPushService(),
      _status = configured ? OpsStatus.starting : OpsStatus.unconfigured;

  @override
  final PushService push;

  @override
  Future<PushState> enablePush() => push.enable(api.registerPush);

  @override
  Future<void> disablePush() => push.disable(api.unregisterPush);

  /// Re-registers this phone for the signed-in login when push is on.
  void _resumePush() => push.resume(api.registerPush).ignore();

  @override
  final AuthRepository auth;
  final OpsApi api;

  OpsStatus _status;
  OpsStatus get status => _status;

  OpsSession? _session;
  OpsSession? get session => _session;

  /// Unread alerts, for the tab badge. Refreshed whenever Today or Alerts loads.
  int unread = 0;

  @override
  bool sessionEnded = false;

  @override
  int get generation => 0;

  @override
  bool get multilingual => false;

  @override
  Future<void> setLocale(Locale locale) async {}

  Future<void> start() async {
    if (_status == OpsStatus.unconfigured) return;
    if (!await auth.restore()) return _set(OpsStatus.signedOut);
    try {
      _session = await api.session();
      _set(OpsStatus.signedIn);
      _resumePush();
    } on SignedOutException {
      _set(OpsStatus.signedOut);
    } on ApiException catch (error) {
      if (error.code == 'denied') {
        await auth.signOut();
        return _set(OpsStatus.signedOut);
      }
      _set(OpsStatus.signedIn);
      _resumePush();
    } catch (_) {
      _set(OpsStatus.signedIn);
      _resumePush();
    }
  }

  @override
  Future<void> signIn(String email, String password, {IdpCredential? link}) async {
    await auth.signIn(email, password);
    try {
      _session = await api.session();
    } catch (_) {
      // Firebase accepted the password but KCPL does not know this login as
      // staff. Leave nothing behind.
      await auth.signOut();
      rethrow;
    }
    sessionEnded = false;
    _set(OpsStatus.signedIn);
    _resumePush();
  }

  void updateSession(OpsSession session) {
    _session = session;
    notifyListeners();
  }

  void setUnread(int count) {
    if (count == unread) return;
    unread = count;
    notifyListeners();
  }

  @override
  Future<void> signOut() async {
    // While the login is still valid: this phone stops receiving its pushes.
    try {
      await push.disable(api.unregisterPush, optOut: false);
    } catch (_) {}
    await auth.signOut();
    _session = null;
    unread = 0;
    _set(OpsStatus.signedOut);
  }

  @override
  Future<void> expire() async {
    if (_status != OpsStatus.signedIn) return;
    sessionEnded = true;
    await signOut();
  }

  void _set(OpsStatus status) {
    _status = status;
    notifyListeners();
  }
}

class OpsScope extends InheritedNotifier<OpsController> {
  const OpsScope({super.key, required OpsController controller, required super.child}) : super(notifier: controller);

  static OpsController of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<OpsScope>()!.notifier!;
  static OpsController read(BuildContext context) => context.getInheritedWidgetOfExactType<OpsScope>()!.notifier!;
}
