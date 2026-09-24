import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../api/kcpl_api.dart' show ApiException;
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
  Future<void> registerPush(String token, String platform);
  Future<void> unregisterPush(String token);
}

/// [OpsApi] over `/api/mobile/ops/v1`. Same retry rule as the customer app:
/// a 401 is retried once with a forced token refresh, then signs out.
class HttpOpsApi implements OpsApi {
  HttpOpsApi({required this.base, required this.auth, http.Client? client}) : _client = client ?? http.Client();

  final Uri base;
  final AuthRepository auth;
  final http.Client _client;

  Uri _uri(String path) => base.replace(path: '/api/mobile/ops/v1/$path');

  Future<Map<String, dynamic>> _send(String path, {Object? body, String? method}) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await auth.idToken(forceRefresh: attempt > 0);
      final http.Response response;
      try {
        final request = http.Request(method ?? (body == null ? 'GET' : 'POST'), _uri(path))
          ..headers.addAll({
            'authorization': 'Bearer $token',
            'accept': 'application/json',
            if (body != null) 'content-type': 'application/json',
          });
        if (body != null) request.body = jsonEncode(body);
        response = await _client.send(request).then(http.Response.fromStream).timeout(const Duration(seconds: 30));
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
      throw ApiException(response.statusCode, '${decoded['code'] ?? 'error'}', '${decoded['error'] ?? ''}');
    }
    await auth.signOut();
    throw const SignedOutException();
  }

  String _ref(String value) => Uri.encodeComponent(value);

  @override
  Future<OpsSession> session() async => OpsSession.fromJson(((await _send('session'))['session'] as Map).cast<String, dynamic>());

  @override
  Future<TodayBundle> today() async => TodayBundle.fromJson(await _send('today'));

  @override
  Future<JobFile> job(String reference) async => JobFile.fromJson(await _send('jobs/${_ref(reference)}'));

  @override
  Future<void> setTask(String reference, String taskId, bool completed) =>
      _send('jobs/${_ref(reference)}/tasks/${_ref(taskId)}', body: {'completed': completed});

  @override
  Future<void> setCustomsStep(String reference, String stepId, bool completed) =>
      _send('jobs/${_ref(reference)}/customs/${_ref(stepId)}', body: {'completed': completed});

  @override
  Future<AlertsPage> alerts() async {
    final body = await _send('alerts');
    final rows = body['notifications'] is List ? (body['notifications'] as List).whereType<Map>() : const <Map>[];
    return AlertsPage(
      alerts: rows.map((e) => OpsAlert.fromJson(e.cast<String, dynamic>())).toList(),
      unreadCount: (body['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<void> markRead(String alertId) => _send('alerts/${_ref(alertId)}', body: const {});

  @override
  Future<void> registerPush(String token, String platform) => _send('push', body: {'token': token, 'platform': platform});

  @override
  Future<void> unregisterPush(String token) => _send('push', body: {'token': token}, method: 'DELETE');
}
