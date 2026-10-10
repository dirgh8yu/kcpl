import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ui/format.dart';

import 'app_flow_test.dart' show pumpApp, settle, signIn;
import 'send_flows_test.dart' show openShipment, sheetScrollTo, useSource;

void main() {
  setUpAll(initFormatting);

  testWidgets('damage is reported from the shipment with a photo, and the claim shows where it stands', (tester) async {
    useSource();
    final api = DemoApi();
    await pumpApp(tester, api: api);
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24012');

    await sheetScrollTo(tester, find.text('Report damage or loss'));
    await tester.tap(find.text('Report damage or loss'));
    await settle(tester);
    await tester.tap(find.text('Report a problem'));
    await settle(tester);

    // Nothing goes without a word about what happened.
    await tester.tap(find.widgetWithText(FilledButton, 'Send to KCPL'));
    await settle(tester);
    expect(find.text('Say what happened in a sentence or two.'), findsOneWidget);

    await tester.tap(find.text('Short: less arrived than was sent'));
    await settle(tester);
    await sheetScrollTo(tester, find.byType(TextField).first);
    await tester.enterText(find.byType(TextField).first, 'Two of twelve cartons missing at delivery');
    await sheetScrollTo(tester, find.text('Add a photo'));
    await tester.tap(find.text('Add a photo'));
    await settle(tester);
    await tester.tap(find.text('Take photo').last);
    await settle(tester);
    expect(find.text('1 of 6'), findsOneWidget, reason: 'the count of photos so far, up to six');

    await tester.tap(find.widgetWithText(FilledButton, 'Send to KCPL'));
    await settle(tester);
    expect(find.text('Sent to KCPL'), findsOneWidget);
    final claim = api.claimsByShipment['KCPL-S-24012']!.single;
    expect(claim.kind, 'shortage');
    expect(claim.description, 'Two of twelve cartons missing at delivery');

    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.text('Claim ${claim.number}'), findsOneWidget);
    expect(find.text('With KCPL'), findsOneWidget);
  });

  test('a claim goes as one multipart request: its fields and every photo', () async {
    late String body;
    late String path;
    final client = MockClient((request) async {
      path = request.url.path;
      body = latin1.decode(request.bodyBytes);
      return http.Response(jsonEncode({'ok': true, 'message': 'Claim CLM-202610-AB12 sent to KCPL.'}), 201);
    });
    final api = HttpKcplApi(base: Uri.parse('https://kcpl.example'), auth: _SignedIn(), client: client);
    final receipt = await api.sendClaim(
      'KCPL-S-1',
      ClaimDraft(
        kind: 'damage',
        description: 'Crushed corner on two pallets',
        noticedOn: '2026-10-08',
        claimedAmount: 45000,
        photos: [
          Attachment(filename: 'one.jpg', bytes: const [1, 2, 3], contentType: 'image/jpeg'),
          Attachment(filename: 'two.jpg', bytes: const [4, 5, 6], contentType: 'image/jpeg'),
        ],
      ),
    );

    expect(path, '/api/mobile/v1/shipments/KCPL-S-1/claims');
    expect(receipt.message, contains('CLM-202610-AB12'));
    expect(body, contains('name="kind"'));
    expect(body, contains('Crushed corner on two pallets'));
    expect(body, contains('name="claimedAmount"'));
    expect('name="photos"'.allMatches(body).length, 2);
    expect(body, contains('filename="two.jpg"'));
  });
}

class _SignedIn extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token-1';
}
