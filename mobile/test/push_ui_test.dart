import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/push/push_service.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/widgets/common.dart' show RowTile;
import 'package:kcpl_customer/ui/screens/shipment_detail_screen.dart';
import 'package:kcpl_customer/ui/theme.dart';
import 'package:kcpl_customer/ui/widgets/kcpl_loader.dart';

/// A phone whose push the test controls.
class FakePush extends PushService {
  PushState _state = PushState.off;
  bool _dismissed = false;
  bool optedOut = false;
  final tapController = StreamController<PushTarget>.broadcast();
  final noticeController = StreamController<PushNotice>.broadcast();

  @override
  PushState get state => _state;
  @override
  Stream<PushTarget> get taps => tapController.stream;
  @override
  Stream<PushNotice> get notices => noticeController.stream;
  @override
  bool get primerDismissed => _dismissed;
  @override
  Future<void> dismissPrimer() async {
    _dismissed = true;
    notifyListeners();
  }

  @override
  Future<void> resume(RegisterDevice register) async {
    if (_state == PushState.on) await register('token-1', 'android');
  }

  @override
  Future<PushState> enable(RegisterDevice register) async {
    _state = PushState.on;
    await register('token-1', 'android');
    notifyListeners();
    return _state;
  }

  @override
  Future<void> disable(UnregisterDevice unregister, {bool optOut = true}) async {
    await unregister('token-1');
    if (optOut) {
      optedOut = true;
      _state = PushState.off;
    }
    notifyListeners();
  }
}

/// Records what the app tells the server about this phone.
class RecordingApi extends DemoApi {
  final registered = <String>[];
  final unregistered = <String>[];
  @override
  Future<void> registerPush(String token, String platform) async => registered.add('$token/$platform');
  @override
  Future<void> unregisterPush(String token) async => unregistered.add(token);
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
  await tester.pumpAndSettle();
}

Future<AppController> signedIn(WidgetTester tester, {required PushService push, required RecordingApi api}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final auth = DemoAuth();
  final signing = auth.signIn('a@b.example', 'x');
  await tester.pump(const Duration(seconds: 1));
  await signing;
  final controller = AppController(auth: auth, api: api, prefs: MemoryTokenStore(), configured: true, push: push);
  final starting = controller.start();
  await tester.pump(const Duration(seconds: 1));
  await starting;
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  return controller;
}

/// Pulls the home sheet all the way up, as a person would to read it.
Future<void> openSheet(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('home-sheet-grabber')));
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);

  testWidgets('the invitation turns push on and registers this phone', (tester) async {
    final push = FakePush();
    final api = RecordingApi();
    await signedIn(tester, push: push, api: api);
    expect(find.text('Know the moment your cargo moves'), findsOneWidget);

    await openSheet(tester);
    await tester.tap(find.text('Turn on'));
    await settle(tester);
    expect(api.registered, ['token-1/android']);
    expect(find.text('Know the moment your cargo moves'), findsNothing, reason: 'answered once, never shown again');
  });

  testWidgets('"Not now" is remembered and asks nothing of the phone', (tester) async {
    final push = FakePush();
    final api = RecordingApi();
    await signedIn(tester, push: push, api: api);
    await openSheet(tester);
    await tester.tap(find.text('Not now'));
    await settle(tester);
    expect(find.text('Know the moment your cargo moves'), findsNothing);
    expect(push.primerDismissed, isTrue);
    expect(api.registered, isEmpty);
  });

  testWidgets('the Account switch turns push off for this login', (tester) async {
    final push = FakePush().._state = PushState.on;
    final api = RecordingApi();
    await signedIn(tester, push: push, api: api);
    expect(api.registered, ['token-1/android'], reason: 'an existing opt-in re-registers after sign-in');

    await tester.tap(find.text('Account').last);
    await settle(tester);
    await tester.scrollUntilVisible(find.text('Push notifications'), 200, scrollable: find.byType(Scrollable).hitTestable().first);
    await tester.tap(find.descendant(of: find.widgetWithText(RowTile, 'Push notifications'), matching: find.byType(Switch)));
    await settle(tester);
    expect(api.unregistered, ['token-1']);
    expect(push.optedOut, isTrue);
  });

  testWidgets('a push while the app is open drops in, and a tap opens its shipment', (tester) async {
    final push = FakePush();
    final api = RecordingApi();
    await signedIn(tester, push: push, api: api);

    push.noticeController.add(
      const PushNotice(title: 'KCPL-S-24091 in customs', body: 'Declaration lodged.', target: PushTarget('shipment', 'KCPL-S-24091')),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('KCPL-S-24091 in customs'), findsOneWidget);

    await tester.tap(find.text('KCPL-S-24091 in customs'));
    await settle(tester);
    expect(find.byType(ShipmentDetailScreen), findsOneWidget);
    expect(find.text('KCPL-S-24091 in customs'), findsNothing, reason: 'the banner goes once used');
  });

  testWidgets('tapping a notification from outside the app opens its shipment', (tester) async {
    final push = FakePush();
    await signedIn(tester, push: push, api: RecordingApi());
    push.tapController.add(const PushTarget('shipment', 'KCPL-S-24103'));
    await settle(tester);
    expect(find.byType(ShipmentDetailScreen), findsOneWidget);
  });

  testWidgets('signing out stops pushes to this phone without turning push off', (tester) async {
    final push = FakePush().._state = PushState.on;
    final api = RecordingApi();
    final controller = await signedIn(tester, push: push, api: api);
    await controller.signOut();
    await settle(tester);
    expect(api.unregistered, ['token-1']);
    expect(push.optedOut, isFalse, reason: 'the next person to sign in keeps the phone\'s setting');
  });

  testWidgets('the K assembles and charges with motion on, and holds still without', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: kcplTheme(Brightness.light),
        home: const Center(child: KcplLoader()),
      ),
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(seconds: 2));
    expect(tester.binding.hasScheduledFrame, isTrue, reason: 'the charge keeps running while waiting');
    expect(tester.takeException(), isNull);

    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpWidget(
      MaterialApp(
        theme: kcplTheme(Brightness.light),
        home: const Center(child: KcplLoader(key: ValueKey('still'))),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.binding.hasScheduledFrame, isFalse);
  });
}
