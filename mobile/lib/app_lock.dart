import 'package:clock/clock.dart';
import 'package:flutter/widgets.dart';

import 'auth/token_store.dart';
import 'platform/device_unlock.dart';

/// Face ID for KCPL, off until the person turns it on. When on, the app
/// asks for it at launch and after a minute away, and covers itself in the
/// app switcher so a glance at someone's phone shows no invoices.
class AppLock extends ChangeNotifier with WidgetsBindingObserver {
  AppLock({required this.prefs, this.device = const NoDeviceUnlock()});

  final TokenStore prefs;
  final DeviceUnlock device;

  static const _key = 'kcpl.lock';

  /// Back within this, and no unlock is asked for: a glance at a message
  /// should not cost a Face ID.
  static const grace = Duration(minutes: 1);

  UnlockMethod? _method;
  UnlockMethod? get method => _method;

  bool _enabled = false;
  bool get enabled => _enabled;

  bool _locked = false;
  bool get locked => _locked;

  /// Showing the cover while the app is not in front.
  bool _covered = false;
  bool get covered => _covered;

  DateTime? _away;

  /// The system's Face ID sheet sends the app inactive and back; that is
  /// not leaving the app.
  bool _asking = false;

  bool _observing = false;

  /// Reads the setting; [signedIn] locks at once, as a cold start should.
  Future<void> load({required bool signedIn}) async {
    _method = await device.method();
    _enabled = _method != null && await prefs.read(_key) == 'on';
    _locked = _enabled && signedIn;
    if (!_observing) {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    }
    notifyListeners();
  }

  /// Turning it on asks for the unlock first, so it is never switched on by
  /// someone who could not then get back in.
  Future<bool> setEnabled(bool on, String reason) async {
    if (on && !await _ask(reason)) return false;
    _enabled = on;
    if (on) {
      await prefs.write(_key, 'on');
    } else {
      await prefs.delete(_key);
    }
    notifyListeners();
    return true;
  }

  Future<bool> unlock(String reason) async {
    if (!_locked) return true;
    final ok = await _ask(reason);
    if (ok) {
      _locked = false;
      _covered = false;
      notifyListeners();
    }
    return ok;
  }

  Future<bool> _ask(String reason) async {
    _asking = true;
    try {
      return await device.unlock(reason);
    } finally {
      _asking = false;
      _away = null;
    }
  }

  /// Signing out ends the lock with the session. The setting belongs to the
  /// person who chose it, so the next one to sign in starts without it.
  Future<void> reset() async {
    _locked = false;
    _covered = false;
    _enabled = false;
    _away = null;
    await prefs.delete(_key);
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_enabled || _asking) return;
    switch (state) {
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        _away ??= clock.now();
        if (!_covered) {
          _covered = true;
          notifyListeners();
        }
      case AppLifecycleState.resumed:
        final away = _away;
        _away = null;
        if (away != null && clock.now().difference(away) >= grace) _locked = true;
        _covered = false;
        notifyListeners();
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  void dispose() {
    if (_observing) WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
