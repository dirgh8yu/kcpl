import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/api/offline_cache.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/auth_repository.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/l10n/app_localizations_en.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/platform/device_unlock.dart';
import 'package:kcpl_customer/platform/home_widget_bridge.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/screens/overview_screen.dart' show widgetSnapshot;
import 'package:kcpl_customer/ui/widgets/async_view.dart';
import 'package:kcpl_customer/ui/widgets/common.dart';
import 'package:kcpl_customer/ui/widgets/tab_bar.dart';

import 'app_flow_test.dart' show scrollTo, settle, signIn;

/// Always signed in, as a phone that was signed in at the last launch.
class TokenAuth extends DemoAuth {
  @override
  Future<bool> restore() async => true;
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

class FakeUnlock extends DeviceUnlock {
  FakeUnlock({this.ok = true});
  bool ok;
  int asked = 0;
  @override
  Future<UnlockMethod?> method() async => UnlockMethod.faceId;
  @override
  Future<bool> unlock(String reason) async {
    asked++;
    return ok;
  }
}

class FakeWidget extends HomeWidgetBridge {
  final published = <WidgetSnapshot?>[];
  int cleared = 0;
  final taps = StreamController<String>.broadcast();
  @override
  Future<void> publish(WidgetSnapshot? snapshot, {required String emptyTitle}) async => published.add(snapshot);
  @override
  Future<void> clear() async => cleared++;
  @override
  Stream<String> get opened => taps.stream;
}

/// Answers every list from the phone, as HttpKcplApi does offline.
class OfflineApi extends DemoApi {
  OfflineApi(this.savedAt);
  final DateTime savedAt;
  int forgotten = 0;

  @override
  Future<List<Shipment>> shipments() async {
    OfflineReport.served(savedAt);
    return super.shipments();
  }

  @override
  Future<void> forget() async => forgotten++;
}

Future<AppController> pump(
  WidgetTester tester, {
  KcplApi? api,
  AuthRepository? auth,
  DeviceUnlock unlock = const NoDeviceUnlock(),
  HomeWidgetBridge homeWidget = const NoHomeWidget(),
  TokenStore? prefs,
  bool signIn = true,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = AppController(
    auth: auth ?? DemoAuth(),
    api: api ?? DemoApi(),
    prefs: prefs ?? MemoryTokenStore(),
    configured: true,
    unlock: unlock,
    homeWidget: homeWidget,
  );
  // Not awaited: a restored session answers on a timer, and timers only
  // run as the test pumps.
  unawaited(controller.start());
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  return controller;
}

void lifecycle(WidgetTester tester, AppLifecycleState state, DateTime at) =>
    withClock(Clock.fixed(at), () => tester.binding.handleAppLifecycleStateChanged(state));

void main() {
  setUpAll(initFormatting);

  group('offline', () {
    test('a read KCPL answered is kept, and given back with its time when KCPL cannot be reached', () async {
      var online = true;
      final client = MockClient((request) async {
        if (!online) throw http.ClientException('no signal');
        return http.Response(
          jsonEncode({
            'ok': true,
            'shipments': [
              {'reference': 'KCPL-S-1', 'status': 'in_transit'},
            ],
          }),
          200,
        );
      });
      final cache = MemoryOfflineCache();
      final api = HttpKcplApi(base: Uri.parse('https://kcpl.example'), auth: TokenAuth(), client: client, cache: cache);

      final live = OfflineReport();
      expect((await live.watch(api.shipments)).single.reference, 'KCPL-S-1');
      expect(live.asOf, isNull, reason: 'a live answer is not offline');

      online = false;
      final offline = OfflineReport();
      expect((await offline.watch(api.shipments)).single.reference, 'KCPL-S-1');
      expect(offline.asOf, cache.entries.values.single.savedAt);

      await api.forget();
      await expectLater(api.shipments(), throwsA(isA<ApiException>()), reason: 'nothing is kept after sign-out');
    });

    test('a refusal is never papered over with a kept answer', () async {
      var refuse = false;
      final client = MockClient(
        (request) async => refuse
            ? http.Response(jsonEncode({'ok': false, 'code': 'denied', 'error': 'No access.'}), 403)
            : http.Response(jsonEncode({'ok': true, 'shipments': []}), 200),
      );
      final api = HttpKcplApi(base: Uri.parse('https://kcpl.example'), auth: TokenAuth(), client: client, cache: MemoryOfflineCache());
      await api.shipments();
      refuse = true;
      await expectLater(api.shipments(), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'denied')));
    });

    test('the file cache survives a restart and is gone after clear', () async {
      final dir = await Directory.systemTemp.createTemp('kcpl-cache');
      addTearDown(() => dir.delete(recursive: true));
      await FileOfflineCache(() async => dir).write('k', '{"a":1}');
      expect((await FileOfflineCache(() async => dir).read('k'))?.body, '{"a":1}');
      await FileOfflineCache(() async => dir).clear();
      expect(await FileOfflineCache(() async => dir).read('k'), isNull);
    });

    testWidgets('a screen answered from the phone says so, with the time', (tester) async {
      final savedAt = DateTime(2026, 9, 25, 10, 42);
      final api = OfflineApi(savedAt);
      final controller = await withClock(Clock.fixed(DateTime(2026, 9, 25, 12)), () => pump(tester, api: api, signIn: false));
      await signIn(tester);
      await tester.tap(find.text('Shipments').last);
      await settle(tester);
      expect(find.byType(OfflinePill), findsOneWidget);
      expect(find.textContaining('Offline'), findsOneWidget);

      await controller.signOut();
      await settle(tester);
      expect(api.forgotten, 1, reason: 'the kept copies go with the login');
    });
  });

  group('Face ID', () {
    testWidgets('turned on only after it succeeds, then asked for after a minute away, never for a glance', (tester) async {
      final unlock = FakeUnlock();
      final controller = await pump(tester, unlock: unlock, signIn: false);
      await signIn(tester);
      await tester.tap(find.byType(TabBarItem).last);
      await settle(tester);
      await scrollTo(tester, find.text('Require Face ID'));
      await settle(tester);
      await tester.tap(find.descendant(of: find.widgetWithText(RowTile, 'Require Face ID'), matching: find.byType(Switch)));
      await settle(tester);
      expect(unlock.asked, 1, reason: 'it is proven before it is switched on');
      expect(controller.lock.enabled, isTrue);

      final t0 = DateTime(2026, 9, 25, 9);
      lifecycle(tester, AppLifecycleState.inactive, t0);
      lifecycle(tester, AppLifecycleState.paused, t0);
      await tester.pump();
      expect(find.text('KCPL is locked'), findsNothing);
      expect(controller.lock.covered, isTrue, reason: 'the app switcher shows the brand, not invoices');

      lifecycle(tester, AppLifecycleState.resumed, t0.add(const Duration(seconds: 20)));
      await settle(tester);
      expect(controller.lock.locked, isFalse, reason: 'a glance away costs nothing');

      lifecycle(tester, AppLifecycleState.paused, t0.add(const Duration(minutes: 5)));
      unlock.ok = false;
      lifecycle(tester, AppLifecycleState.resumed, t0.add(const Duration(minutes: 7)));
      await settle(tester);
      expect(find.text('KCPL is locked'), findsOneWidget);

      unlock.ok = true;
      await tester.tap(find.textContaining('Unlock'));
      await settle(tester);
      expect(find.text('KCPL is locked'), findsNothing);
      expect(find.byType(TabBarItem), findsWidgets, reason: 'back exactly where it was');
    });

    testWidgets('a launch with it on is locked from the first frame, and signing out ends it', (tester) async {
      final prefs = MemoryTokenStore()..values['kcpl.lock'] = 'on';
      await pump(tester, auth: TokenAuth(), prefs: prefs, unlock: FakeUnlock(ok: false));
      expect(find.text('KCPL is locked'), findsOneWidget);

      await tester.tap(find.text('Sign out'));
      await settle(tester);
      expect(find.text('Sign in to KCPL'), findsOneWidget);
      expect(prefs.values.containsKey('kcpl.lock'), isFalse, reason: 'the next person starts without it');
    });
  });

  group('home screen widget', () {
    test('it shows the shipment in trouble first, then the next to arrive', () {
      final l = AppLocalizationsEn();
      final api = DemoApi(now: DateTime(2026, 9, 25));
      final lead = leadShipment([
        const Shipment(
          reference: 'A',
          status: 'in_transit',
          mode: 'sea',
          origin: 'X',
          destination: 'Y',
          eta: '2026-09-30',
          createdAt: '',
          updatedAt: '',
        ),
        const Shipment(
          reference: 'B',
          status: 'in_transit',
          mode: 'sea',
          origin: 'X',
          destination: 'Y',
          eta: '2026-09-27',
          createdAt: '',
          updatedAt: '',
        ),
      ]);
      expect(lead?.reference, 'B');
      expect(leadShipment(const []), isNull);
      return api.overview().then((bundle) {
        final snapshot = widgetSnapshot(l, bundle.overview)!;
        expect(snapshot.reference, 'KCPL-S-24077', reason: 'the exception leads');
        expect(snapshot.attention, isTrue);
        expect(snapshot.route, 'Haldia – Biratnagar');
        expect(snapshot.summary, '4 shipments on the way');
      });
    });

    testWidgets('the overview keeps it current, a tap on it opens the shipment, and sign-out empties it', (tester) async {
      final widget = FakeWidget();
      final controller = await pump(tester, homeWidget: widget, signIn: false);
      await signIn(tester);
      expect(widget.published.last?.reference, 'KCPL-S-24077');

      widget.taps.add('KCPL-S-24091');
      await settle(tester);
      expect(find.text('KCPL-S-24091'), findsWidgets, reason: 'the shipment opened from the widget');

      await controller.signOut();
      await settle(tester);
      expect(widget.cleared, 1);
    });
  });
}
