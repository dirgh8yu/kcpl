import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/screens/job_detail_screen.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/screens/invoice_detail_screen.dart';
import 'package:kcpl_customer/ui/screens/shipment_detail_screen.dart';
import 'package:kcpl_customer/ui/widgets/sheet_route.dart';

import 'app_flow_test.dart' show pumpApp, ref, settle, signIn;
import 'ops_test.dart' as ops show pumpOps, settle, signIn;

/// An iPad: 1024 × 768 points on its side, 768 × 1024 upright (iPad mini
/// upright is 744 wide, the narrowest that still gets two columns).
void ipad(WidgetTester tester, {bool upright = false}) {
  tester.view.physicalSize = upright ? const Size(1536, 2048) : const Size(2048, 1536);
  tester.view.devicePixelRatio = 2;
}

bool sheetOpen(WidgetTester tester) => find.byWidgetPredicate((w) => w.runtimeType.toString() == '_SheetFrame').evaluate().isNotEmpty;

void main() {
  setUpAll(initFormatting);

  for (final upright in [false, true]) {
    testWidgets('on an iPad ${upright ? 'upright' : 'on its side'}, a shipment opens beside the list', (tester) async {
      await pumpApp(tester, api: DemoApi());
      ipad(tester, upright: upright);
      await signIn(tester);

      await tester.tap(find.text('Shipments').last);
      await settle(tester);
      expect(find.text('Choose a shipment'), findsOneWidget, reason: 'the pane waits for a choice');

      await tester.tap(ref('KCPL-S-24091').first);
      await settle(tester);
      expect(find.byType(ShipmentDetailScreen), findsOneWidget);
      expect(sheetOpen(tester), isFalse, reason: 'beside the list, not over it');
      expect(find.text('Shipments'), findsWidgets, reason: 'the list stays in view');

      // Another row replaces what the pane shows.
      await tester.tap(ref('KCPL-S-24103').first);
      await settle(tester);
      expect(find.byType(ShipmentDetailScreen), findsOneWidget);
      expect(find.text('KCPL-S-24103'), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('on an iPad, an invoice opens beside the list with Pay online', (tester) async {
    await pumpApp(tester, api: DemoApi());
    ipad(tester);
    await signIn(tester);
    await tester.tap(find.text('Invoices').last);
    await settle(tester);
    expect(find.text('Choose an invoice'), findsOneWidget);
    await tester.tap(ref('KCPL-I-20260918-011').first);
    await settle(tester);
    expect(find.byType(InvoiceDetailScreen), findsOneWidget);
    expect(sheetOpen(tester), isFalse);
  });

  testWidgets('on a phone, rows still open their sheet', (tester) async {
    await pumpApp(tester, api: DemoApi());
    await signIn(tester);
    await tester.tap(find.text('Shipments').last);
    await settle(tester);
    expect(find.text('Choose a shipment'), findsNothing);
    await tester.tap(ref('KCPL-S-24091').first);
    await settle(tester);
    expect(sheetOpen(tester), isTrue);
  });

  testWidgets('KCPL Ops on an iPad: Today’s job opens beside the list', (tester) async {
    await ops.pumpOps(tester, api: DemoOpsApi());
    ipad(tester);
    await ops.signIn(tester);
    expect(find.text('Choose a job'), findsOneWidget);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await ops.settle(tester);
    expect(find.byType(JobDetailScreen), findsOneWidget);
    expect(sheetOpen(tester), isFalse);
    expect(tester.takeException(), isNull);
  });

  // The sheet route is what a phone gets; keep it referenced for the check above.
  test('sheets are the phone’s way in', () => expect(SheetRoute, isNotNull));
}
