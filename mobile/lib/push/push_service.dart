import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../auth/token_store.dart';
import '../platform/live_activity.dart' show applyLivePush;

/// Where push stands on this phone.
enum PushState {
  /// This build has no Firebase config (or is the web/demo build).
  unavailable,

  /// Not asked yet, or turned off in the app.
  off,

  /// The person declined; only the phone's Settings can change that now.
  blocked,
  on,
}

/// What a notification is about, so a tap can open it.
class PushTarget {
  const PushTarget(this.kind, this.reference, {this.documentType});
  final String kind;
  final String? reference;

  /// For `document_request`: the document KCPL asked for, such as
  /// `packing_list`. The tap opens the scanner for it.
  final String? documentType;

  static PushTarget? fromData(Map<String, dynamic> data) {
    final kind = data['kind'];
    if (kind is! String || kind.isEmpty) return null;
    final reference = data['reference'];
    final type = data['document_type'];
    return PushTarget(
      kind,
      reference is String && reference.isNotEmpty ? reference : null,
      documentType: type is String && RegExp(r'^[a-z_]{2,40}$').hasMatch(type) ? type : null,
    );
  }
}

/// A push that arrived while the app was open, for the in-app banner.
class PushNotice {
  const PushNotice({required this.title, required this.body, this.target});
  final String title;
  final String body;
  final PushTarget? target;
}

typedef RegisterDevice = Future<void> Function(String token, String platform);
typedef UnregisterDevice = Future<void> Function(String token);

/// Push for one app. The OS permission is only ever asked from an explicit
/// "Turn on", never at launch: a permission asked cold is the fastest way to
/// have it refused for good.
abstract class PushService extends ChangeNotifier {
  PushState get state;

  /// Taps on notifications, including the one that launched the app.
  Stream<PushTarget> get taps;

  /// Pushes that arrived while the app was in front.
  Stream<PushNotice> get notices;

  /// After sign-in: if this person already turned push on, re-register (a
  /// token can rotate between launches). Never prompts.
  Future<void> resume(RegisterDevice register);

  /// "Turn on": asks the OS, then registers this phone for the signed-in login.
  Future<PushState> enable(RegisterDevice register);

  /// This phone's push address while push is on, for a Live Activity to
  /// be reached through; null otherwise.
  String? get deviceToken => null;

  /// Whether the person already answered the in-app invitation ("Not now"
  /// or "Turn on"); it is never shown twice.
  bool get primerDismissed;
  Future<void> dismissPrimer();

  /// This phone stops receiving for this login. [optOut] is the person's
  /// own "Turn off", remembered across launches; signing out is not, so the
  /// next person to sign in keeps the phone's setting.
  Future<void> disable(UnregisterDevice unregister, {bool optOut = true});
}

/// For builds with no Firebase config: says so, and does nothing.
class NoPushService extends PushService {
  @override
  PushState get state => PushState.unavailable;
  @override
  Stream<PushTarget> get taps => const Stream.empty();
  @override
  Stream<PushNotice> get notices => const Stream.empty();
  @override
  Future<void> resume(RegisterDevice register) async {}
  @override
  Future<PushState> enable(RegisterDevice register) async => PushState.unavailable;
  @override
  Future<void> disable(UnregisterDevice unregister, {bool optOut = true}) async {}
  @override
  bool get primerDismissed => true;
  @override
  Future<void> dismissPrimer() async {}
}

/// A push that arrives with the app closed. Runs in a background engine of its
/// own, where the kcpl_live_updates plugin is registered too.
@pragma('vm:entry-point')
Future<void> kcplBackgroundMessage(RemoteMessage message) async {
  await applyLivePush(message.data);
}

/// Firebase Cloud Messaging. Firebase is configured natively, from
/// google-services.json (Android) and GoogleService-Info.plist (iOS); a
/// build without them reports [PushState.unavailable] instead of failing.
class FcmPushService extends PushService {
  FcmPushService._(this._messaging, this._platform, this._prefs);

  static const _optOutKey = 'kcpl.push';
  static const _primerKey = 'kcpl.push.primer';

  /// A [NoPushService] when this build cannot do push.
  static Future<PushService> create(TokenStore prefs) async {
    if (kIsWeb) return NoPushService();
    final platform = switch (defaultTargetPlatform) {
      TargetPlatform.android => 'android',
      TargetPlatform.iOS => 'ios',
      _ => null,
    };
    if (platform == null) return NoPushService();
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      // KCPL's server moves a followed shipment on the Android lock screen
      // with a data message, which must be handled with the app closed too.
      if (platform == 'android') FirebaseMessaging.onBackgroundMessage(kcplBackgroundMessage);
      final service = FcmPushService._(FirebaseMessaging.instance, platform, prefs);
      await service._listen();
      return service;
    } catch (error) {
      debugPrint('KCPL push unavailable: $error');
      return NoPushService();
    }
  }

  final FirebaseMessaging _messaging;
  final String _platform;
  final TokenStore _prefs;
  final _taps = StreamController<PushTarget>.broadcast();
  final _notices = StreamController<PushNotice>.broadcast();
  PushTarget? _launchTap;
  bool _granted = false;
  bool _blocked = false;
  bool _optedOut = false;
  bool _primerDismissed = false;
  String? _token;
  RegisterDevice? _register;

  @override
  String? get deviceToken => state == PushState.on ? _token : null;

  /// The OS permission and the person's in-app choice are separate: turning
  /// push off in the app leaves the OS permission alone.
  @override
  PushState get state => _blocked
      ? PushState.blocked
      : _granted && !_optedOut
      ? PushState.on
      : PushState.off;

  @override
  Stream<PushTarget> get taps async* {
    // The notification that launched the app is delivered to whoever listens
    // first, once.
    final launch = _launchTap;
    _launchTap = null;
    if (launch != null) yield launch;
    yield* _taps.stream;
  }

  @override
  Stream<PushNotice> get notices => _notices.stream;

  Future<void> _listen() async {
    _apply((await _messaging.getNotificationSettings()).authorizationStatus);
    _optedOut = await _prefs.read(_optOutKey) == 'off';
    _primerDismissed = await _prefs.read(_primerKey) == 'done';
    final initial = await _messaging.getInitialMessage();
    if (initial != null) _launchTap = PushTarget.fromData(initial.data);
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final target = PushTarget.fromData(message.data);
      if (target != null) _taps.add(target);
    });
    FirebaseMessaging.onMessage.listen((message) {
      // A lock screen update, not news: moved quietly, never a banner.
      if (message.data['kind'] == 'live') {
        applyLivePush(message.data).ignore();
        return;
      }
      final notification = message.notification;
      if (notification == null) return;
      _notices.add(
        PushNotice(title: notification.title ?? 'KCPL', body: notification.body ?? '', target: PushTarget.fromData(message.data)),
      );
    });
    _messaging.onTokenRefresh.listen((token) async {
      _token = token;
      final register = _register;
      if (register != null && state == PushState.on) {
        try {
          await register(token, _platform);
        } catch (_) {}
      }
    });
  }

  void _apply(AuthorizationStatus status) {
    _granted = status == AuthorizationStatus.authorized || status == AuthorizationStatus.provisional;
    _blocked = status == AuthorizationStatus.denied;
  }

  @override
  bool get primerDismissed => _primerDismissed;

  @override
  Future<void> dismissPrimer() async {
    _primerDismissed = true;
    notifyListeners();
    await _prefs.write(_primerKey, 'done');
  }

  @override
  Future<void> resume(RegisterDevice register) async {
    _register = register;
    // The person may have changed the permission in Settings meanwhile.
    _apply((await _messaging.getNotificationSettings()).authorizationStatus);
    notifyListeners();
    if (state != PushState.on) return;
    await _registerNow(register);
  }

  @override
  Future<PushState> enable(RegisterDevice register) async {
    _register = register;
    _optedOut = false;
    await _prefs.write(_optOutKey, 'on');
    if (!_granted) _apply((await _messaging.requestPermission(alert: true, badge: true, sound: true)).authorizationStatus);
    if (state == PushState.on) await _registerNow(register);
    notifyListeners();
    return state;
  }

  Future<void> _registerNow(RegisterDevice register) async {
    try {
      // iOS delivers through APNs; show foreground pushes as the in-app
      // banner rather than a system alert over the app.
      await _messaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);
      final token = _token ?? await _messaging.getToken();
      if (token == null) return;
      _token = token;
      await register(token, _platform);
    } catch (error) {
      debugPrint('KCPL push registration failed: $error');
    }
  }

  @override
  Future<void> disable(UnregisterDevice unregister, {bool optOut = true}) async {
    if (optOut) {
      _optedOut = true;
      await _prefs.write(_optOutKey, 'off');
    }
    final token = _token ?? await _messaging.getToken().catchError((_) => null);
    _register = null;
    if (token != null) {
      try {
        await unregister(token);
      } catch (_) {}
    }
    // A fresh token next time, so nothing addressed to this login can reach
    // whoever signs in on this phone next.
    try {
      await _messaging.deleteToken();
    } catch (_) {}
    _token = null;
    notifyListeners();
  }
}
