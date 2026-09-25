import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/screens/shipment_detail_screen.dart';

import 'app_flow_test.dart' show pumpApp, ref;

/// Pumps by time: with motion on, loops never let the app settle.
Future<void> run(WidgetTester tester, [Duration total = const Duration(seconds: 1)]) async {
  for (var t = Duration.zero; t < total; t += const Duration(milliseconds: 50)) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  for (final reduceMotion in [true, false]) {
    testWidgets('a detail sheet decides by the flick, then by distance (reduce motion: $reduceMotion)', (tester) async {
      await pumpApp(tester, reduceMotion: reduceMotion);
      await tester.enterText(find.byType(TextField).at(0), 'imports@annapurna.example');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await run(tester, const Duration(seconds: 3));
      await tester.tap(find.text('Shipments').last);
      await run(tester);
      await tester.tap(ref('KCPL-S-24077').first);
      await run(tester);
      expect(find.byType(ShipmentDetailScreen), findsOneWidget);

      // A short, slow pull that pauses before letting go has no momentum:
      // it springs back.
      final slow = await tester.startGesture(const Offset(195, 200));
      for (var i = 0; i < 15; i++) {
        await slow.moveBy(const Offset(0, 10));
        await tester.pump(const Duration(milliseconds: 40));
      }
      await tester.pump(const Duration(milliseconds: 300));
      await slow.up();
      await run(tester);
      expect(find.byType(ShipmentDetailScreen), findsOneWidget, reason: 'a slow short pull springs back');

      // A quick flick down closes it, however short.
      final flick = await tester.startGesture(const Offset(195, 200));
      for (var i = 0; i < 6; i++) {
        await flick.moveBy(const Offset(0, 17));
        await tester.pump(const Duration(milliseconds: 15));
      }
      await flick.up();
      await run(tester);
      expect(find.byType(ShipmentDetailScreen), findsNothing, reason: 'a flick closes');
      expect(tester.takeException(), isNull);
    });
  }
}
