import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:quick_actions/quick_actions.dart';

/// The three things people open the app to do, one step from the home
/// screen: long-press the icon (both platforms), or ask Siri, Spotlight or
/// the Shortcuts app (iOS App Shortcuts, in AppDelegate.swift).
abstract final class Shortcut {
  static const track = 'track';
  static const quote = 'quote';
  static const pay = 'pay';
}

abstract class AppShortcuts {
  /// The shortcut chosen and not yet acted on. Kept until the home screen is
  /// ready for it, since a shortcut can be what launched the app, before
  /// sign-in or Face ID.
  ValueListenable<String?> get pending;

  /// Marks [pending] as handled.
  void consume();

  /// The icon's long-press menu, in the reader's language. A null title
  /// leaves that one out (a login that can't see invoices has no "Pay").
  Future<void> offer({String? track, String? quote, String? pay});
  Future<void> clear();
}

class NoAppShortcuts implements AppShortcuts {
  NoAppShortcuts();
  final _pending = ValueNotifier<String?>(null);

  @override
  ValueListenable<String?> get pending => _pending;

  /// For tests: as if the shortcut had been chosen.
  void choose(String action) => _pending.value = action;

  @override
  void consume() => _pending.value = null;

  List<String> offered = const [];

  @override
  Future<void> offer({String? track, String? quote, String? pay}) async => offered = [?track, ?quote, ?pay];

  @override
  Future<void> clear() async => offered = const [];
}

class DeviceAppShortcuts implements AppShortcuts {
  DeviceAppShortcuts() {
    _quick.initialize(_choose).catchError((Object _) {});
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      _channel.setMethodCallHandler((call) async {
        if (call.method == 'ready') await _take();
      });
      _take();
    }
  }

  static const _channel = MethodChannel('kcpl/shortcuts');
  final _quick = const QuickActions();
  final _pending = ValueNotifier<String?>(null);

  void _choose(String? action) {
    if (action == Shortcut.track || action == Shortcut.quote || action == Shortcut.pay) _pending.value = action;
  }

  Future<void> _take() async {
    try {
      _choose(await _channel.invokeMethod<String>('take'));
    } on MissingPluginException {
      // Not on this platform or build.
    } on PlatformException {
      // Nothing waiting.
    }
  }

  @override
  ValueListenable<String?> get pending => _pending;

  @override
  void consume() => _pending.value = null;

  @override
  Future<void> offer({String? track, String? quote, String? pay}) async {
    try {
      await _quick.setShortcutItems([
        if (track != null) ShortcutItem(type: Shortcut.track, localizedTitle: track),
        if (quote != null) ShortcutItem(type: Shortcut.quote, localizedTitle: quote),
        if (pay != null) ShortcutItem(type: Shortcut.pay, localizedTitle: pay),
      ]);
    } catch (_) {
      // A convenience; never a failure of the app.
    }
  }

  @override
  Future<void> clear() async {
    try {
      await _quick.clearShortcutItems();
    } catch (_) {}
  }
}
