import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/ops_api.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ui/format.dart';

import 'ops_test.dart' show pumpOps, settle, signIn, tapInView;
import 'send_flows_test.dart' show useSource;

void main() {
  setUpAll(initFormatting);

  testWidgets('an empty going back is recorded from the yard, with the gate receipt photographed', (tester) async {
    useSource();
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await tapInView(tester, find.textContaining('KCPL-2609-0142').first);
    await settle(tester);

    await tapInView(tester, find.text('CMAU7719230'));
    await settle(tester);
    expect(find.text('Container CMAU7719230'), findsWidgets);

    await tester.tap(find.text('Empty returned to the depot'));
    await settle(tester);
    await tapInView(tester, find.text('Take photo').first);
    await settle(tester);
    await tester.tap(find.text('Take photo').last);
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await settle(tester);

    expect(api.lastContainerMovement, 'empty_returned');
    expect(api.lastContainerPhoto, startsWith('gate-receipt-CMAU7719230'), reason: 'the photo is named for the box, not IMG_4471');
    await tester.scrollUntilVisible(find.textContaining('Empty back'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.textContaining('Empty back'), findsOneWidget);
  });

  test('a container date goes as multipart to the staff route, with the day and the photo', () async {
    late http.BaseRequest seen;
    late String body;
    final client = MockClient((request) async {
      seen = request;
      body = String.fromCharCodes(request.bodyBytes);
      return http.Response('{"ok":true,"container":{"number":"CMAU7719230","size_type":"40HC","gated_out_on":"2026-10-01","empty_returned_on":"2026-10-09"}}', 200);
    });
    final api = HttpOpsApi(base: Uri.parse('https://kcpl.example'), auth: _SignedIn(), client: client);
    final container = await api.recordContainer(
      'KCPL-2609-0142',
      'CMAU7719230',
      'empty_returned',
      on: DateTime(2026, 10, 9),
      photo: Attachment(filename: 'gate.jpg', bytes: const [1, 2, 3], contentType: 'image/jpeg'),
    );

    expect(seen.url.path, '/api/mobile/ops/v1/jobs/KCPL-2609-0142/containers/CMAU7719230');
    expect(seen.headers['authorization'], 'Bearer token-1');
    expect(body, contains('empty_returned'));
    expect(body, contains('2026-10-09'));
    expect(body, contains('filename="gate.jpg"'));
    expect(container.emptyReturnedOn, '2026-10-09');
    expect(container.next, isNull, reason: 'nothing more to record once the empty is back');
  });
}

class _SignedIn extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token-1';
}
