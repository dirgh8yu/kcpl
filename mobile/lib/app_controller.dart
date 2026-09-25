import 'package:flutter/widgets.dart';

import 'api/kcpl_api.dart';
import 'api/models.dart';
import 'auth/auth_repository.dart';
import 'auth/social_sign_in.dart';
import 'auth/token_store.dart';
import 'push/push_service.dart';
import 'session_host.dart';

enum AppStatus { starting, unconfigured, signedOut, signedIn }

/// App-wide state: who is signed in, which customer they are looking at, and
/// which language. Screens load their own data; they listen here only to
/// know when to reload (customer switched) or leave (signed out).
class AppController extends SessionHost {
  AppController({
    required this.auth,
    required this.api,
    required this.prefs,
    required bool configured,
    PushService? push,
    this.social = SocialSignIn.none,
  }) : push = push ?? NoPushService(),
       _status = configured ? AppStatus.starting : AppStatus.unconfigured;

  @override
  final SocialSignIn social;

  @override
  final PushService push;

  @override
  Future<PushState> enablePush() => push.enable(api.registerPush);

  @override
  Future<void> disablePush() => push.disable(api.unregisterPush);

  /// Re-registers this phone for the signed-in login when push is on. Never
  /// holds up the screen: registration happens behind it.
  void _resumePush() => push.resume(api.registerPush).ignore();

  @override
  final AuthRepository auth;
  final KcplApi api;

  /// Non-secret preferences share the secure store rather than adding a
  /// second storage package for two short strings.
  final TokenStore prefs;

  static const _customerKey = 'kcpl.customer';
  static const _localeKey = 'kcpl.locale';

  AppStatus _status;
  AppStatus get status => _status;

  SessionView? _session;
  SessionView? get session => _session;

  @override
  bool sessionEnded = false;

  @override
  bool get multilingual => true;

  Locale? _locale;
  Locale? get locale => _locale;

  /// Bumped when the customer changes, so every open screen refetches.
  int _generation = 0;
  @override
  int get generation => _generation;

  Future<void> start() async {
    if (_status == AppStatus.unconfigured) return;
    final saved = await prefs.read(_localeKey);
    if (saved == 'en' || saved == 'ne') _locale = Locale(saved!);
    api.customerId = await prefs.read(_customerKey);
    if (!await auth.restore()) {
      _set(AppStatus.signedOut);
      return;
    }
    try {
      await _loadSession();
      _set(AppStatus.signedIn);
      _resumePush();
    } on SignedOutException {
      _set(AppStatus.signedOut);
    } on ApiException catch (error) {
      if (error.code == 'denied') {
        // KCPL withdrew this login's portal access since the last launch.
        await auth.signOut();
        _set(AppStatus.signedOut);
        return;
      }
      _set(AppStatus.signedIn);
      _resumePush();
    } catch (_) {
      // Offline at launch is not signed out. Screens show their own retry.
      _set(AppStatus.signedIn);
      _resumePush();
    }
  }

  @override
  Future<void> signIn(String email, String password, {IdpCredential? link}) async {
    await auth.signIn(email, password);
    if (link != null) await auth.link(link);
    await _enter();
  }

  @override
  Future<void> signInWithProvider(IdpCredential credential) async {
    await auth.signInWithIdp(credential);
    await _enter();
  }

  /// Firebase has accepted the person; now KCPL must.
  Future<void> _enter() async {
    try {
      await _loadSession();
    } catch (_) {
      // Firebase accepted the password but KCPL refused the login (no portal
      // access, unverified email) or is unreachable. Leave nothing behind.
      await auth.signOut();
      rethrow;
    }
    sessionEnded = false;
    _set(AppStatus.signedIn);
    _resumePush();
  }

  Future<void> _loadSession() async {
    final session = await api.session();
    _session = session;
    // The server resolved the customer; remember what it actually chose.
    api.customerId = session.customerId;
    _locale ??= Locale(session.locale == 'ne' ? 'ne' : 'en');
  }

  /// Keeps the header and tab set in step with what the server last said.
  void updateSession(SessionView session) {
    _session = session;
    notifyListeners();
  }

  Future<void> switchCustomer(String customerId) async {
    final previous = api.customerId;
    api.customerId = customerId;
    try {
      await _loadSession();
    } catch (_) {
      api.customerId = previous;
      rethrow;
    }
    await prefs.write(_customerKey, _session!.customerId);
    _generation++;
    notifyListeners();
  }

  @override
  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    await prefs.write(_localeKey, locale.languageCode);
    notifyListeners();
  }

  @override
  Future<void> signOut() async {
    // While the login is still valid: this phone stops receiving its pushes.
    try {
      await push.disable(api.unregisterPush, optOut: false);
    } catch (_) {}
    await auth.signOut();
    await prefs.delete(_customerKey);
    api.customerId = null;
    _session = null;
    _set(AppStatus.signedOut);
  }

  @override
  Future<void> expire() async {
    if (_status != AppStatus.signedIn) return;
    sessionEnded = true;
    await signOut();
  }

  void _set(AppStatus status) {
    _status = status;
    notifyListeners();
  }
}

/// Makes the controller reachable from any screen without a state package.
class AppScope extends InheritedNotifier<AppController> {
  const AppScope({super.key, required AppController controller, required super.child}) : super(notifier: controller);

  static AppController of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  static AppController read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
