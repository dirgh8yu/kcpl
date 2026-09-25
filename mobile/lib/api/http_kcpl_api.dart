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

  Future<http.Response> _send(String method, String path, {Object? body}) => _dispatch(() {
    final request = http.Request(method, _uri(path));
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    return request;
  });

  /// A file and its form fields. Built afresh for the retry, since a body
  /// can only be read once. Allowed longer than a read: a photo on a weak
  /// signal takes time.
  Future<http.Response> _upload(String path, Attachment file, Map<String, String> fields, SendProgress? onProgress) => _dispatch(() {
    final multipart = http.MultipartRequest('POST', _uri(path))
      ..fields.addAll(fields)
      ..files.add(http.MultipartFile.fromBytes('file', file.bytes, filename: file.filename));
    return _Progressing.wrap(multipart, onProgress);
  }, timeout: const Duration(minutes: 2));

  Future<http.Response> _dispatch(http.BaseRequest Function() build, {Duration timeout = _timeout}) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await auth.idToken(forceRefresh: attempt > 0);
      final http.Response response;
      try {
        final request = build()
          ..headers.addAll({'authorization': 'Bearer $token', 'x-kcpl-customer': ?customerId, 'accept': 'application/json'});
        response = await _client.send(request).then(http.Response.fromStream).timeout(timeout);
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

  Map<String, dynamic> _decode(http.Response response) => (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();

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
  Future<String> requestQuote(QuoteRequest request) async =>
      '${_decode(await _send('POST', 'requests', body: request.toJson()))['reference'] ?? ''}';

  @override
  Future<SendReceipt> sendDocument(String reference, String documentType, Attachment file, {SendProgress? onProgress}) async =>
      SendReceipt.fromJson(
        _decode(await _upload('shipments/${Uri.encodeComponent(reference)}/documents', file, {'documentType': documentType}, onProgress)),
      );

  @override
  Future<SendReceipt> confirmDelivery(String reference, {String receivedBy = '', String note = ''}) async => SendReceipt.fromJson(
    _decode(
      await _send('POST', 'shipments/${Uri.encodeComponent(reference)}/confirm-delivery', body: {'receivedBy': receivedBy, 'note': note}),
    ),
  );

  @override
  Future<List<Remittance>> remittances(String invoice) async =>
      _rows((await _json('invoices/${Uri.encodeComponent(invoice)}/remittances'))['remittances']).map(Remittance.fromJson).toList()
        ..sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt));

  @override
  Future<SendReceipt> sendRemittance(String invoice, RemittanceDraft draft, {SendProgress? onProgress}) async => SendReceipt.fromJson(
    _decode(
      await _upload('invoices/${Uri.encodeComponent(invoice)}/remittances', draft.file, {
        if (draft.amount != null) 'amount': '${draft.amount}',
        if (draft.currency != null) 'currency': draft.currency!,
        if (draft.paidOn != null) 'paidOn': draft.paidOn!,
        if (draft.note.trim().isNotEmpty) 'note': draft.note.trim(),
      }, onProgress),
    ),
  );

  @override
  Future<List<TeamMember>> team() async => _rows((await _json('team'))['team']).map(TeamMember.fromJson).toList();

  @override
  Future<TeamInvite> invite(String email) async =>
      TeamInvite.fromJson(_decode(await _send('POST', 'team', body: {'action': 'invite', 'email': email.trim()})));

  @override
  Future<void> setMemberActive(String email, bool active) =>
      _send('POST', 'team', body: {'action': active ? 'enable' : 'disable', 'email': email});

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

/// A request whose body is handed over in small pieces, reporting each one as
/// the connection takes it. The pieces are pulled, not pushed, so progress
/// follows the socket rather than racing ahead of it.
class _Progressing extends http.BaseRequest {
  _Progressing(super.method, super.url, this._body);
  final Stream<List<int>> _body;

  static const _piece = 32 * 1024;

  static http.BaseRequest wrap(http.MultipartRequest multipart, SendProgress? onProgress) {
    if (onProgress == null) return multipart;
    final body = multipart.finalize();
    final total = multipart.contentLength;
    Stream<List<int>> pieces() async* {
      var sent = 0;
      onProgress(0);
      await for (final chunk in body) {
        for (var start = 0; start < chunk.length; start += _piece) {
          final end = start + _piece < chunk.length ? start + _piece : chunk.length;
          yield chunk.sublist(start, end);
          sent += end - start;
          onProgress(total == 0 ? 1 : sent / total);
        }
      }
    }

    return _Progressing(multipart.method, multipart.url, pieces())
      ..headers.addAll(multipart.headers)
      ..contentLength = total;
  }

  @override
  http.ByteStream finalize() {
    super.finalize();
    return http.ByteStream(_body);
  }
}
