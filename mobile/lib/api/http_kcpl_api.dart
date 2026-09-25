import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../auth/auth_repository.dart';
import 'kcpl_api.dart';
import 'models.dart';

/// [KcplApi] over KCPL's `/api/mobile/v1` endpoints.
class HttpKcplApi extends KcplApi {
  HttpKcplApi({required this.base, required this.auth, http.Client? client}) : _client = client ?? http.Client();

  final Uri base;
  final AuthRepository auth;
  final http.Client _client;

  static const _timeout = Duration(seconds: 30);

  Uri _uri(String path) => base.replace(path: '/api/mobile/v1/$path');

  /// One authenticated GET. A 401 is retried once with a freshly minted
  /// token, since the cached one may have been revoked or expired early. A
  /// second 401 means the login itself is no longer accepted.
  Future<http.Response> _get(String path) => _send('GET', path);

  Future<http.Response> _send(String method, String path, {Object? body}) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await auth.idToken(forceRefresh: attempt > 0);
      final http.Response response;
      try {
        final request = http.Request(method, _uri(path))
          ..headers.addAll({
            'authorization': 'Bearer $token',
            'x-kcpl-customer': ?customerId,
            'accept': 'application/json',
            if (body != null) 'content-type': 'application/json',
          });
        if (body != null) request.body = jsonEncode(body);
        response = await _client.send(request).then(http.Response.fromStream).timeout(_timeout);
      } on TimeoutException {
        throw const ApiException(0, 'network', 'KCPL could not be reached.');
      } on http.ClientException {
        throw const ApiException(0, 'network', 'KCPL could not be reached.');
      }
      if (response.statusCode == 401) continue;
      if (response.statusCode >= 200 && response.statusCode < 300) return response;
      throw _failure(response);
    }
    await auth.signOut();
    throw const SignedOutException();
  }

  ApiException _failure(http.Response response) {
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return ApiException(response.statusCode, '${body['code'] ?? 'error'}', '${body['error'] ?? ''}');
    } on FormatException {
      return ApiException(response.statusCode, 'error', 'Unexpected response from KCPL (HTTP ${response.statusCode}).');
    }
  }

  Future<Map<String, dynamic>> _json(String path) async {
    final response = await _get(path);
    return (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();
  }

  List<Map<String, dynamic>> _rows(Object? value) =>
      value is List ? value.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];

  @override
  Future<SessionView> session() async => SessionView.fromJson((await _json('session'))['session'] as Map<String, dynamic>);

  @override
  Future<OverviewBundle> overview() async {
    final body = await _json('overview');
    return OverviewBundle(
      SessionView.fromJson(body['session'] as Map<String, dynamic>),
      Overview.fromJson(body['overview'] as Map<String, dynamic>),
    );
  }

  @override
  Future<List<Shipment>> shipments() async => _rows((await _json('shipments'))['shipments']).map(Shipment.fromJson).toList();

  @override
  Future<ShipmentDetail> shipment(String reference) async =>
      ShipmentDetail.fromJson((await _json('shipments/${Uri.encodeComponent(reference)}'))['detail'] as Map<String, dynamic>);

  @override
  Future<DocumentsPage> documents() async {
    final body = await _json('documents');
    return DocumentsPage(
      documents: _rows(body['documents']).map(DocumentRow.fromJson).toList(),
      scanned: (body['scanned'] as num?)?.toInt() ?? 0,
      total: (body['total'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<InvoicesPage> invoices() async {
    final body = await _json('invoices');
    return InvoicesPage(
      invoices: _rows(body['invoices']).map(Invoice.fromJson).toList(),
      summary: FinanceSummary.fromJson((body['summary'] as Map?)?.cast<String, dynamic>() ?? const {}),
    );
  }

  @override
  Future<Invoice> invoice(String reference) async =>
      Invoice.fromJson((await _json('invoices/${Uri.encodeComponent(reference)}'))['invoice'] as Map<String, dynamic>);

  @override
  Future<String> requestQuote(QuoteRequest request) async {
    final response = await _send('POST', 'requests', body: request.toJson());
    final body = (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();
    return '${body['reference'] ?? ''}';
  }

  @override
  Future<void> registerPush(String token, String platform) => _send('POST', 'push', body: {'token': token, 'platform': platform});

  @override
  Future<void> unregisterPush(String token) => _send('DELETE', 'push', body: {'token': token});

  @override
  Future<DownloadedFile> download(DocumentRow document) async {
    final response = await _get('documents/${Uri.encodeComponent(document.shipmentReference)}/${Uri.encodeComponent(document.id)}');
    return DownloadedFile(
      filename: document.filename.isEmpty ? 'document' : document.filename,
      contentType: response.headers['content-type'] ?? document.contentType,
      bytes: response.bodyBytes,
    );
  }
}
