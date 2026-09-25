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
import 'package:kcpl_customer/platform/app_shortcuts.dart';
import 'package:kcpl_customer/platform/live_activity.dart';
import 'package:kcpl_customer/push/push_service.dart';
import 'package:kcpl_customer/ui/estimates.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/icons.dart';
import 'package:kcpl_customer/ui/widgets/large_title.dart' show SheetCloseButton;
import 'package:kcpl_customer/ui/widgets/tab_bar.dart' show KTabBar;
import 'package:kcpl_customer/ui/screens/pay_screen.dart';
import 'package:kcpl_customer/ui/screens/quote_screen.dart' show QuoteScreen;

import 'app_flow_test.dart' show settle, signIn;
import 'push_ui_test.dart' show FakePush;
import 'send_flows_test.dart' show openShipment, sheetScrollTo;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

Future<AppController> _pump(WidgetTester tester, DemoApi api, {PushService? push, AppShortcuts? shortcuts}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = AppController(
    auth: DemoAuth(),
    api: api,
    prefs: MemoryTokenStore(),
    configured: true,
    push: push,
    shortcuts: shortcuts,
  );
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  await signIn(tester);
  return controller;
}

/// Back up the open sheet to [finder].
Future<void> _sheetScrollUp(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    -300,
    scrollable: find.descendant(of: find.byType(CustomScrollView).last, matching: find.byType(Scrollable)).first,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initFormatting);

  group('estimates', () {
    FreeTime freeTime({required String state, int remaining = 0, int overdue = 0, double? rate = 45}) => FreeTime(
      dailyCharge: rate,
      chargeCurrency: 'USD',
      status: FreeTimeStatus(state: state, deadline: '2026-09-27', daysRemaining: remaining, daysOverdue: overdue),
    );

    test('storage counts only the days past free time', () {
      final running = freeTime(state: 'running', remaining: 3);
      expect(storageEstimate(running, 0), (days: 0, cost: 0.0));
      expect(storageEstimate(running, 3), (days: 0, cost: 0.0));
      expect(storageEstimate(running, 5), (days: 2, cost: 90.0));
      final expired = freeTime(state: 'expired', overdue: 4);
      expect(storageEstimate(expired, 0), (days: 4, cost: 180.0), reason: 'days already past still cost');
      expect(storageEstimate(expired, 1), (days: 5, cost: 225.0));
      expect(storageEstimate(freeTime(state: 'running', remaining: 1, rate: null), 4).cost, isNull, reason: 'no rate, no invented figure');
    });

    test('duty, excise and VAT follow Nepal’s order at import', () {
      const estimate = DutyEstimate(cif: 100000, dutyRate: 0.10, exciseRate: 0.05);
      expect(estimate.duty, closeTo(10000, 0.001));
      expect(estimate.excise, closeTo(5500, 0.001), reason: 'excise is on value plus duty');
      expect(estimate.vat, closeTo(15015, 0.001), reason: 'VAT is on value, duty and excise');
      expect(estimate.total, closeTo(30515, 0.001));
    });
  });

  group('API', () {
    test('messages and ratings go to the shipment’s own endpoints', () async {
      final seen = <http.Request>[];
      final api = HttpKcplApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen.add(request);
          final path = request.url.path;
          final body = path.endsWith('/rating')
              ? {'ok': true, 'complaint': false, 'reviewUrl': 'https://g.page/r/kcpl/review', 'message': 'Thank you for telling us.'}
              : request.method == 'POST'
              ? {
                  'ok': true,
                  'message': {'id': 'm9', 'from': 'customer', 'author': 'Rina', 'body': 'Hello', 'created_at': '2026-09-25T10:00:00Z'},
                }
              : {
                  'ok': true,
                  'messages': [
                    {'id': 'm1', 'from': 'kcpl', 'author': 'KCPL · Sita', 'body': 'Cleared', 'created_at': '2026-09-25T09:00:00Z'},
                  ],
                };
          return http.Response.bytes(
            utf8.encode(jsonEncode(body)),
            request.method == 'POST' ? 201 : 200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final thread = await api.messages('KCPL-S-1');
      expect(thread.single.fromKcpl, isTrue);
      expect(thread.single.author, 'KCPL · Sita');
      final sent = await api.sendMessage('KCPL-S-1', 'Hello');
      expect(sent.fromKcpl, isFalse);
      expect(jsonDecode(seen[1].body), {'body': 'Hello'});
      final receipt = await api.rateDelivery('KCPL-S-1', 5, comment: 'On time');
      expect(seen.last.url.path, '/api/mobile/v1/shipments/KCPL-S-1/rating');
      expect(jsonDecode(seen.last.body), {'score': 5, 'comment': 'On time'});
      expect(receipt.reviewUrl, Uri.parse('https://g.page/r/kcpl/review'));
    });

    test('only a web page is ever offered as a review link', () {
      expect(RatingReceipt.fromJson({'reviewUrl': 'javascript:alert(1)'}).reviewUrl, isNull);
      expect(RatingReceipt.fromJson({'reviewUrl': 'http://example.com'}).reviewUrl, isNull);
    });

    test('saving settings always sends the invoice switch, since a missing one reads as off', () {
      final json = NotificationPreferences.fromJson(const {}).copyWith(documents: false).toJson();
      expect(json, {'shipment_updates': true, 'documents': false, 'free_time': true, 'invoices': true});
      expect(NotificationPreferences.fromJson(const {'invoices': false}).invoices, isFalse);
    });

    test('shipment detail reads whether it may be rated, and any rating given', () {
      final detail = ShipmentDetail.fromJson({
        'shipment': {'reference': 'KCPL-S-1', 'status': 'delivered'},
        'canRate': false,
        'rating': {'score': 4, 'created_at': '2026-09-25T10:00:00Z'},
      });
      expect(detail.canRate, isFalse);
      expect(detail.rating?.score, 4);
    });
  });

  group('shipment', () {
    testWidgets('a message to KCPL is written and shown in the shipment’s thread', (tester) async {
      final api = DemoApi();
      await _pump(tester, api);
      await openShipment(tester, 'KCPL-S-24091');
      await sheetScrollTo(tester, find.text('Message KCPL'));
      await tester.tap(find.text('Message KCPL'));
      await settle(tester);

      expect(find.textContaining('KCPL · Sita'), findsOneWidget, reason: 'the name once for the run of messages');
      expect(find.textContaining('Lodged this morning'), findsOneWidget);
      final send = find.widgetWithIcon(IconButton, KIcons.send);
      expect(tester.widget<IconButton>(send).onPressed, isNull, reason: 'nothing to send yet');

      await tester.enterText(find.byType(TextField).last, 'Thank you, Sita.');
      await tester.pump();
      await tester.tap(send);
      await settle(tester);
      expect(api.threads['KCPL-S-24091']!.last.body, 'Thank you, Sita.');
      expect(find.text('Thank you, Sita.'), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField).last).controller!.text, isEmpty);
    });

    testWidgets('a delivered shipment asks for a rating once; a happy one is offered a review', (tester) async {
      final opened = <Uri>[];
      PaymentBrowser.open = (url) async {
        opened.add(url);
        return true;
      };
      addTearDown(() => PaymentBrowser.open = (_) async => true);
      final api = DemoApi();
      await _pump(tester, api);
      await openShipment(tester, 'KCPL-S-24012');

      await sheetScrollTo(tester, find.text('How did this delivery go?'));
      expect(find.text('Send rating'), findsNothing, reason: 'the stars come first');
      await tester.tap(find.byTooltip('5 out of 5'));
      await settle(tester);
      await sheetScrollTo(tester, find.text('Send rating'));
      await tester.tap(find.text('Send rating'));
      await settle(tester);

      expect(api.ratings['KCPL-S-24012']?.score, 5);
      await _sheetScrollUp(tester, find.text('Thank you for telling us.'));
      expect(find.text('Thank you for telling us.'), findsOneWidget);
      await tester.tap(find.text('Leave a public review'));
      await settle(tester);
      expect(opened.single.host, 'g.page');
    });

    testWidgets('a low rating goes to the team and offers no review link', (tester) async {
      final api = DemoApi();
      await _pump(tester, api);
      await openShipment(tester, 'KCPL-S-24012');
      await sheetScrollTo(tester, find.text('How did this delivery go?'));
      await tester.tap(find.byTooltip('2 out of 5'));
      await settle(tester);
      await sheetScrollTo(tester, find.text('Send rating'));
      await tester.enterText(find.widgetWithText(TextField, 'Anything we should know? (optional)'), 'Box was crushed');
      await tester.tap(find.text('Send rating'));
      await settle(tester);
      expect(api.ratings['KCPL-S-24012']?.score, 2);
      await _sheetScrollUp(tester, find.textContaining('will be in touch'));
      expect(find.textContaining('will be in touch'), findsOneWidget);
      expect(find.text('Leave a public review'), findsNothing);
    });

    testWidgets('storage cost follows the collection day; duty follows the chosen bands', (tester) async {
      final api = DemoApi();
      await _pump(tester, api);
      await openShipment(tester, 'KCPL-S-24091');
      await sheetScrollTo(tester, find.text('What will storage cost?'));
      await tester.tap(find.text('What will storage cost?'));
      await settle(tester);
      expect(find.text('Collected today'), findsOneWidget);
      expect(find.text('Collected within free time'), findsOneWidget);
      for (var i = 0; i < 5; i++) {
        await tester.tap(find.byTooltip('Later'));
        await tester.pump();
      }
      await settle(tester);
      expect(find.text('Collected in 5 days'), findsOneWidget);
      expect(find.text('2 days after free time'), findsOneWidget, reason: 'the demo has three days of free time left');
      expect(find.text(formatMoney(90, 'USD')), findsOneWidget);

      await tester.tap(find.byType(SheetCloseButton).last);
      await settle(tester);
      await sheetScrollTo(tester, find.text('Estimate customs duty'));
      await tester.tap(find.text('Estimate customs duty'));
      await settle(tester);
      await tester.enterText(find.byType(TextField).last, '100000');
      await tester.pump();
      await tester.tap(find.text('5%').first);
      await settle(tester);
      expect(find.text(formatMoney(5000, 'NPR')), findsOneWidget);
      expect(find.text(formatMoney(13650, 'NPR')), findsOneWidget, reason: 'VAT on 100,000 plus 5,000 duty');
      expect(find.text(formatMoney(18650, 'NPR')), findsOneWidget);
    });
  });

  testWidgets('an invoice reminder opens the invoice, with Pay online one tap away', (tester) async {
    final push = FakePush();
    final api = DemoApi();
    await _pump(tester, api, push: push);
    push.tapController.add(const PushTarget('invoice', 'KCPL-I-20260918-011'));
    await settle(tester);
    await sheetScrollTo(tester, find.text('Pay online'));
    expect(find.text('Pay online'), findsOneWidget);
  });

  group('home screen shortcuts', () {
    testWidgets('are offered in the reader’s language, for what the login may do', (tester) async {
      final shortcuts = NoAppShortcuts();
      await _pump(tester, DemoApi(), shortcuts: shortcuts);
      expect(shortcuts.offered, ['Track a shipment', 'Request a quote', 'Pay an invoice']);
    });

    testWidgets('one chosen before sign-in is acted on once the app is ready', (tester) async {
      final shortcuts = NoAppShortcuts()..choose(Shortcut.pay);
      await _pump(tester, DemoApi(), shortcuts: shortcuts);
      await settle(tester);
      expect(shortcuts.pending.value, isNull);
      expect(tester.widget<KTabBar>(find.byType(KTabBar)).selected, 3, reason: 'the Invoices tab');

      shortcuts.choose(Shortcut.quote);
      await settle(tester);
      expect(find.byType(QuoteScreen), findsOneWidget);
    });
  });

  group('lock screen on Android', () {
    test('KCPL’s push moves the follow, or ends it on delivery; other pushes are left alone', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final calls = <MethodCall>[];
      const channel = MethodChannel('kcpl/live_activity');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
        calls.add(call);
        return null;
      });
      addTearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null));

      expect(await applyLivePush({'kind': 'shipment', 'reference': 'KCPL-S-1'}), isFalse);
      expect(calls, isEmpty);
      expect(
        await applyLivePush({
          'kind': 'live',
          'reference': 'KCPL-S-1',
          'event': 'update',
          'status': 'Customs clearance',
          'detail': 'Birgunj ICD',
          'progress': '0.6',
          'attention': '0',
        }),
        isTrue,
      );
      expect(calls.single.method, 'push');
      expect(calls.single.arguments, {
        'reference': 'KCPL-S-1',
        'end': false,
        'status': 'Customs clearance',
        'detail': 'Birgunj ICD',
        'progress': 0.6,
        'attention': false,
      });
      await applyLivePush({'kind': 'live', 'reference': 'KCPL-S-1', 'event': 'end', 'progress': '1', 'attention': '0'});
      expect((calls.last.arguments as Map)['end'], isTrue);
    });

    test('an Android follow is registered with KCPL as Android', () async {
      final seen = <http.Request>[];
      final api = HttpKcplApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen.add(request);
          return http.Response('{"ok":true}', 200);
        }),
      );
      await api.followLive('KCPL-S-1', activityToken: 'android:0f3a9c2b7d1e4a5b', pushToken: 'fcm-1');
      await api.followLive('KCPL-S-1', activityToken: 'apns-activity-token', pushToken: 'fcm-1');
      expect(seen.map((r) => (jsonDecode(r.body) as Map)['platform']), ['android', 'ios']);
    });

    test('starts a progress notification with its channel named in the reader’s language', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('kcpl/live_activity'),
        (call) async {
          calls.add(call);
          return {'id': 'KCPL-S-1', 'reference': 'KCPL-S-1'};
        },
      );
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
          const MethodChannel('kcpl/live_activity'),
          null,
        ),
      );
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final handle = await const ChannelLiveActivities().start(
        reference: 'KCPL-S-1',
        route: 'Kolkata → Birgunj',
        state: const LiveShipmentState(status: 'In transit', detail: 'Raxaul', progress: 0.5, attention: false),
        channel: 'ढुवानीको प्रगति',
      );
      expect(handle?.pushToken, isNull, reason: 'Android is moved by the app, not by an APNs token');
      expect((calls.single.arguments as Map)['channel'], 'ढुवानीको प्रगति');
      expect((calls.single.arguments as Map)['progress'], 0.5);
    });
  });
}
