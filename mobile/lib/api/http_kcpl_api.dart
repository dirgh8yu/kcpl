import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../auth/auth_repository.dart';
import 'kcpl_api.dart';
import 'offline_cache.dart';
import 'upload.dart';
import 'models.dart';

/// [KcplApi] over KCPL's `/api/mobile/v1` endpoints.
class HttpKcplApi extends KcplApi {
  HttpKcplApi({required this.base, required this.auth, http.Client? client, this.cache}) : _client = client ?? http.Client();

  final Uri base;
  final AuthRepository auth;
  final http.Client _client;

  /// Keeps the last answer to each read for when KCPL can't be reached.
  final OfflineCache? cache;

  static const _timeout = Duration(seconds: 30);

  Uri _uri(String path) {
    final separator = path.indexOf('?');
    if (separator < 0) return base.replace(path: '/api/mobile/v1/$path');
    return base.replace(path: '/api/mobile/v1/${path.substring(0, separator)}', query: path.substring(separator + 1));
  }

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
    return ProgressingRequest.wrap(multipart, onProgress);
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

  /// A read. Its answer is kept for the customer it was asked for; when
  /// KCPL can't be reached, the kept answer is given instead and the screen
  /// is told how old it is. Refusals are never papered over: only a network
  /// failure falls back.
  Future<Map<String, dynamic>> _json(String path) async {
    final key = '${customerId ?? '-'}|$path';
    String body;
    try {
      body = utf8.decode((await _get(path)).bodyBytes);
      unawaited(cache?.write(key, body));
    } on ApiException catch (error) {
      final kept = error.code == 'network' ? await cache?.read(key) : null;
      if (kept == null) rethrow;
      OfflineReport.served(kept.savedAt);
      body = kept.body;
    }
    return (jsonDecode(body) as Map).cast<String, dynamic>();
  }

  @override
  Future<void> forget() async => cache?.clear();

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
  Future<DocumentsPage> documents({int offset = 0}) async {
    final body = await _json(offset == 0 ? 'documents' : 'documents?offset=$offset');
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

  String _enc(String value) => Uri.encodeComponent(value);

  @override
  Future<QuotesPage> quotes() async => QuotesPage.fromJson(await _json('quotes'));

  @override
  Future<void> acceptQuote(String reference, {String note = '', PickupRequest? pickup}) => _send(
    'POST',
    'requests',
    body: {'kind': 'booking', 'quoteReference': reference, 'note': note, if (pickup != null) 'pickup': pickup.toJson()},
  );

  @override
  Future<DownloadedFile> proofFile(String shipment, ProofItem item) async {
    final response = await _get('shipments/${_enc(shipment)}/pod/${_enc(item.id)}');
    return DownloadedFile(
      filename: '$shipment-${item.kind}',
      contentType: response.headers['content-type'] ?? item.contentType,
      bytes: response.bodyBytes,
    );
  }

  @override
  Future<DownloadedFile> statement() async {
    // Never from the offline copy: a statement is as of now.
    final response = await _get('statement');
    final disposition = response.headers['content-disposition'] ?? '';
    final name = RegExp(r'filename="([^"]+)"').firstMatch(disposition)?.group(1);
    return DownloadedFile(filename: name ?? 'KCPL-statement.pdf', contentType: 'application/pdf', bytes: response.bodyBytes);
  }

  @override
  Future<TextNotices> textNotices() async => TextNotices.fromJson(_decode(await _get('text-notices')));

  @override
  Future<TextNotices> setTextNotices(String channel, {String phone = '', bool consent = false}) async {
    await _send('POST', 'text-notices', body: {'channel': channel, 'phone': phone, 'consent': consent});
    return textNotices();
  }

  @override
  Future<NotificationPreferences> notificationPreferences() async =>
      NotificationPreferences.fromJson(((await _json('notifications'))['preferences'] as Map?)?.cast<String, dynamic>() ?? const {});

  @override
  Future<NotificationPreferences> setNotificationPreferences(NotificationPreferences preferences) async {
    final body = _decode(await _send('POST', 'notifications', body: preferences.toJson()));
    return NotificationPreferences.fromJson((body['preferences'] as Map?)?.cast<String, dynamic>() ?? const {});
  }

  @override
  Future<PaymentOptions> paymentOptions(String invoice) async =>
      // Never from the offline copy: whether an invoice can be paid, and at
      // what rate, is now or never.
      PaymentOptions.fromJson(_decode(await _get('invoices/${_enc(invoice)}/pay')));

  @override
  Future<PaymentStart> startPayment(String invoice, String gateway, {double? amount}) async {
    final body = _decode(await _send('POST', 'invoices/${_enc(invoice)}/pay', body: {'gateway': gateway, 'amount': ?amount}));
    return PaymentStart(intent: '${body['intent']}', url: Uri.parse('${body['url']}'));
  }

  @override
  Future<PaymentStatus> payment(String intent) async =>
      PaymentStatus.fromJson(((_decode(await _get('payments/${_enc(intent)}')))['payment'] as Map).cast<String, dynamic>());

  @override
  Future<List<ShipmentMessage>> messages(String reference) async =>
      _rows((await _json('shipments/${_enc(reference)}/messages'))['messages']).map(ShipmentMessage.fromJson).toList();

  @override
  Future<ShipmentMessage> sendMessage(String reference, String body) async => ShipmentMessage.fromJson(
    ((_decode(await _send('POST', 'shipments/${_enc(reference)}/messages', body: {'body': body})))['message'] as Map)
        .cast<String, dynamic>(),
  );

  @override
  Future<RatingReceipt> rateDelivery(String reference, int score, {String comment = ''}) async => RatingReceipt.fromJson(
    _decode(await _send('POST', 'shipments/${_enc(reference)}/rating', body: {'score': score, 'comment': comment})),
  );

  @override
  Future<TrackingLink> createTrackingLink(String reference) async {
    final body = _decode(await _send('POST', 'shipments/${_enc(reference)}/tracking-link'));
    return TrackingLink(url: Uri.parse('${body['url']}'), expiresAt: '${body['expires_at'] ?? ''}');
  }

  @override
  Future<int> revokeTrackingLinks(String reference) async =>
      ((_decode(await _send('DELETE', 'shipments/${_enc(reference)}/tracking-link')))['revoked'] as num?)?.toInt() ?? 0;

  @override
  Future<void> followLive(String reference, {required String activityToken, required String pushToken}) => _send(
    'POST',
    'live-activities',
    body: {
      'shipment': reference,
      'activityToken': activityToken,
      'fcmToken': pushToken,
      // Android names its follows itself (kcpl_live_updates).
      'platform': activityToken.startsWith('android:') ? 'android' : 'ios',
    },
  );

  @override
  Future<void> unfollowLive(String activityToken) => _send('DELETE', 'live-activities', body: {'activityToken': activityToken});

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
