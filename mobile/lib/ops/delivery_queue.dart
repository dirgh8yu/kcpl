import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:path_provider/path_provider.dart';

import '../api/kcpl_api.dart' show ApiException;
import '../api/models.dart' show Attachment;
import '../auth/auth_repository.dart' show SignedOutException;
import 'ops_api.dart';

/// A delivery recorded where there was no signal: the attempt (if it could
/// not even be started), the outcome and the proof, kept on the phone and
/// sent in that order once KCPL can be reached. Each step that lands is
/// written off, so a signal lost halfway resumes where it stopped and never
/// sends a step twice.
class QueuedDelivery {
  const QueuedDelivery({
    required this.id,
    required this.owner,
    required this.reference,
    required this.recordedAt,
    required this.status,
    this.attemptId,
    this.driverName = '',
    this.recipientName = '',
    this.recipientRelation = '',
    this.recipientPhone = '',
    this.failureReason = '',
    this.latitude,
    this.longitude,
    this.outcomeSent = false,
    this.evidence = const [],
    this.refusal,
  });

  final String id;

  /// The login that recorded it. Only that login sees or sends it.
  final String owner;
  final String reference;

  /// When it happened. KCPL records this time, not the time it was sent.
  final DateTime recordedAt;

  /// delivered, failed or refused.
  final String status;

  /// Null when the attempt itself was started without signal.
  final String? attemptId;
  final String driverName;
  final String recipientName;
  final String recipientRelation;
  final String recipientPhone;
  final String failureReason;
  final double? latitude;
  final double? longitude;

  /// The outcome is on KCPL's side; only proof is left to send.
  final bool outcomeSent;

  /// Signature and photos still to send, as (kind, file).
  final List<(String, Attachment)> evidence;

  /// KCPL refused a step (not a signal problem): shown so the person can act.
  final String? refusal;

  bool get delivered => status == 'delivered';

  QueuedDelivery copyWith({String? attemptId, bool? outcomeSent, List<(String, Attachment)>? evidence, String? refusal}) => QueuedDelivery(
    id: id,
    owner: owner,
    reference: reference,
    recordedAt: recordedAt,
    status: status,
    attemptId: attemptId ?? this.attemptId,
    driverName: driverName,
    recipientName: recipientName,
    recipientRelation: recipientRelation,
    recipientPhone: recipientPhone,
    failureReason: failureReason,
    latitude: latitude,
    longitude: longitude,
    outcomeSent: outcomeSent ?? this.outcomeSent,
    evidence: evidence ?? this.evidence,
    refusal: refusal ?? this.refusal,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'owner': owner,
    'reference': reference,
    'recordedAt': recordedAt.toUtc().toIso8601String(),
    'status': status,
    'attemptId': attemptId,
    'driverName': driverName,
    'recipientName': recipientName,
    'recipientRelation': recipientRelation,
    'recipientPhone': recipientPhone,
    'failureReason': failureReason,
    'latitude': latitude,
    'longitude': longitude,
    'outcomeSent': outcomeSent,
    'refusal': refusal,
    'evidence': [
      for (final (kind, file) in evidence)
        {'kind': kind, 'filename': file.filename, 'contentType': file.contentType, 'bytes': base64Encode(file.bytes)},
    ],
  };

  static QueuedDelivery? fromJson(Map<String, dynamic> j) {
    try {
      return QueuedDelivery(
        id: j['id'] as String,
        owner: j['owner'] as String,
        reference: j['reference'] as String,
        recordedAt: DateTime.parse(j['recordedAt'] as String),
        status: j['status'] as String,
        attemptId: j['attemptId'] as String?,
        driverName: j['driverName'] as String? ?? '',
        recipientName: j['recipientName'] as String? ?? '',
        recipientRelation: j['recipientRelation'] as String? ?? '',
        recipientPhone: j['recipientPhone'] as String? ?? '',
        failureReason: j['failureReason'] as String? ?? '',
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        outcomeSent: j['outcomeSent'] == true,
        refusal: j['refusal'] as String?,
        evidence: [
          for (final e in (j['evidence'] as List? ?? const []).whereType<Map>())
            (
              e['kind'] as String,
              Attachment(filename: e['filename'] as String, contentType: e['contentType'] as String, bytes: base64Decode(e['bytes'] as String)),
            ),
        ],
      );
    } catch (_) {
      return null;
    }
  }
}

abstract class DeliveryQueueStore {
  Future<List<QueuedDelivery>> load();
  Future<void> save(List<QueuedDelivery> deliveries);
}

class MemoryDeliveryQueueStore implements DeliveryQueueStore {
  List<QueuedDelivery> saved = [];

  @override
  Future<List<QueuedDelivery>> load() async => [...saved];

  @override
  Future<void> save(List<QueuedDelivery> deliveries) async => saved = [...deliveries];
}

/// One file in the app's private storage, written beside and renamed.
class FileDeliveryQueueStore implements DeliveryQueueStore {
  FileDeliveryQueueStore([Future<Directory> Function()? root]) : _root = root ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _root;

  Future<File> _file() async => File('${(await _root()).path}/kcpl-outbox/deliveries.json');

  @override
  Future<List<QueuedDelivery>> load() async {
    try {
      final file = await _file();
      if (!await file.exists()) return [];
      final rows = jsonDecode(await file.readAsString()) as List;
      return rows.whereType<Map>().map((e) => QueuedDelivery.fromJson(e.cast<String, dynamic>())).whereType<QueuedDelivery>().toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> save(List<QueuedDelivery> deliveries) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    final temp = File('${file.path}.part');
    await temp.writeAsString(jsonEncode([for (final d in deliveries) d.toJson()]), flush: true);
    await temp.rename(file.path);
  }
}

/// The outbox for deliveries, alongside the one for notes (NoteQueue): tried
/// again on returning to the app and every [retryEvery] while anything waits.
class DeliveryQueue extends ChangeNotifier {
  DeliveryQueue({DeliveryQueueStore? store, this.retryEvery = const Duration(seconds: 45)}) : _store = store ?? MemoryDeliveryQueueStore();

  final DeliveryQueueStore _store;
  final Duration retryEvery;

  List<QueuedDelivery> _items = [];
  String? _owner;
  OpsApi? _api;
  Timer? _timer;
  AppLifecycleListener? _lifecycle;
  bool _sending = false;

  bool get ready => _owner != null;

  List<QueuedDelivery> get waiting => _items.where((d) => d.owner == _owner).toList();

  QueuedDelivery? waitingFor(String reference) => waiting.where((d) => d.reference == reference).firstOrNull;

  Future<void> attach(OpsApi api, String owner) async {
    _api = api;
    _owner = owner.toLowerCase();
    _items = await _store.load();
    _lifecycle ??= AppLifecycleListener(onResume: () => flush().ignore());
    notifyListeners();
    await flush();
  }

  void detach() {
    _api = null;
    _owner = null;
    _timer?.cancel();
    _timer = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    notifyListeners();
  }

  /// Keeps a delivery to send. [build] gets the id and owner to stamp on it.
  Future<QueuedDelivery> add(QueuedDelivery Function(String id, String owner) build) async {
    final owner = _owner;
    if (owner == null) throw StateError('No one is signed in.');
    final delivery = build('d-${DateTime.now().microsecondsSinceEpoch}', owner);
    // One pending delivery per job: a newer record replaces an older one.
    _items = [..._items.where((d) => !(d.owner == owner && d.reference == delivery.reference)), delivery];
    await _save();
    _schedule();
    return delivery;
  }

  Future<void> discard(String id) async {
    _items = _items.where((d) => d.id != id).toList();
    await _save();
    _schedule();
  }

  Future<void> _save() async {
    await _store.save(_items);
    notifyListeners();
  }

  void _replace(QueuedDelivery next) => _items = [for (final d in _items) d.id == next.id ? next : d];

  /// Sends what is waiting, step by step. Stops at the first sign there is
  /// still no signal; true when a delivery went through completely.
  Future<bool> flush() async {
    final api = _api;
    if (api == null || _sending) return false;
    _sending = true;
    var done = false;
    try {
      for (var item in waiting.where((d) => d.refusal == null)) {
        try {
          if (item.attemptId == null) {
            final attempt = await api.startDelivery(item.reference, driverName: item.driverName, at: item.recordedAt);
            item = item.copyWith(attemptId: attempt.id);
            _replace(item);
            await _save();
          }
          if (!item.outcomeSent) {
            await api.recordDelivery(
              item.reference,
              item.attemptId!,
              status: item.status,
              recipientName: item.recipientName,
              recipientRelation: item.recipientRelation,
              recipientPhone: item.recipientPhone,
              failureReason: item.failureReason,
              latitude: item.latitude,
              longitude: item.longitude,
              at: item.recordedAt,
            );
            item = item.copyWith(outcomeSent: true);
            _replace(item);
            await _save();
          }
          while (item.evidence.isNotEmpty) {
            final (kind, file) = item.evidence.first;
            await api.addPodEvidence(item.reference, item.attemptId!, kind, file, capturedAt: item.recordedAt);
            item = item.copyWith(evidence: item.evidence.sublist(1));
            _replace(item);
            await _save();
          }
          _items = _items.where((d) => d.id != item.id).toList();
          await _save();
          done = true;
        } on ApiException catch (error) {
          if (error.code == 'network' || error.status >= 500) break;
          _replace(item.copyWith(refusal: error.message.isEmpty ? 'KCPL did not accept this delivery.' : error.message));
          await _save();
        } on SignedOutException {
          break;
        }
      }
    } finally {
      _sending = false;
      _schedule();
    }
    return done;
  }

  void _schedule() {
    final pending = _api != null && waiting.any((d) => d.refusal == null);
    if (!pending) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(retryEvery, (_) => flush().ignore());
    }
  }

  @override
  void dispose() {
    detach();
    super.dispose();
  }
}
