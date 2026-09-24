import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/api/kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/auth_repository.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/ui/format.dart';

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

  @override
  Future<OverviewBundle> overview() async => OverviewBundle(await session(), (await super.overview()).overview);
}

/// Firebase accepts the password; KCPL does not grant portal access.
class DeniedApi extends DemoApi {
  @override
  Future<SessionView> session() async =>
      throw const ApiException(403, 'denied', 'This account does not have KCPL portal access. Contact your KCPL account manager.');
}

class TrackingAuth extends DemoAuth {
  int signOuts = 0;
  @override
  Future<void> signOut() {
    signOuts++;
    return super.signOut();
  }
}

Future<AppController> pumpApp(WidgetTester tester, {KcplApi? api, AuthRepository? auth}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final controller = AppController(auth: auth ?? DemoAuth(), api: api ?? DemoApi(), prefs: MemoryTokenStore(), configured: true);
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await tester.pumpAndSettle();
  return controller;
}

/// The page's own list: the first scrollable on a tab, the last one on a
/// pushed route (the tab underneath stays mounted).
Future<void> scrollTo(WidgetTester tester, Finder finder, {bool pushed = false}) => tester.scrollUntilVisible(
      finder,
      300,
      scrollable: pushed ? find.byType(Scrollable).last : find.byType(Scrollable).first,
    );

Future<void> signIn(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).at(0), 'imports@annapurna.example');
  await tester.enterText(find.byType(TextField).at(1), 'secret');
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initFormatting);

  testWidgets('sign in lands on the overview with live shipments', (tester) async {
    await pumpApp(tester);
    expect(find.text('Sign in to KCPL'), findsOneWidget);
    await signIn(tester);

    expect(find.text('Annapurna Home Goods (demo)'), findsOneWidget);
    expect(find.text('Active shipments'), findsWidgets);
    expect(find.text('Free time running out'), findsWidgets);
    await scrollTo(tester, find.text('KCPL-S-24103'));
    expect(find.text('KCPL-S-24103'), findsOneWidget);
  });

  testWidgets('a shipment opens with its milestones and free time', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Shipments').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('KCPL-S-24091'));
    await tester.pumpAndSettle();

    expect(find.text('3 free days left at Birgunj ICD.'), findsOneWidget);
    await scrollTo(tester, find.text('Customs declaration lodged'), pushed: true);
    expect(find.text('Customs declaration lodged'), findsOneWidget);
  });

  testWidgets('the shipment filters narrow the list the way the web does', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Shipments').last);
    await tester.pumpAndSettle();
    expect(find.text('KCPL-S-24012'), findsOneWidget);

    // The chips scroll sideways on a phone, as a thumb would move them.
    await tester.scrollUntilVisible(
      find.widgetWithText(ChoiceChip, 'Needs attention'),
      120,
      scrollable: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.right).last,
    );
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Needs attention'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, 'Needs attention'));
    await tester.pumpAndSettle();
    expect(find.text('KCPL-S-24077'), findsOneWidget);
    expect(find.text('KCPL-S-24012'), findsNothing);
  });

  testWidgets('switching to Nepali relabels the app', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await tester.pumpAndSettle();
    await scrollTo(tester, find.text('नेपाली'));
    await tester.tap(find.text('नेपाली'));
    await tester.pumpAndSettle();
    expect(find.text('Shipments'), findsNothing);
    expect(find.text('ढुवानी'), findsWidgets);
  });

  testWidgets('a login without finance access has no invoices tab', (tester) async {
    await pumpApp(tester, api: MemberApi());
    await signIn(tester);
    expect(find.text('Invoices'), findsNothing);
    expect(find.text('Outstanding with KCPL'), findsNothing, reason: 'the demo overview carries finance; the tab set must not');
  });

  testWidgets('an agent can switch customer', (tester) async {
    final controller = await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Machhapuchhre Pharma (demo)'));
    await tester.pumpAndSettle();
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
    await tester.pumpAndSettle();
    await scrollTo(tester, find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
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
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(0), 'a@b.example');
      await tester.enterText(find.byType(TextField).at(1), 'x');
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      for (final tab in [1, 2, 3, 4, 0]) {
        await tester.tap(find.byType(NavigationDestination).at(tab));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.byType(NavigationDestination).at(1));
      await tester.pumpAndSettle();
      await tester.tap(find.text('KCPL-S-24091'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await controller.signOut();
      await tester.pumpAndSettle();
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
}
