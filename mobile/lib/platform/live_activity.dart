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

/// A shipment on the Lock Screen and in the Dynamic Island (iOS 16.2+).
/// Swapped in tests; elsewhere it reports itself unsupported.
abstract class LiveActivities {
  static LiveActivities current = defaultTargetPlatform == TargetPlatform.iOS ? const ChannelLiveActivities() : const NoLiveActivities();

  /// False on Android, before iOS 16.2, or when turned off in Settings.
  Future<bool> supported();

  /// The activities running now, by shipment.
  Future<List<LiveActivityHandle>> running();
  Future<LiveActivityHandle?> start({required String reference, required String route, required LiveShipmentState state});
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
  Future<LiveActivityHandle?> start({required String reference, required String route, required LiveShipmentState state}) async => null;
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
  Future<LiveActivityHandle?> start({required String reference, required String route, required LiveShipmentState state}) async {
    final row = await _channel.invokeMapMethod<Object?, Object?>('start', {'reference': reference, 'route': route, ...state.toMap()});
    return row == null ? null : _handle(row);
  }

  @override
  Future<void> update(String id, LiveShipmentState state) => _channel.invokeMethod('update', {'id': id, ...state.toMap()});

  @override
  Future<void> end(String id) => _channel.invokeMethod('end', {'id': id});
}
