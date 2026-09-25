import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// What a Live Activity shows. The same four fields the server sends in its
/// push updates (app/mobile-push-policy.ts, liveActivityState), so the
/// lock screen looks the same whether the phone or KCPL last moved it.
class LiveShipmentState {
  const LiveShipmentState({required this.status, required this.detail, required this.progress, required this.attention});
  final String status;
  final String detail;
  final double progress;
  final bool attention;

  Map<String, Object> toMap() => {'status': status, 'detail': detail, 'progress': progress, 'attention': attention};
}

/// A started activity: its id on the phone and the push token KCPL updates
/// it through.
class LiveActivityHandle {
  const LiveActivityHandle({required this.id, required this.reference, this.pushToken});
  final String id;
  final String reference;
  final String? pushToken;
}

/// A shipment on the Lock Screen and in the Dynamic Island (iOS 16.2+), or
/// as an ongoing progress notification on Android (a Live Update on Android
/// 16; MainActivity's LiveShipmentNotifications). Swapped in tests.
abstract class LiveActivities {
  static LiveActivities current = switch (defaultTargetPlatform) {
    TargetPlatform.iOS || TargetPlatform.android => const ChannelLiveActivities(),
    _ => const NoLiveActivities(),
  };

  /// Android shows it as a notification, so its words say so; iOS says Lock
  /// Screen. Swapped in tests alongside [current].
  static bool asNotification = defaultTargetPlatform == TargetPlatform.android;

  /// False on Android, before iOS 16.2, or when turned off in Settings.
  Future<bool> supported();

  /// The activities running now, by shipment.
  Future<List<LiveActivityHandle>> running();

  /// [channel] names Android's notification channel, in the reader's language.
  Future<LiveActivityHandle?> start({required String reference, required String route, required LiveShipmentState state, String? channel});
  Future<void> update(String id, LiveShipmentState state);
  Future<void> end(String id);
}

class NoLiveActivities implements LiveActivities {
  const NoLiveActivities();
  @override
  Future<bool> supported() async => false;
  @override
  Future<List<LiveActivityHandle>> running() async => const [];
  @override
  Future<LiveActivityHandle?> start({
    required String reference,
    required String route,
    required LiveShipmentState state,
    String? channel,
  }) async => null;
  @override
  Future<void> update(String id, LiveShipmentState state) async {}
  @override
  Future<void> end(String id) async {}
}

/// ActivityKit through AppDelegate.swift ("kcpl/live_activity").
class ChannelLiveActivities implements LiveActivities {
  const ChannelLiveActivities();
  static const _channel = MethodChannel('kcpl/live_activity');

  LiveActivityHandle _handle(Map<Object?, Object?> row) =>
      LiveActivityHandle(id: '${row['id']}', reference: '${row['reference']}', pushToken: row['token'] as String?);

  @override
  Future<bool> supported() async {
    try {
      return await _channel.invokeMethod<bool>('supported') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  @override
  Future<List<LiveActivityHandle>> running() async {
    try {
      final rows = await _channel.invokeListMethod<Map<Object?, Object?>>('running') ?? const [];
      return rows.map(_handle).toList();
    } on MissingPluginException {
      return const [];
    }
  }

  @override
  Future<LiveActivityHandle?> start({
    required String reference,
    required String route,
    required LiveShipmentState state,
    String? channel,
  }) async {
    final row = await _channel.invokeMapMethod<Object?, Object?>('start', {
      'reference': reference,
      'route': route,
      'channel': ?channel,
      ...state.toMap(),
    });
    return row == null ? null : _handle(row);
  }

  @override
  Future<void> update(String id, LiveShipmentState state) => _channel.invokeMethod('update', {'id': id, ...state.toMap()});

  @override
  Future<void> end(String id) => _channel.invokeMethod('end', {'id': id});
}

/// A "live" data message from KCPL's server (androidLiveData in
/// app/mobile-push-policy.ts): moves the Android follow, or ends it on
/// delivery, whether or not the app is open. Only a follow still showing is
/// moved; one the person swiped away stays gone. True when [data] was one.
Future<bool> applyLivePush(Map<String, dynamic> data) async {
  if (data['kind'] != 'live') return false;
  final reference = data['reference'];
  if (reference is! String || reference.isEmpty) return true;
  try {
    await const MethodChannel('kcpl/live_activity').invokeMethod<void>('push', {
      'reference': reference,
      'end': data['event'] == 'end',
      'status': '${data['status'] ?? ''}',
      'detail': '${data['detail'] ?? ''}',
      'progress': double.tryParse('${data['progress']}') ?? 0,
      'attention': data['attention'] == '1',
    });
  } on MissingPluginException {
    // Not on this platform or build.
  } on PlatformException {
    // Notifications off: the lock screen is a courtesy.
  }
  return true;
}
