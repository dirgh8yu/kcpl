import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/api/kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/auth_repository.dart';
import 'package:kcpl_customer/auth/social_sign_in.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/map/route_map.dart';
import 'package:kcpl_customer/ui/motion.dart';
import 'package:kcpl_customer/ui/screens/shipment_detail_screen.dart';
import 'package:kcpl_customer/ui/theme.dart';
import 'package:kcpl_customer/ui/widgets/large_title.dart';
import 'package:kcpl_customer/ui/widgets/tab_bar.dart';

/// Demo data, but the login has no finance access.
class MemberApi extends DemoApi {
  @override
  Future<SessionView> session() async {
    final s = await super.session();
    return SessionView(
      email: s.email,
      displayName: s.displayName,
      customerId: s.customerId,
      customerName: s.customerName,
      customers: [s.customers.first],
      role: 'member',
      canViewFinance: false,
      locale: 'en',
    );
  }

  /// The server sends no finance to a login that cannot view it.
  @override
  Future<OverviewBundle> overview() async {
    final o = (await super.overview()).overview;
    return OverviewBundle(
      await session(),
      Overview(
        shipments: o.shipments,
        activeCount: o.activeCount,
        inTransitCount: o.inTransitCount,
        arrivingCount: o.arrivingCount,
        attentionCount: o.attentionCount,
        deliveredCount: o.deliveredCount,
        documents: o.documents,
        outstanding: o.outstanding,
        outstandingCount: o.outstandingCount,
        freeTime: o.freeTime,
      ),
    );
  }
}

/// Firebase accepts the password; KCPL does not grant portal access.
class DeniedApi extends DemoApi {
  @override
  Future<SessionView> session() async =>
      throw const ApiException(403, 'denied', 'This account does not have KCPL portal access. Contact your KCPL account manager.');
}

/// Google is accepted by Firebase only once the address's password has
/// been used to link it; records the link.
class LinkingAuth extends DemoAuth {
  IdpCredential? linked;
  String? password;

  @override
  Future<void> signInWithIdp(IdpCredential credential) async => throw NeedsLinking('imports@annapurna.example', credential);

  @override
  Future<void> signIn(String email, String password) {
    this.password = password;
    return super.signIn(email, password);
  }

  @override
  Future<void> link(IdpCredential credential) async => linked = credential;
}

class TrackingAuth extends DemoAuth {
  int signOuts = 0;
  @override
  Future<void> signOut() {
    signOuts++;
    return super.signOut();
  }
}

Future<AppController> pumpApp(
  WidgetTester tester, {
  KcplApi? api,
  AuthRepository? auth,
  bool reduceMotion = true,
  SocialSignIn social = SocialSignIn.none,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  // Flows run under the system's reduce-motion setting. Settling can only
  // finish if every looping animation honours it, so each flow test also
  // proves the app stops moving when asked to.
  if (reduceMotion) {
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  }
  final controller = AppController(
    auth: auth ?? DemoAuth(),
    api: api ?? DemoApi(),
    prefs: MemoryTokenStore(),
    configured: true,
    social: social,
  );
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  if (reduceMotion) {
    await settle(tester);
  } else {
    // With motion on, the sign-in lanes loop and never settle: pump by time.
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }
  return controller;
}

/// The page's own list: the first scrollable on a tab, the last one on a
/// pushed route (the tab underneath stays mounted).
Future<void> scrollTo(WidgetTester tester, Finder finder, {bool pushed = false}) async {
  await tester.scrollUntilVisible(
    finder,
    300,
    scrollable: pushed ? find.byType(Scrollable).last : find.byType(Scrollable).hitTestable().first,
  );
  // Built is not the same as on screen: bring it clear of the tab bar.
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
}

/// Lets demo data arrive. The skeleton doesn't animate, so settling alone
/// would return before the sample latency has passed, and a screen only
/// starts loading on the frame after the step before it finished, hence
/// several short pumps rather than one long one.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
  await tester.pumpAndSettle();
}

/// A shipment reference, which rows set inside rich text beside its status.
Finder ref(String reference) => find.textContaining(reference, findRichText: true);

Future<void> signIn(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).at(0), 'imports@annapurna.example');
  await tester.enterText(find.byType(TextField).at(1), 'secret');
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);

  testWidgets('sign in lands on the overview with live shipments', (tester) async {
    await pumpApp(tester);
    expect(find.text('Sign in to KCPL'), findsOneWidget);
    await signIn(tester);

    expect(find.text('Annapurna Home Goods (demo)'), findsOneWidget);
    expect(find.text('4 shipments on the way'), findsOneWidget);
    expect(find.byType(FleetMap), findsOneWidget, reason: 'every shipment on its way is on the map');
    await tester.tap(find.byKey(const ValueKey('home-sheet-grabber')));
    await settle(tester);
    expect(find.text('3 free days left at Birgunj ICD.'), findsWidgets);
    await scrollTo(tester, ref('KCPL-S-24103'));
    expect(ref('KCPL-S-24103'), findsWidgets);
  });

  testWidgets('a shipment opens with its milestones and free time', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Shipments').last);
    await settle(tester);
    await tester.tap(ref('KCPL-S-24091').first);
    await settle(tester);

    expect(find.text('3 free days left at Birgunj ICD.'), findsOneWidget);
    await scrollTo(tester, find.text('Customs declaration lodged'), pushed: true);
    expect(find.text('Customs declaration lodged'), findsOneWidget);
  });

  testWidgets('the shipment filters narrow the list the way the web does', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Shipments').last);
    await settle(tester);
    expect(ref('KCPL-S-24012'), findsWidgets);

    // The chips scroll sideways on a phone, as a thumb would move them.
    await tester.scrollUntilVisible(
      find.widgetWithText(ChoiceChip, 'Needs attention'),
      120,
      scrollable: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.right).last,
    );
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Needs attention'));
    await settle(tester);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Needs attention'));
    await settle(tester);
    expect(ref('KCPL-S-24077'), findsWidgets);
    expect(ref('KCPL-S-24012'), findsNothing);
  });

  testWidgets('switching to Nepali relabels the app', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await settle(tester);
    await scrollTo(tester, find.text('नेपाली'));
    await tester.tap(find.text('नेपाली'));
    await settle(tester);
    expect(find.text('Shipments'), findsNothing);
    expect(find.text('ढुवानी'), findsWidgets);
  });

  testWidgets('a login without finance access has no invoices tab', (tester) async {
    await pumpApp(tester, api: MemberApi());
    await signIn(tester);
    expect(find.text('Invoices'), findsNothing);
    expect(find.text('Outstanding with KCPL'), findsNothing);
  });

  testWidgets('an agent can switch customer', (tester) async {
    final controller = await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await settle(tester);
    await tester.tap(find.text('Machhapuchhre Pharma (demo)'));
    await settle(tester);
    expect(controller.api.customerId, 'DEMO-MACHHAPUCHHRE');
    expect(find.text('Machhapuchhre Pharma (demo)'), findsWidgets);
  });

  testWidgets('a password Firebase accepts but KCPL refuses leaves the phone signed out', (tester) async {
    final auth = TrackingAuth();
    final controller = await pumpApp(tester, api: DeniedApi(), auth: auth);
    await signIn(tester);
    expect(find.textContaining('does not have KCPL portal access'), findsOneWidget);
    expect(controller.status, AppStatus.signedOut);
    expect(auth.signOuts, 1, reason: 'no half-signed-in credential is kept');
  });

  testWidgets('sign out returns to sign-in', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await settle(tester);
    await scrollTo(tester, find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await settle(tester);
    expect(find.text('Sign in to KCPL'), findsOneWidget);
  });

  testWidgets('large system text and Nepali never clip a screen', (tester) async {
    // A layout overflow is reported as a test failure, so visiting each
    // screen is the assertion.
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    for (final locale in ['en', 'ne']) {
      final controller = await pumpApp(tester);
      await controller.setLocale(Locale(locale));
      await settle(tester);
      await tester.enterText(find.byType(TextField).at(0), 'a@b.example');
      await tester.enterText(find.byType(TextField).at(1), 'x');
      await tester.ensureVisible(find.byType(FilledButton));
      await tester.pump();
      await tester.tap(find.byType(FilledButton));
      await settle(tester);
      for (final tab in [1, 2, 3, 4, 0]) {
        await tester.tap(find.byType(TabBarItem).at(tab));
        await settle(tester);
      }
      await tester.tap(find.byType(TabBarItem).at(1));
      await settle(tester);
      await tester.tap(ref('KCPL-S-24091').first);
      await settle(tester);
      await tester.tap(find.byType(SheetCloseButton));
      await settle(tester);
      await controller.signOut();
      await settle(tester);
    }
  });

  test('a login whose portal access was withdrawn is signed out at launch', () async {
    final auth = TrackingAuth();
    await auth.signIn('a@b.example', 'x');
    final controller = AppController(auth: auth, api: DeniedApi(), prefs: MemoryTokenStore(), configured: true);
    await controller.start();
    expect(controller.status, AppStatus.signedOut);
    expect(auth.signOuts, 1);
  });

  testWidgets('with full motion, a shipment opens from the home sheet onto its journey', (tester) async {
    await pumpApp(tester, reduceMotion: false);
    // Pumped by time, not settled: the live pulse never settles, by design.
    Future<void> run(Duration total) async {
      for (var elapsed = Duration.zero; elapsed < total; elapsed += const Duration(milliseconds: 50)) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    await tester.enterText(find.byType(TextField).at(0), 'imports@annapurna.example');
    await tester.enterText(find.byType(TextField).at(1), 'secret');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await run(const Duration(seconds: 3));

    expect(find.byType(FleetMap), findsOneWidget, reason: 'the shipments are drawn on the map');

    // A flick up carries the sheet to its top.
    await tester.fling(find.byKey(const ValueKey('home-sheet-grabber')), const Offset(0, -300), 1500);
    await run(const Duration(seconds: 1));
    await tester.tap(ref('KCPL-S-24091').last);
    await run(const Duration(seconds: 2));

    expect(find.byType(ShipmentDetailScreen), findsOneWidget);
    expect(find.byType(RouteMap), findsOneWidget, reason: 'the shipment is drawn on its own map');
    await scrollTo(tester, find.text('Customs declaration lodged'), pushed: true);
    expect(find.text('Customs declaration lodged'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a wrong password shakes the form, and the button is crimson', (tester) async {
    await pumpApp(tester, api: DeniedApi(), reduceMotion: false);
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Sign in'));
    final context = tester.element(find.widgetWithText(FilledButton, 'Sign in'));
    expect(button.style?.backgroundColor?.resolve({}), Theme.of(context).extension<Palette>()!.accent);

    await tester.enterText(find.byType(TextField).at(0), 'a@b.example');
    await tester.enterText(find.byType(TextField).at(1), 'x');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 120));
    final shaking = tester.widget<Transform>(find.descendant(of: find.byType(Shake), matching: find.byType(Transform)).first);
    expect(shaking.transform.getTranslation().x, isNot(0));
    // The lanes behind the form never settle, by design: pump by time.
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets('Continue with Google signs straight in, with email a quiet way underneath', (tester) async {
    await pumpApp(tester, social: const DemoSocial());
    expect(find.text('Continue with Apple'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.byType(TextField), findsNothing, reason: 'the email form waits until asked for');

    await tester.tap(find.text('Continue with Google'));
    await settle(tester);
    expect(find.text('4 shipments on the way'), findsOneWidget);
  });

  testWidgets('an address with a password links Google after one password sign-in', (tester) async {
    final auth = LinkingAuth();
    await pumpApp(tester, auth: auth, social: const DemoSocial());
    await tester.tap(find.text('Continue with Google'));
    await settle(tester);

    expect(find.textContaining('already has a KCPL password'), findsOneWidget);
    expect(find.text('imports@annapurna.example'), findsOneWidget, reason: 'the address is filled in');
    await tester.enterText(find.byType(TextField).at(1), 'secret');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);

    expect(auth.password, 'secret');
    expect(auth.linked?.providerId, 'google.com');
    expect(find.text('4 shipments on the way'), findsOneWidget);
  });
}
