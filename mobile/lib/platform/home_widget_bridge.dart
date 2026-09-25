import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

import '../api/models.dart';

/// What the home and lock screen widget shows: the one shipment worth a
/// glance, already in the reader's language. The widget itself is native
/// (android/app/src/customer, ios/KCPLWidget) and only draws these fields.
@immutable
class WidgetSnapshot {
  const WidgetSnapshot({
    required this.reference,
    required this.route,
    required this.status,
    required this.detail,
    required this.progress,
    required this.attention,
    required this.summary,
  });

  final String reference;

  /// "Kolkata – Birgunj ICD".
  final String route;
  final String status;

  /// "Expected 28 Sep 2026", or where it is now.
  final String detail;

  /// How far along, 0 to 1.
  final double progress;

  /// Something has gone wrong: the widget shows it in crimson.
  final bool attention;

  /// "4 shipments on the way".
  final String summary;

  Map<String, Object> toFields() => {
    'kcpl_reference': reference,
    'kcpl_route': route,
    'kcpl_status': status,
    'kcpl_detail': detail,
    'kcpl_progress': (progress.clamp(0, 1) * 100).round(),
    'kcpl_attention': attention,
    'kcpl_summary': summary,
    'kcpl_updated': DateTime.now().toUtc().toIso8601String(),
  };
}

/// The shipment a glance should be about: one in trouble first, then the
/// next to arrive, then the most recently moved.
Shipment? leadShipment(List<Shipment> shipments) {
  final active = shipments.where((s) => !s.delivered).toList();
  if (active.isEmpty) return null;
  final trouble = active.where((s) => s.status == 'exception').toList();
  if (trouble.isNotEmpty) return trouble.first;
  final dated = active.where((s) => s.eta != null).toList()..sort((a, b) => a.eta!.compareTo(b.eta!));
  if (dated.isNotEmpty) return dated.first;
  return (active..sort((a, b) => b.updatedAt.compareTo(a.updatedAt))).first;
}

abstract class HomeWidgetBridge {
  const HomeWidgetBridge();

  /// Replaces what the widget shows. Null shows "nothing on the way".
  Future<void> publish(WidgetSnapshot? snapshot, {required String emptyTitle});

  /// Signing out empties the widget: the next person must not see it.
  Future<void> clear();

  /// Shipments opened from the widget: the one it launched the app with,
  /// then any tapped while the app is running.
  Stream<String> get opened;
}

class NoHomeWidget extends HomeWidgetBridge {
  const NoHomeWidget();
  @override
  Future<void> publish(WidgetSnapshot? snapshot, {required String emptyTitle}) async {}
  @override
  Future<void> clear() async {}
  @override
  Stream<String> get opened => const Stream.empty();
}

/// The real widget. On iOS the app and the widget extension share data
/// through an App Group; see mobile/README.md for the one-time Xcode setup.
class DeviceHomeWidget extends HomeWidgetBridge {
  const DeviceHomeWidget();

  static const appGroup = 'group.np.com.kapileshworcargo.kcpl';
  static const _android = 'KcplShipmentWidget';
  static const _ios = 'KCPLWidget';

  Future<void> _save(Map<String, Object?> fields) async {
    try {
      await HomeWidget.setAppGroupId(appGroup);
      for (final entry in fields.entries) {
        await HomeWidget.saveWidgetData<Object>(entry.key, entry.value);
      }
      await HomeWidget.updateWidget(androidName: _android, iOSName: _ios);
    } catch (_) {
      // No widget placed, or no App Group yet on iOS: the app is unaffected.
    }
  }

  @override
  Future<void> publish(WidgetSnapshot? snapshot, {required String emptyTitle}) => _save(
    snapshot?.toFields() ??
        {
          'kcpl_reference': null,
          'kcpl_route': emptyTitle,
          'kcpl_status': '',
          'kcpl_detail': '',
          'kcpl_progress': 0,
          'kcpl_attention': false,
          'kcpl_summary': '',
          'kcpl_updated': DateTime.now().toUtc().toIso8601String(),
        },
  );

  @override
  Future<void> clear() => _save({
    for (final key in [
      'kcpl_reference',
      'kcpl_route',
      'kcpl_status',
      'kcpl_detail',
      'kcpl_progress',
      'kcpl_attention',
      'kcpl_summary',
      'kcpl_updated',
    ])
      key: null,
  });

  /// "kcpl://shipment/KCPL-S-24091" from a tap on the widget.
  static String? _reference(Uri? uri) =>
      uri != null && uri.host == 'shipment' && uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;

  @override
  Stream<String> get opened async* {
    try {
      final first = _reference(await HomeWidget.initiallyLaunchedFromHomeWidget());
      if (first != null) yield first;
      await for (final uri in HomeWidget.widgetClicked) {
        final reference = _reference(uri);
        if (reference != null) yield reference;
      }
    } catch (_) {}
  }
}
