import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/models.dart' show Attachment;
import 'package:kcpl_customer/api/offline_cache.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/delivery_queue.dart';
import 'package:kcpl_customer/ops/field_location.dart';
import 'package:kcpl_customer/ops/ops_api.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/route_order.dart';
import 'package:kcpl_customer/ops/screens/driver_screen.dart';
import 'package:kcpl_customer/ui/format.dart';

import 'ops_test.dart' show pumpOps, settle, signIn, tapInView;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

void main() {
  setUpAll(initFormatting);
  tearDown(() {
    FieldLocation.current = () async => null;
    DriverMaps.open = (_) async => true;
  });

  test('a job read once still opens with no signal, and says how old it is', () async {
    var online = true;
    final cache = MemoryOfflineCache();
    final api = HttpOpsApi(
      base: Uri.parse('https://kcpl.example'),
      auth: _Auth(),
      cache: cache,
      client: MockClient((request) async {
        if (!online) throw http.ClientException('no signal');
        return http.Response(jsonEncode({'ok': true, 'job': {'reference': 'KCPL-1', 'customer_name': 'Annapurna'}}), 200);
      }),
    );
    await api.job('KCPL-1');
    online = false;
    final report = OfflineReport();
    final job = await report.watch(() => api.job('KCPL-1'));
    expect(job.job.customerName, 'Annapurna');
    expect(report.asOf, isNotNull, reason: 'the page shows it is offline');
    await api.forget();
    await expectLater(api.job('KCPL-1'), throwsA(anything), reason: 'signing out deletes the kept copies');
  });

  test('a delivery kept without signal is sent step by step, with the time it happened', () async {
    final api = DemoOpsApi()..offline = true;
    final queue = DeliveryQueue(retryEvery: const Duration(hours: 1));
    await queue.attach(api, 'anil@kcpl.example');
    final at = DateTime(2026, 9, 25, 10, 42);
    await queue.add(
      (id, owner) => QueuedDelivery(
        id: id,
        owner: owner,
        reference: 'KCPL-2609-0142',
        recordedAt: at,
        status: 'delivered',
        driverName: 'Anil Karki',
        recipientName: 'Ram Thapa',
        evidence: [('photo', Attachment(filename: 'gate.jpg', bytes: const [1, 2], contentType: 'image/jpeg'))],
      ),
    );
    expect(await queue.flush(), isFalse);
    expect(queue.waiting.single.attemptId, isNull, reason: 'nothing reached KCPL');

    api.offline = false;
    expect(await queue.flush(), isTrue);
    expect(queue.waiting, isEmpty);
    expect(api.lastOutcome?.recipient, 'Ram Thapa');
    expect(api.lastOutcomeAt, at, reason: 'KCPL records when it happened, not when it was sent');
    expect(api.podSent.single.kind, 'photo');
    queue.dispose();
  });

  test('a stop order is kept for the day, with new stops after', () {
    expect(RouteOrderStore.apply(['A', 'B', 'C', 'D'], ['C', 'A', 'X'], (s) => s), ['C', 'A', 'B', 'D']);
  });

  test('directions open Apple Maps on iPhone and Google Maps elsewhere', () {
    expect(DriverMaps.directions('Teku Road 14, Kathmandu', platform: TargetPlatform.iOS).host, 'maps.apple.com');
    final android = DriverMaps.directions('Teku Road 14, Kathmandu', platform: TargetPlatform.android);
    expect(android.host, 'www.google.com');
    expect(android.queryParameters['destination'], 'Teku Road 14, Kathmandu');
  });

  testWidgets('a delivery recorded with no signal waits on the phone and goes when it returns', (tester) async {
    final api = DemoOpsApi();
    final controller = await pumpOps(tester, api: api);
    await signIn(tester);
    await tapInView(tester, find.textContaining('KCPL-2609-0142').first);
    await settle(tester);
    api.offline = true;

    await tapInView(tester, find.text('Start delivery'));
    await settle(tester);
    await tester.tap(find.text('Start delivery').last);
    await settle(tester);
    expect(find.text('Delivery'), findsWidgets, reason: 'recording goes on without an attempt from KCPL');
    await tester.tap(find.text('Not delivered'));
    await settle(tester);
    await tester.enterText(find.byType(TextField).first, 'Gate locked at the yard');
    await tester.tap(find.text('Record attempt'));
    await settle(tester);
    expect(find.text('Saved on this phone'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await settle(tester);
    await tester.scrollUntilVisible(find.textContaining('Waiting for signal'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.text('Not delivered'), findsOneWidget);

    api.offline = false;
    await tester.runAsync(controller.deliveries.flush);
    await settle(tester);
    expect(api.lastOutcome?.status, 'failed');
    expect(find.textContaining('Waiting for signal'), findsNothing, reason: 'the page refreshed to KCPL’s record');
  });

  testWidgets('driver mode lists my stops first, opens directions, and keeps my order', (tester) async {
    final opened = <String>[];
    DriverMaps.open = (address) async {
      opened.add(address);
      return true;
    };
    final routes = MemoryRouteOrderStore();
    final api = DemoOpsApi();
    await pumpOps(tester, api: api, routes: routes);
    await signIn(tester);
    await tapInView(tester, find.text('Today’s deliveries'));
    await settle(tester);
    expect(find.text('Mine · 2'), findsOneWidget);
    expect(find.text('Everest Build Co.'), findsOneWidget);
    expect(find.text('Machhapuchhre Pharma'), findsNothing, reason: 'someone else’s stop is under All');

    await tester.tap(find.textContaining('Directions to'));
    await settle(tester);
    expect(opened, ['Teku Road 14, Kathmandu']);

    final second = tester.getCenter(find.byIcon(Icons.drag_handle_rounded).at(1));
    final drag = await tester.startGesture(second);
    await tester.pump(const Duration(milliseconds: 100));
    for (var i = 0; i < 15; i++) {
      await drag.moveBy(const Offset(0, -20));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await drag.up();
    await settle(tester);
    expect(routes.days.values.single.first, 'KCPL-2609-0142');

    await tester.tap(find.text('All · 3'));
    await settle(tester);
    expect(find.text('Machhapuchhre Pharma'), findsOneWidget);
  });

  testWidgets('the customer’s question on a job is answered from KCPL Ops', (tester) async {
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await settle(tester);

    await tapInView(tester, find.text('Messages with the customer'));
    await tester.tap(find.text('Messages with the customer'));
    await settle(tester);
    expect(find.textContaining('warehouse is closed at lunch'), findsOneWidget);
    expect(find.text('The customer sees your first name on replies.'), findsOneWidget);

    await tester.enterText(find.byType(TextField).last, 'Booked for 2:30pm.');
    await tester.pump();
    await tester.tap(find.byTooltip('Send'));
    await settle(tester);
    expect(api.threads['KCPL-2609-0142']!.last.fromKcpl, isTrue);
    expect(find.text('Booked for 2:30pm.'), findsOneWidget);
  });
}
