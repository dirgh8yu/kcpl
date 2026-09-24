import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/auth/auth_repository.dart';

class FakeAuth implements AuthRepository {
  int issued = 0;
  final List<bool> forced = [];
  bool signedOut = false;

  @override
  Future<String> idToken({bool forceRefresh = false}) async {
    forced.add(forceRefresh);
    return 'token-${++issued}';
  }

  @override
  Future<void> signOut() async => signedOut = true;
  @override
  Future<bool> restore() async => true;
  @override
  Future<void> signIn(String email, String password) async {}
  @override
  Future<void> sendPasswordReset(String email) async {}
}

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(utf8.encode(jsonEncode(body)), status);

final _session = {
  'email': 'ops@acme.example',
  'displayName': 'ops',
  'customerId': 'CUST-2',
  'customerName': 'Acme Nepal',
  'customers': [
    {'id': 'CUST-1', 'name': 'Acme'},
    {'id': 'CUST-2', 'name': 'Acme Nepal'},
  ],
  'role': 'member',
  'capabilities': {'role': 'member', 'canViewFinance': false, 'canSubmitRequests': true},
  'locale': 'ne',
};

void main() {
  test('every call carries the bearer token and the chosen customer', () async {
    final auth = FakeAuth();
    late http.Request seen;
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: auth,
      client: MockClient((request) async {
        seen = request;
        return _json({'ok': true, 'session': _session});
      }),
    )..customerId = 'CUST-2';

    final session = await api.session();
    expect(seen.url.toString(), 'https://kcpl.example/api/mobile/v1/session');
    expect(seen.headers['authorization'], 'Bearer token-1');
    expect(seen.headers['x-kcpl-customer'], 'CUST-2');
    expect(session.customers.map((c) => c.id), ['CUST-1', 'CUST-2']);
    expect(session.canViewFinance, isFalse);
    expect(session.locale, 'ne');
  });

  test('no customer header is sent before one is chosen', () async {
    late http.Request seen;
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: FakeAuth(),
      client: MockClient((request) async {
        seen = request;
        return _json({'ok': true, 'session': _session});
      }),
    );
    await api.session();
    expect(seen.headers.containsKey('x-kcpl-customer'), isFalse);
  });

  test('a 401 is retried once with a forced refresh', () async {
    final auth = FakeAuth();
    var calls = 0;
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: auth,
      client: MockClient((request) async {
        calls++;
        if (request.headers['authorization'] == 'Bearer token-1') return _json({'ok': false, 'code': 'signed_out'}, 401);
        return _json({'ok': true, 'shipments': []});
      }),
    );
    expect(await api.shipments(), isEmpty);
    expect(calls, 2);
    expect(auth.forced, [false, true]);
    expect(auth.signedOut, isFalse);
  });

  test('a second 401 signs out', () async {
    final auth = FakeAuth();
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: auth,
      client: MockClient((request) async => _json({'ok': false, 'code': 'signed_out'}, 401)),
    );
    await expectLater(api.shipments(), throwsA(isA<SignedOutException>()));
    expect(auth.signedOut, isTrue);
  });

  test('a refusal keeps the server wording and code', () async {
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: FakeAuth(),
      client: MockClient((request) async =>
          _json({'ok': false, 'code': 'denied', 'error': 'This account does not have KCPL portal access.'}, 403)),
    );
    await expectLater(
      api.session(),
      throwsA(isA<ApiException>()
          .having((e) => e.code, 'code', 'denied')
          .having((e) => e.message, 'message', 'This account does not have KCPL portal access.')),
    );
  });

  test('references are path-encoded', () async {
    late Uri seen;
    final api = HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: FakeAuth(),
      client: MockClient((request) async {
        seen = request.url;
        return _json({'ok': false, 'code': 'missing', 'error': 'Shipment not found.'}, 404);
      }),
    );
    await expectLater(api.shipment('A/B?C'), throwsA(isA<ApiException>().having((e) => e.missing, 'missing', isTrue)));
    expect(seen.path, '/api/mobile/v1/shipments/A%2FB%3FC');
  });

  test('a shipment detail in the server shape parses, including Nepali text', () {
    final detail = ShipmentDetail.fromJson({
      'shipment': {
        'reference': 'KCPL-S-1',
        'status': 'in_transit',
        'mode': 'sea',
        'origin': 'Kolkata',
        'destination': 'वीरगन्ज',
        'eta': null,
        'current_location': '',
        'carrier': 'Maersk',
        'carrier_reference': null,
        'customer_note': null,
        'created_at': '2026-09-01T00:00:00.000Z',
        'updated_at': '2026-09-20T00:00:00.000Z',
      },
      'confirmation': null,
      'freeTime': {
        'freeTime': {'location': 'Birgunj ICD', 'days': 7, 'started_on': '2026-09-18', 'daily_charge': 45, 'charge_currency': 'USD'},
        'status': {'state': 'running', 'deadline': '2026-09-24', 'daysRemaining': 1, 'daysOverdue': 0, 'projectedCharge': null},
      },
      'events': [
        {'id': 'e1', 'title': 'Departed', 'location': null, 'details': null, 'event_time': '2026-09-19T10:00:00.000Z'},
      ],
      'documents': [
        {'id': 3, 'shipment_reference': 'KCPL-S-1', 'filename': 'bl.pdf', 'content_type': 'application/pdf', 'size_bytes': 1200,
         'document_type': 'bill_of_lading', 'uploaded_at': '2026-09-19T10:00:00.000Z', 'shipment_status': 'in_transit',
         'from_customer': false, 'review_state': 'released'},
      ],
      'checklist': [
        {'document_type': 'packing_list', 'required': true, 'state': 'needed', 'uploadable': true, 'submitted_count': 0, 'last_submitted_at': null},
      ],
    });
    expect(detail.shipment.destination, 'वीरगन्ज');
    expect(detail.shipment.currentLocation, isNull, reason: 'blank strings read as absent');
    expect(detail.freeTime!.status.daysRemaining, 1);
    expect(detail.freeTime!.dailyCharge, 45);
    expect(detail.documents.single.id, '3');
    expect(detail.checklist.single.state, 'needed');
  });

  test('a malformed payload degrades to empty values rather than crashing', () {
    final overview = Overview.fromJson({'shipments': 'nope', 'activeCount': '3', 'finance': null});
    expect(overview.shipments, isEmpty);
    expect(overview.activeCount, 3);
    expect(overview.finance, isNull);
  });
}
