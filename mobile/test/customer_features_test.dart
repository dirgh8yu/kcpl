import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/platform/live_activity.dart';
import 'package:kcpl_customer/push/push_service.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/screens/pay_screen.dart';
import 'package:kcpl_customer/ui/widgets/common.dart' show RowTile;
import 'package:kcpl_customer/ui/widgets/large_title.dart' show SheetCloseButton;

import 'app_flow_test.dart' show scrollTo, settle, signIn;
import 'push_ui_test.dart' show FakePush;
import 'send_flows_test.dart' show sheetScrollTo;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

class _PushOn extends FakePush {
  @override
  String? get deviceToken => 'fcm-1';
}

class _FakeLive implements LiveActivities {
  final running_ = <LiveActivityHandle>[];
  LiveShipmentState? last;

  @override
  Future<bool> supported() async => true;
  @override
  Future<List<LiveActivityHandle>> running() async => [...running_];
  @override
  Future<LiveActivityHandle?> start({required String reference, required String route, required LiveShipmentState state, String? channel}) async {
    last = state;
    final handle = LiveActivityHandle(id: 'a1', reference: reference, pushToken: 'apns-1');
    running_.add(handle);
    return handle;
  }

  @override
  Future<void> update(String id, LiveShipmentState state) async => last = state;
  @override
  Future<void> end(String id) async => running_.removeWhere((a) => a.id == id);
}

Future<AppController> _pump(WidgetTester tester, DemoApi api, {PushService? push}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = AppController(auth: DemoAuth(), api: api, prefs: MemoryTokenStore(), configured: true, push: push);
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  await signIn(tester);
  return controller;
}

Future<void> _account(WidgetTester tester) async {
  await tester.tap(find.text('Account').last);
  await settle(tester);
}

Future<void> _invoice(WidgetTester tester, String reference) async {
  await tester.tap(find.text('Invoices').last);
  await settle(tester);
  await scrollTo(tester, find.textContaining(reference, findRichText: true));
  await tester.tap(find.textContaining(reference, findRichText: true).first);
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);
  tearDown(() {
    dateCalendar = DateCalendar.gregorian;
    LiveActivities.current = const NoLiveActivities();
    PaymentBrowser.open = (_) async => true;
  });

  group('API client', () {
    HttpKcplApi api(List<http.Request> seen, Map<String, Object> Function(http.Request) reply) => HttpKcplApi(
      base: Uri.parse('https://kcpl.example'),
      auth: _Auth(),
      client: MockClient((request) async {
        seen.add(request);
        return http.Response(jsonEncode(reply(request)), 200);
      }),
    );

    test('accepting a quote is the portal’s own booking request', () async {
      final seen = <http.Request>[];
      await api(seen, (_) => {'ok': true}).acceptQuote('KCPL-Q-1', note: 'From next week');
      expect(seen.single.url.path, '/api/mobile/v1/requests');
      expect(jsonDecode(seen.single.body), {'kind': 'booking', 'quoteReference': 'KCPL-Q-1', 'note': 'From next week'});
    });

    test('quotes read the portal’s fields, and a price past its date cannot be accepted', () async {
      final page = await api([], (_) => {
        'quotes': [
          {'reference': 'Q1', 'quoted_amount': 1000, 'quote_currency': 'NPR', 'valid_until': '2026-09-20', 'weight': '12', 'weight_unit': 'kg'},
          {'reference': 'Q2', 'quoted_amount': 50, 'quote_currency': 'USD', 'valid_until': '2026-10-20'},
          {'reference': 'Q3', 'quoted_amount': 70, 'booking_requested_at': '2026-09-24T10:00:00Z'},
        ],
        'requests': [{'reference': 'Q4'}],
      }).quotes();
      final now = DateTime.utc(2026, 9, 25);
      expect(page.quotes[0].weight, '12 kg');
      expect(page.quotes.map((q) => q.canProceed(now)), [false, true, false]);
      expect(page.requests.single.priced, isFalse);
    });

    test('notification switches go as the portal’s four topics', () async {
      final seen = <http.Request>[];
      final saved = await api(seen, (request) => {'ok': true, 'preferences': jsonDecode(request.body) as Object})
          .setNotificationPreferences(const NotificationPreferences(shipmentUpdates: true, documents: false, freeTime: true));
      expect(jsonDecode(seen.single.body), {'shipment_updates': true, 'documents': false, 'free_time': true, 'invoices': true});
      expect(saved.documents, isFalse);
    });

    test('a payment is started and asked after; the phone never signs anything', () async {
      final seen = <http.Request>[];
      final client = api(seen, (request) => switch (request.url.path) {
        '/api/mobile/v1/invoices/INV-1/pay' when request.method == 'GET' => {'ok': true, 'gateways': ['khalti', 'esewa']},
        '/api/mobile/v1/invoices/INV-1/pay' => {'ok': true, 'intent': 'abc', 'url': 'https://kcpl.example/pay/abc'},
        _ => {'ok': true, 'payment': {'id': 'abc', 'invoice': 'INV-1', 'gateway': 'khalti', 'amount': 1040.5, 'status': 'needs_review'}},
      });
      expect(await client.paymentOptions('INV-1'), ['khalti', 'esewa']);
      final started = await client.startPayment('INV-1', 'khalti');
      expect(jsonDecode(seen[1].body), {'gateway': 'khalti'}, reason: 'only which gateway; the amount is the server’s');
      expect(started.url.toString(), 'https://kcpl.example/pay/abc');
      final status = await client.payment('abc');
      expect((status.review, status.settled, status.paid), (true, true, false));
    });

    test('tracking links and Live Activities go to their own routes', () async {
      final seen = <http.Request>[];
      final client = api(seen, (request) => {'ok': true, 'url': 'https://kcpl.example/t/x', 'expires_at': '2026-10-25T00:00:00Z', 'revoked': 2});
      expect((await client.createTrackingLink('KCPL-S-1')).url.path, '/t/x');
      expect(await client.revokeTrackingLinks('KCPL-S-1'), 2);
      await client.followLive('KCPL-S-1', activityToken: 'apns', pushToken: 'fcm');
      expect(seen.map((r) => '${r.method} ${r.url.path}'), [
        'POST /api/mobile/v1/shipments/KCPL-S-1/tracking-link',
        'DELETE /api/mobile/v1/shipments/KCPL-S-1/tracking-link',
        'POST /api/mobile/v1/live-activities',
      ]);
      expect(jsonDecode(seen.last.body), {'shipment': 'KCPL-S-1', 'activityToken': 'apns', 'fcmToken': 'fcm'});
    });
  });

  group('Bikram Sambat', () {
    test('dates read in BS when chosen, and a calendar day never shifts', () {
      dateCalendar = DateCalendar.bikramSambat;
      expect(formatDate('2026-09-25'), '9 Ashwin 2083 BS');
      expect(formatDateTime('2026-09-25T06:30:00Z'), '9 Ashwin 2083, 12:15 BS', reason: 'Nepal time, as the calendar is');
      expect(formatDate('2026-04-14'), '1 Baishakh 2083 BS', reason: 'New Year');
      dateCalendar = DateCalendar.gregorian;
      expect(formatDate('2026-09-25'), '25 Sept 2026');
    });

    testWidgets('the choice in Account changes the dates on screen and is kept', (tester) async {
      final controller = await _pump(tester, DemoApi());
      await _account(tester);
      await scrollTo(tester, find.text('Bikram Sambat (BS)'));
      await tester.tap(find.text('Bikram Sambat (BS)'));
      await settle(tester);
      expect(dateCalendar, DateCalendar.bikramSambat);
      expect(await controller.prefs.read('kcpl.calendar'), 'bs');
      await tester.tap(find.text('Invoices').last);
      await settle(tester);
      expect(find.textContaining('Ashwin'), findsWidgets);
    });
  });

  testWidgets('a priced quote is accepted from the app, and an expired one cannot be', (tester) async {
    final api = DemoApi();
    await _pump(tester, api);
    await _account(tester);
    await scrollTo(tester, find.text('Quotes'));
    await tester.tap(find.text('Quotes'));
    await settle(tester);

    await tester.tap(find.text('Shenzhen – Kathmandu (TIA)'));
    await settle(tester);
    expect(find.text('This price has expired. Ask KCPL for a fresh quote.'), findsOneWidget);
    expect(find.text('Ask to proceed'), findsNothing);
    await tester.tap(find.byType(SheetCloseButton).last);
    await settle(tester);

    await tester.tap(find.text('Kolkata – Birgunj ICD'));
    await settle(tester);
    await sheetScrollTo(tester, find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'Ready from 1 October');
    await tester.tap(find.text('Ask to proceed'));
    await settle(tester);
    expect(find.text('Request sent'), findsOneWidget);
    expect(api.bookingRequests, {'KCPL-Q-20260921-014': 'Ready from 1 October'});
    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.textContaining('You asked to proceed', findRichText: true), findsOneWidget, reason: 'the list shows it asked for');
  });

  testWidgets('an invoice is paid through a gateway, and KCPL’s word decides it', (tester) async {
    final opened = <Uri>[];
    PaymentBrowser.open = (url) async {
      opened.add(url);
      return true;
    };
    final api = DemoApi();
    await _pump(tester, api);
    await _invoice(tester, 'KCPL-I-20260918-011');
    await tester.tap(find.text('Pay online'));
    await settle(tester);
    await tester.tap(find.text('Khalti'));
    await settle(tester);
    expect(opened.single.path, startsWith('/pay/'));
    expect(find.text('Finish paying in the browser'), findsOneWidget);

    api.completePayment(api.payments.keys.single);
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);
    expect(find.text('Payment received'), findsOneWidget);
    expect(find.textContaining('was applied to KCPL-I-20260918-011'), findsOneWidget);
  });

  testWidgets('a failed payment says so and offers the gateways again', (tester) async {
    final api = DemoApi()..nextPaymentOutcome = 'failed';
    await _pump(tester, api);
    await _invoice(tester, 'KCPL-I-20260918-011');
    await tester.tap(find.text('Pay online'));
    await settle(tester);
    await tester.tap(find.text('eSewa'));
    await settle(tester);
    api.completePayment(api.payments.keys.single);
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);
    expect(find.text('Payment not completed'), findsOneWidget);
    expect(find.text('connectIPS'), findsOneWidget);
  });

  testWidgets('a dollar invoice is not offered online payment', (tester) async {
    await _pump(tester, DemoApi());
    await _invoice(tester, 'KCPL-I-20260821-004');
    expect(find.text('Pay online'), findsNothing);
    expect(find.text('Send payment receipt'), findsOneWidget);
  });

  testWidgets('email switches save as they move', (tester) async {
    final api = DemoApi();
    await _pump(tester, api);
    await _account(tester);
    await scrollTo(tester, find.text('Document requests and releases'));
    await tester.tap(find.descendant(of: find.widgetWithText(RowTile, 'Document requests and releases'), matching: find.byType(Switch)));
    await settle(tester);
    expect(api.preferences.documents, isFalse);
    expect(api.preferences.shipmentUpdates, isTrue);
  });

  testWidgets('a shipment is shared by link, the links withdrawn, and followed on the Lock Screen', (tester) async {
    LiveActivities.asNotification = false;
    addTearDown(() => LiveActivities.asNotification = defaultTargetPlatform == TargetPlatform.android);
    final shared = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('dev.fluttercommunity.plus/share'), (call) async {
      shared.add('${(call.arguments as Map)['text']}');
      return 'dev.fluttercommunity.plus/share/success';
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('dev.fluttercommunity.plus/share'), null));
    final live = _FakeLive();
    LiveActivities.current = live;
    final api = DemoApi();
    await _pump(tester, api, push: _PushOn());
    await tester.tap(find.text('Shipments').last);
    await settle(tester);
    await tester.tap(find.textContaining('KCPL-S-24091', findRichText: true).first);
    await settle(tester);

    await tester.tap(find.byTooltip('Share status'));
    await settle(tester);
    await tester.tap(find.text('Share a tracking link'));
    await settle(tester);
    expect(api.trackingLinks['KCPL-S-24091'], 1);
    expect(shared.single, contains('https://kcpl.example/t/'));

    await tester.tap(find.byTooltip('Share status'));
    await settle(tester);
    await tester.tap(find.text('Stop sharing links'));
    await settle(tester);
    expect(find.text('Links for KCPL-S-24091 no longer work.'), findsOneWidget);

    await tester.tap(find.byTooltip('Share status'));
    await settle(tester);
    await tester.tap(find.text('Follow on Lock Screen'));
    await settle(tester);
    expect(live.running_.single.reference, 'KCPL-S-24091');
    expect(live.last?.progress, greaterThan(0));
    expect(api.liveActivities, {'apns-1': 'KCPL-S-24091'}, reason: 'KCPL moves it through push');

    await tester.tap(find.byTooltip('Share status'));
    await settle(tester);
    await tester.tap(find.text('Stop following'));
    await settle(tester);
    expect(live.running_, isEmpty);
    expect(api.liveActivities, isEmpty);
  });
}
