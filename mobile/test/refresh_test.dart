import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/ui/format.dart';

/// Demo data that counts how often each screen asks the server.
class CountingApi extends DemoApi {
  int overviews = 0;
  int shipmentLists = 0;

  @override
  Future<OverviewBundle> overview() {
    overviews++;
    return super.overview();
  }

  @override
  Future<List<Shipment>> shipments() {
    shipmentLists++;
    return super.shipments();
  }
}

/// The first overview answer is held back until released, so a slow reply
/// can be made to arrive after a newer one.
class SlowFirstApi extends DemoApi {
  final gate = Completer<void>();
  int calls = 0;

  @override
  Future<OverviewBundle> overview() async {
    final call = ++calls;
    final bundle = await super.overview();
    if (call == 2) {
      await gate.future;
      return OverviewBundle(bundle.session, _renamed(bundle.overview, 'STALE'));
    }
    return OverviewBundle(bundle.session, _renamed(bundle.overview, call == 1 ? 'FIRST' : 'FRESH'));
  }

  Overview _renamed(Overview o, String tag) => Overview(
    shipments: [
      for (final s in o.shipments)
        Shipment(
          reference: '${s.reference}-$tag',
          status: s.status,
          mode: s.mode,
          origin: s.origin,
          destination: s.destination,
          eta: s.eta,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        ),
    ],
    activeCount: o.activeCount,
    inTransitCount: o.inTransitCount,
    arrivingCount: o.arrivingCount,
    attentionCount: o.attentionCount,
    deliveredCount: o.deliveredCount,
    documents: o.documents,
    outstanding: const [],
    outstandingCount: 0,
    freeTime: const [],
    finance: o.finance,
  );
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
  await tester.pumpAndSettle();
}

Future<void> signedIn(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  // The demo backend's latency runs on the test's fake clock, so these are
  // started, then time is advanced for them, rather than awaited outright.
  final auth = DemoAuth();
  final signingIn = auth.signIn('a@b.example', 'x');
  await tester.pump(const Duration(seconds: 1));
  await signingIn;
  final controller = AppController(auth: auth, api: api, prefs: MemoryTokenStore(), configured: true);
  final starting = controller.start();
  await tester.pump(const Duration(seconds: 1));
  await starting;
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
}

/// Lets [minutes] pass a minute at a time, as a phone left open would.
Future<void> wait(WidgetTester tester, int minutes) async {
  for (var i = 0; i < minutes; i++) {
    await tester.pump(const Duration(minutes: 1));
    await settle(tester);
  }
}

void main() {
  setUpAll(initFormatting);

  testWidgets('a screen on show refreshes itself every minute', (tester) async {
    final api = CountingApi();
    await signedIn(tester, api);
    expect(api.overviews, 1);
    await wait(tester, 3);
    expect(api.overviews, 4);
  });

  testWidgets('a hidden tab makes no requests, and refreshes when shown again', (tester) async {
    final api = CountingApi();
    await signedIn(tester, api);
    await tester.tap(find.text('Shipments').last);
    await settle(tester);
    expect(api.shipmentLists, 1);

    await wait(tester, 3);
    expect(api.overviews, 1, reason: 'Overview is hidden behind Shipments');
    expect(api.shipmentLists, 4);

    await tester.tap(find.text('Overview').last);
    await settle(tester);
    expect(api.overviews, 2, reason: 'coming back to a stale screen refreshes it');
  });

  testWidgets('a backgrounded app makes no requests, and catches up on return', (tester) async {
    final api = CountingApi();
    await signedIn(tester, api);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await wait(tester, 5);
    expect(api.overviews, 1);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await settle(tester);
    expect(api.overviews, 2);
  });

  testWidgets('a slow old reply never overwrites a newer one', (tester) async {
    final api = SlowFirstApi();
    await signedIn(tester, api);
    expect(find.textContaining('FIRST', findRichText: true), findsWidgets);

    // The minute's refresh stalls; the person pulls to refresh meanwhile.
    await tester.pump(const Duration(minutes: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(api.calls, 2);
    await tester.fling(find.byType(Scrollable).first, const Offset(0, 400), 1000);
    await settle(tester);
    expect(api.calls, 3);
    expect(find.textContaining('FRESH', findRichText: true), findsWidgets);

    api.gate.complete();
    await settle(tester);
    expect(find.textContaining('STALE', findRichText: true), findsNothing);
    expect(find.textContaining('FRESH', findRichText: true), findsWidgets);
  });
}
