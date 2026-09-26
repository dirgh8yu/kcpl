import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/screens/driver_screen.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/screens/estimate_screens.dart';
import 'package:kcpl_customer/ui/screens/home_shell.dart';
import 'package:kcpl_customer/ui/icons.dart';
import 'package:kcpl_customer/ui/widgets/common.dart' show Footnote, RowTile;
import 'package:kcpl_customer/ui/widgets/large_title.dart' show SheetCloseButton;
import 'package:kcpl_customer/ui/widgets/tab_bar.dart' show TabBarItem;
import 'package:kcpl_customer/ui/widgets/message_thread.dart';
import 'package:kcpl_customer/ui/widgets/rate_delivery.dart';
import 'package:kcpl_customer/ui/widgets/rows.dart' as rows show openShipment;

import 'app_flow_test.dart' show pumpApp, ref, scrollTo, settle, signIn;
import 'ops_test.dart' as ops show pumpOps, settle, signIn, tapInView;
import 'send_flows_test.dart' show openShipment, sheetScrollTo;

/// VoiceOver and TalkBack: every control says what it is, is big enough for
/// a thumb (Apple's 44 points; the app follows iOS), and its words can be
/// read against what is behind them.
Future<void> audit(WidgetTester tester, String where) async {
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline), reason: '$where: every control is named');
  await expectLater(tester, meetsGuideline(iOSTapTargetGuideline), reason: '$where: 44-point targets');
  await expectLater(tester, meetsGuideline(textContrastGuideline), reason: '$where: text contrast');
}

Future<void> close(WidgetTester tester) async {
  await tester.tap(find.byType(SheetCloseButton).last);
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);

  testWidgets('the customer app’s newest screens pass the accessibility guidelines', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpApp(tester, api: DemoApi());
    await signIn(tester);
    await audit(tester, 'overview');

    await openShipment(tester, 'KCPL-S-24012');
    await audit(tester, 'delivered shipment');
    await sheetScrollTo(tester, find.text('How did this delivery go?'));
    await tester.tap(find.byTooltip('4 out of 5'));
    await settle(tester);
    await audit(tester, 'rating card');
    await close(tester);

    await openShipment(tester, 'KCPL-S-24091');
    await sheetScrollTo(tester, find.text('Message KCPL'));
    await audit(tester, 'shipment tools');
    await tester.tap(find.text('Message KCPL'));
    await settle(tester);
    await audit(tester, 'message thread');
    await close(tester);

    final context = tester.element(find.byType(HomeShell));
    openDutyEstimate(context).ignore();
    await settle(tester);
    await audit(tester, 'duty estimate');
    await close(tester);
    semantics.dispose();
  });

  testWidgets('proof of delivery, pickup, statement, text notices and a document request pass too', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpApp(tester, api: DemoApi());
    await signIn(tester);

    await openShipment(tester, 'KCPL-S-24012');
    await audit(tester, 'proof of delivery');
    await close(tester);

    await tester.tap(find.text('Invoices').last);
    await settle(tester);
    await audit(tester, 'invoices with the statement');

    await tester.tap(find.text('Account').last);
    await settle(tester);
    await tester.tap(find.text('Quotes'));
    await settle(tester);
    await tester.tap(find.byWidgetPredicate((w) => w.runtimeType.toString() == '_QuoteRow').first);
    await settle(tester);
    await sheetScrollTo(tester, find.text('KCPL picks up the cargo'));
    await tester.tap(find.byType(Switch).last);
    await settle(tester);
    await sheetScrollTo(tester, find.text('Pickup address'));
    await audit(tester, 'pickup');
    await close(tester);
    await close(tester);

    await scrollTo(tester, find.widgetWithText(RowTile, 'SMS and WhatsApp'));
    await tester.tap(find.widgetWithText(RowTile, 'SMS and WhatsApp'));
    await settle(tester);
    await tester.tap(find.text('SMS'));
    await settle(tester);
    await audit(tester, 'text notices');
    await close(tester);

    rows.openShipment(tester.element(find.byType(HomeShell)), 'KCPL-S-24077', sendType: 'packing_list');
    await settle(tester);
    await audit(tester, 'document request');
    semantics.dispose();
  });

  testWidgets('KCPL Ops’ newest screens pass the accessibility guidelines', (tester) async {
    final semantics = tester.ensureSemantics();
    await ops.pumpOps(tester, api: DemoOpsApi());
    await ops.signIn(tester);
    await audit(tester, 'today');

    openDriver(tester.element(find.byType(Scaffold).first));
    await ops.settle(tester);
    await audit(tester, 'driver mode');
    await close(tester);

    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await ops.settle(tester);
    await ops.tapInView(tester, find.text('Messages with the customer'));
    await audit(tester, 'job detail');
    await tester.tap(find.text('Messages with the customer'));
    await ops.settle(tester);
    await audit(tester, 'customer thread');
    semantics.dispose();
  });

  testWidgets('storage estimate passes too', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpApp(tester, api: DemoApi());
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24091');
    await sheetScrollTo(tester, find.text('What will storage cost?'));
    await tester.tap(find.text('What will storage cost?'));
    await settle(tester);
    await audit(tester, 'storage estimate');
    semantics.dispose();
  });

  testWidgets('every customer screen passes the accessibility guidelines', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpApp(tester, api: DemoApi());
    await audit(tester, 'sign-in');
    await signIn(tester);
    await audit(tester, 'overview');
    for (final tab in ['Shipments', 'Documents', 'Invoices', 'Account']) {
      await tester.tap(find.text(tab).last);
      await settle(tester);
      await audit(tester, tab);
      // Further down, at rest (not mid-way under the bar).
      await tester.drag(find.byType(Scrollable).hitTestable().first, const Offset(0, -700));
      await settle(tester);
      await audit(tester, '$tab, further down');
    }
    await openShipment(tester, 'KCPL-S-24077');
    await audit(tester, 'shipment waiting on documents');
    await close(tester);
    await tester.tap(find.text('Invoices').last);
    await settle(tester);
    await tester.tap(ref('KCPL-I-20260918-011').first);
    await settle(tester);
    await audit(tester, 'invoice');
    await tester.tap(find.text('Pay online'));
    await settle(tester);
    await audit(tester, 'pay');
    semantics.dispose();
  });

  testWidgets('every KCPL Ops tab and the job file pass the accessibility guidelines', (tester) async {
    final semantics = tester.ensureSemantics();
    await ops.pumpOps(tester, api: DemoOpsApi());
    await audit(tester, 'ops sign-in');
    await ops.signIn(tester);
    for (final tab in ['Jobs', 'Alerts', 'Me']) {
      await tester.tap(find.text(tab).last);
      await ops.settle(tester);
      await audit(tester, 'ops $tab');
    }
    await tester.tap(find.text('Jobs').last);
    await ops.settle(tester);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await ops.settle(tester);
    await audit(tester, 'ops job file');
    semantics.dispose();
  });

  testWidgets('large system text in Nepali never clips the newest customer screens', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final controller = await pumpApp(tester, api: DemoApi());
    await controller.setLocale(const Locale('ne'));
    await settle(tester);
    await tester.enterText(find.byType(TextField).at(0), 'a@b.example');
    await tester.enterText(find.byType(TextField).at(1), 'x');
    await tester.ensureVisible(find.byType(FilledButton));
    await tester.pump();
    await tester.tap(find.byType(FilledButton));
    await settle(tester);

    await tester.tap(find.byType(TabBarItem).at(1));
    await settle(tester);
    await scrollTo(tester, ref('KCPL-S-24012'));
    await tester.tap(ref('KCPL-S-24012').first);
    await settle(tester);
    await sheetScrollTo(tester, find.byType(RateDeliveryCard));
    await tester.tap(find.descendant(of: find.byType(RateDeliveryCard), matching: find.byIcon(KIcons.star)).first);
    await settle(tester);
    await sheetScrollTo(tester, find.byIcon(KIcons.message));
    await tester.tap(find.byIcon(KIcons.message).first);
    await settle(tester);
    expect(find.byType(MessageThreadScreen), findsOneWidget);
    await close(tester);
    await close(tester);

    await scrollTo(tester, ref('KCPL-S-24091'));
    await tester.tap(ref('KCPL-S-24091').first);
    await settle(tester);
    await sheetScrollTo(tester, find.text('भण्डारण शुल्क कति लाग्छ?'));
    await tester.tap(find.text('भण्डारण शुल्क कति लाग्छ?'));
    await settle(tester);
    expect(find.byType(StorageEstimateScreen), findsOneWidget);
    await close(tester);
    await sheetScrollTo(tester, find.text('भन्सार महसुल अनुमान'));
    await tester.tap(find.text('भन्सार महसुल अनुमान'));
    await settle(tester);
    await tester.enterText(find.byType(TextField).last, '250000');
    await settle(tester);
    await sheetScrollTo(tester, find.byType(Footnote));
    expect(tester.takeException(), isNull);
  });

  testWidgets('large system text in Nepali never clips driver mode or the customer thread in KCPL Ops', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final controller = await ops.pumpOps(tester, api: DemoOpsApi());
    await controller.setLocale(const Locale('ne'));
    await ops.settle(tester);
    await tester.enterText(find.byType(TextField).at(0), 'anil@kcpl.example');
    await tester.enterText(find.byType(TextField).at(1), 'secret');
    await tester.ensureVisible(find.byType(FilledButton));
    await tester.pump();
    await tester.tap(find.byType(FilledButton));
    await ops.settle(tester);

    openDriver(tester.element(find.byType(Scaffold).first));
    await ops.settle(tester);
    expect(find.byType(DriverScreen), findsOneWidget);
    await close(tester);

    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await ops.settle(tester);
    await ops.tapInView(tester, find.text('ग्राहकसँगका सन्देश'));
    // Mid-screen, clear of the bar the page scrolls under.
    await Scrollable.ensureVisible(tester.element(find.text('ग्राहकसँगका सन्देश')), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(find.text('ग्राहकसँगका सन्देश'));
    await ops.settle(tester);
    expect(find.byType(MessageThreadScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
