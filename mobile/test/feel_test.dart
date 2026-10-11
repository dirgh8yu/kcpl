import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ops/screens/jobs_screen.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/motion.dart';
import 'package:kcpl_customer/ui/screens/account_screen.dart';
import 'package:kcpl_customer/ui/screens/claim_screens.dart';
import 'package:kcpl_customer/ui/widgets/sheet_route.dart';

import 'app_flow_test.dart' show pumpApp, settle, signIn;
import 'ops_test.dart' show pumpOps;
import 'send_flows_test.dart' show openShipment, sheetScrollTo;

/// The innermost list running down [screen].
ScrollPosition _list(WidgetTester tester, Type screen) => tester
    .state<ScrollableState>(
      find.descendant(of: find.byType(screen), matching: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down)).first,
    )
    .position;

void main() {
  setUpAll(initFormatting);

  testWidgets('a pressed card lets go once the finger starts to scroll', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Center(child: Pressable(child: ColoredBox(color: Color(0xFFDDDDDD), child: SizedBox(width: 200, height: 120))))));
    double scale() => tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale;

    final finger = await tester.startGesture(tester.getCenter(find.byType(Pressable)));
    await tester.pump();
    expect(scale(), 0.97, reason: 'it presses in the moment the finger lands');

    await finger.moveBy(const Offset(0, 4));
    await tester.pump();
    expect(scale(), 0.97, reason: 'a tremble is still a press');

    await finger.moveBy(const Offset(0, 30));
    await tester.pump();
    expect(scale(), 1, reason: 'past the touch slop it is a scroll, not a press');
    await finger.up();
    await tester.pumpAndSettle();
  });

  testWidgets('tapping the tab already open takes it back to the top', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Account').last);
    await settle(tester);

    await tester.drag(find.byType(AccountScreen), const Offset(0, -400));
    await settle(tester);
    expect(_list(tester, AccountScreen).pixels, greaterThan(0));

    await tester.tap(find.text('Account').last);
    await settle(tester);
    expect(_list(tester, AccountScreen).pixels, 0);
  });

  testWidgets('in KCPL Ops too', (tester) async {
    await pumpOps(tester);
    await tester.enterText(find.byType(TextField).at(0), 'anil@kcpl.example');
    await tester.enterText(find.byType(TextField).at(1), 'secret');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);
    await tester.tap(find.text('Jobs').last);
    await settle(tester);
    // A short phone, so the five sample jobs run past the bottom.
    tester.view.physicalSize = const Size(1170, 1200);
    await settle(tester);

    _list(tester, JobsScreen).jumpTo(80);
    await settle(tester);
    expect(_list(tester, JobsScreen).pixels, 80);
    await tester.tap(find.text('Jobs').last);
    await settle(tester);
    expect(_list(tester, JobsScreen).pixels, 0);
  });

  testWidgets('claims open as a sheet over the shipment, like its messages and estimates', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24012');
    await sheetScrollTo(tester, find.text('Report damage or loss'));
    await tester.tap(find.text('Report damage or loss'));
    await settle(tester);
    expect(find.byType(ClaimsScreen), findsOneWidget);
    expect(SheetRoute.of(tester.element(find.byType(ClaimsScreen))), isTrue);
  });
}
