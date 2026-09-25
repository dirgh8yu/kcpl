import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;

import '../api/kcpl_api.dart' show ApiException;
import '../api/models.dart' show Attachment, SendProgress;
import '../api/offline_cache.dart';
import '../api/upload.dart';
import '../auth/auth_repository.dart';
import 'ops_models.dart';

abstract class OpsApi {
  Future<OpsSession> session();
  Future<TodayBundle> today();
  Future<JobFile> job(String reference);
  Future<void> setTask(String reference, String taskId, bool completed);
  Future<void> setCustomsStep(String reference, String stepId, bool completed);
  Future<AlertsPage> alerts();
  Future<void> markRead(String alertId);

  /// A note, a photo, or both, on a job. [documentType] files the photo in
  /// the job's vault; "other" unless said.
  Future<FieldNote> addNote(
    String reference, {
    String text = '',
    Attachment? photo,
    String documentType = 'other',
    SendProgress? onProgress,
  });

  /// Jobs in the caller's branches that a scanned or typed identifier means.
  Future<List<ScanMatch>> lookup(String query);

  /// Delivery Control for a job: its attempts and where POD stands.
  Future<DeliveryControl> delivery(String reference);

  /// Opens an attempt and sets it out for delivery, [at] now unless said.
  Future<DeliveryAttempt> startDelivery(String reference, {String driverName = '', String vehicle = '', DateTime? at});

  /// How an attempt ended. [status] is delivered, failed or refused. A
  /// delivered outcome never makes the shipment Delivered by itself: POD is
  /// verified at the desk first.
  Future<DeliveryOutcome> recordDelivery(
    String reference,
    String attemptId, {
    required String status,
    String recipientName = '',
    String recipientRelation = '',
    String recipientPhone = '',
    String failureReason = '',
    double? latitude,
    double? longitude,
    String notes = '',
    DateTime? at,
  });

  /// A signature, photo or document against a delivered attempt. [kind] is
  /// signature, photo or document.
  Future<PodEvidence> addPodEvidence(
    String reference,
    String attemptId,
    String kind,
    Attachment file, {
    DateTime? capturedAt,
    SendProgress? onProgress,
  });

  /// Who a job can be given to.
  Future<List<StaffOption>> staff();

  /// A task on the job. [dueAt] is Nepal wall-clock time, "2026-09-25T17:00".
  Future<void> addTask(String reference, {required String title, required String branch, String dueAt = '', String detail = '', StaffOption? assignee});

  Future<void> reassign(String reference, StaffOption owner);

  /// Throws [CloseoutBlocked] while something still stands in the way.
  Future<void> closeJob(String reference, {String overrideReason = ''});
  Future<void> registerPush(String token, String platform);
  Future<void> unregisterPush(String token);

  /// Today's deliveries in the caller's branches, theirs first.
  Future<DriverDay> deliveries();

  /// Removes what was kept on the phone for offline use. At sign-out.
  Future<void> forget() async {}
}

/// [OpsApi] over `/api/mobile/ops/v1`. Same retry rule as the customer app:
/// a 401 is retried once with a forced token refresh, then signs out.
class HttpOpsApi implements OpsApi {
  HttpOpsApi({required this.base, required this.auth, http.Client? client, this.cache}) : _client = client ?? http.Client();

  final Uri base;
  final AuthRepository auth;
  final http.Client _client;

  /// The last answer to each read, for when there is no signal. Kept for the
  /// signed-in login only and deleted at sign-out.
  final OfflineCache? cache;

  /// A read. Only a failure to reach KCPL falls back to the kept answer, and
  /// the screen is told how old it is; a refusal is never papered over.
  Future<Map<String, dynamic>> _read(String path) async {
    try {
      final body = await _send(path);
      unawaited(cache?.write(path, jsonEncode(body)));
      return body;
    } on ApiException catch (error) {
      final kept = error.code == 'network' ? await cache?.read(path) : null;
      if (kept == null) rethrow;
      OfflineReport.served(kept.savedAt);
      return (jsonDecode(kept.body) as Map).cast<String, dynamic>();
    }
  }

  @override
  Future<void> forget() async => cache?.clear();

  Uri _uri(String path) {
    final query = path.indexOf('?');
    return query < 0
        ? base.replace(path: '/api/mobile/ops/v1/$path')
        : base.replace(path: '/api/mobile/ops/v1/${path.substring(0, query)}', query: path.substring(query + 1));
  }

  Future<Map<String, dynamic>> _send(String path, {Object? body, String? method}) => _dispatch(() {
    final request = http.Request(method ?? (body == null ? 'GET' : 'POST'), _uri(path));
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    return request;
  });

  /// One authenticated call, built afresh for the retry (a body is read once).
  Future<Map<String, dynamic>> _dispatch(http.BaseRequest Function() build, {Duration timeout = const Duration(seconds: 30)}) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await auth.idToken(forceRefresh: attempt > 0);
      final http.Response response;
      try {
        final request = build()..headers.addAll({'authorization': 'Bearer $token', 'accept': 'application/json'});
        response = await _client.send(request).then(http.Response.fromStream).timeout(timeout);
      } on TimeoutException {
        throw const ApiException(0, 'network', 'KCPL could not be reached.');
      } on http.ClientException {
        throw const ApiException(0, 'network', 'KCPL could not be reached.');
      }
      if (response.statusCode == 401) continue;
      Map<String, dynamic> decoded;
      try {
        decoded = (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();
      } catch (_) {
        decoded = const {};
      }
      if (response.statusCode >= 200 && response.statusCode < 300) return decoded;
      if (decoded['code'] == 'CLOSEOUT_BLOCKED') {
        throw CloseoutBlocked(
          decoded['blockers'] is List ? (decoded['blockers'] as List).whereType<String>().toList() : const [],
          canOverride: decoded['canOverride'] == true,
        );
      }
      throw ApiException(response.statusCode, '${decoded['code'] ?? 'error'}', '${decoded['error'] ?? ''}');
    }
    await auth.signOut();
    throw const SignedOutException();
  }

  String _ref(String value) => Uri.encodeComponent(value);

  @override
  Future<OpsSession> session() async => OpsSession.fromJson(((await _read('session'))['session'] as Map).cast<String, dynamic>());

  @override
  Future<TodayBundle> today() async => TodayBundle.fromJson(await _read('today'));

  @override
  Future<JobFile> job(String reference) async => JobFile.fromJson(await _read('jobs/${_ref(reference)}'));

  @override
  Future<void> setTask(String reference, String taskId, bool completed) =>
      _send('jobs/${_ref(reference)}/tasks/${_ref(taskId)}', body: {'completed': completed});

  @override
  Future<void> setCustomsStep(String reference, String stepId, bool completed) =>
      _send('jobs/${_ref(reference)}/customs/${_ref(stepId)}', body: {'completed': completed});

  @override
  Future<AlertsPage> alerts() async {
    final body = await _read('alerts');
    final rows = body['notifications'] is List ? (body['notifications'] as List).whereType<Map>() : const <Map>[];
    return AlertsPage(
      alerts: rows.map((e) => OpsAlert.fromJson(e.cast<String, dynamic>())).toList(),
      unreadCount: (body['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<void> markRead(String alertId) => _send('alerts/${_ref(alertId)}', body: const {});

  @override
  Future<FieldNote> addNote(
    String reference, {
    String text = '',
    Attachment? photo,
    String documentType = 'other',
    SendProgress? onProgress,
  }) async {
    final body = await _dispatch(() {
      final multipart = http.MultipartRequest('POST', _uri('jobs/${_ref(reference)}/notes'))..fields['note'] = text;
      if (photo != null) {
        multipart
          ..fields['documentType'] = documentType
          ..files.add(http.MultipartFile.fromBytes('photo', photo.bytes, filename: photo.filename));
      }
      return ProgressingRequest.wrap(multipart, onProgress);
    }, timeout: const Duration(minutes: 2));
    return FieldNote.fromJson((body['note'] as Map?)?.cast<String, dynamic>() ?? const {});
  }

  @override
  Future<List<ScanMatch>> lookup(String query) async {
    final body = await _send('lookup?q=${Uri.encodeQueryComponent(query)}');
    final rows = body['matches'] is List ? (body['matches'] as List).whereType<Map>() : const <Map>[];
    return rows.map((e) => ScanMatch.fromJson(e.cast<String, dynamic>())).toList();
  }

  @override
  Future<void> registerPush(String token, String platform) => _send('push', body: {'token': token, 'platform': platform});

  @override
  Future<void> unregisterPush(String token) => _send('push', body: {'token': token}, method: 'DELETE');

  @override
  Future<DeliveryControl> delivery(String reference) async => DeliveryControl.fromJson(await _read('jobs/${_ref(reference)}/delivery'));

  @override
  Future<DeliveryAttempt> startDelivery(String reference, {String driverName = '', String vehicle = '', DateTime? at}) async {
    final when = (at ?? DateTime.now()).toUtc().toIso8601String();
    final created = await _send(
      'jobs/${_ref(reference)}/delivery',
      body: {
        'action': 'schedule',
        'scheduledFor': when,
        'driverName': driverName,
        'vehicleReference': vehicle,
      },
    );
    final attempt = DeliveryAttempt.fromJson((created['attempt'] as Map).cast<String, dynamic>());
    final moving = await _send(
      'jobs/${_ref(reference)}/delivery',
      body: {'action': 'update_attempt', 'attemptId': attempt.id, 'status': 'out_for_delivery', 'eventTime': when},
    );
    return DeliveryAttempt.fromJson((moving['attempt'] as Map).cast<String, dynamic>());
  }

  @override
  Future<DeliveryOutcome> recordDelivery(
    String reference,
    String attemptId, {
    required String status,
    String recipientName = '',
    String recipientRelation = '',
    String recipientPhone = '',
    String failureReason = '',
    double? latitude,
    double? longitude,
    String notes = '',
    DateTime? at,
  }) async {
    final body = await _send(
      'jobs/${_ref(reference)}/delivery',
      body: {
        'action': 'update_attempt',
        'attemptId': attemptId,
        'status': status,
        // When it happened, which is not when it was sent if there was no signal.
        'eventTime': (at ?? DateTime.now()).toUtc().toIso8601String(),
        'recipientName': recipientName,
        'recipientRelation': recipientRelation,
        'recipientPhone': recipientPhone,
        'failureReason': failureReason,
        'latitude': latitude,
        'longitude': longitude,
        'notes': notes,
      },
    );
    return DeliveryOutcome(
      attempt: DeliveryAttempt.fromJson((body['attempt'] as Map).cast<String, dynamic>()),
      blockers: body['blockers'] is List ? (body['blockers'] as List).whereType<String>().toList() : const [],
    );
  }

  @override
  Future<PodEvidence> addPodEvidence(
    String reference,
    String attemptId,
    String kind,
    Attachment file, {
    DateTime? capturedAt,
    SendProgress? onProgress,
  }) async {
    final body = await _dispatch(() {
      final multipart = http.MultipartRequest('POST', _uri('jobs/${_ref(reference)}/delivery/evidence'))
        ..fields['attemptId'] = attemptId
        ..fields['kind'] = kind
        ..fields['capturedAt'] = (capturedAt ?? DateTime.now()).toUtc().toIso8601String()
        // The server checks the declared type, so it is sent, not left to default.
        ..files.add(http.MultipartFile.fromBytes('file', file.bytes, filename: file.filename, contentType: MediaType.parse(file.contentType)));
      return ProgressingRequest.wrap(multipart, onProgress);
    }, timeout: const Duration(minutes: 2));
    return PodEvidence.fromJson((body['evidence'] as Map?)?.cast<String, dynamic>() ?? const {});
  }

  @override
  Future<List<StaffOption>> staff() async {
    final body = await _read('staff');
    final rows = body['options'] is List ? (body['options'] as List).whereType<Map>() : const <Map>[];
    return rows.map((e) => StaffOption.fromJson(e.cast<String, dynamic>())).toList();
  }

  @override
  Future<void> addTask(String reference, {required String title, required String branch, String dueAt = '', String detail = '', StaffOption? assignee}) =>
      _send(
        'jobs/${_ref(reference)}/actions',
        body: {
          'action': 'add_task',
          'title': title,
          'branch': branch,
          'dueAt': dueAt,
          'detail': detail,
          if (assignee != null) ...{
            'assignedToUid': assignee.uid,
            'assignedToName': assignee.name,
            'assignedToEmail': assignee.email,
            'assignedToPhone': assignee.phone ?? '',
          },
        },
      );

  @override
  Future<void> reassign(String reference, StaffOption owner) =>
      _send('jobs/${_ref(reference)}/actions', body: {'action': 'reassign', 'assignedToUid': owner.uid});

  @override
  Future<void> closeJob(String reference, {String overrideReason = ''}) =>
      _send('jobs/${_ref(reference)}/actions', body: {'action': 'close_job', 'overrideReason': overrideReason});

  @override
  Future<DriverDay> deliveries() async => DriverDay.fromJson(await _read('deliveries'));
}
