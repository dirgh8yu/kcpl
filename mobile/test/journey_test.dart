import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/theme.dart';
import 'package:kcpl_customer/ui/widgets/journey.dart';

Future<void> pumpBar(WidgetTester tester, String status) => tester.pumpWidget(
  MaterialApp(
    theme: kcplTheme(Brightness.light),
    home: Scaffold(body: SizedBox(width: 200, child: JourneyBar(status: status))),
  ),
);

void main() {
  test('rows show the bar while the shipment is on its way, not once delivered or held', () {
    for (final status in ['booking_confirmed', 'preparing', 'in_transit', 'customs_clearance', 'out_for_delivery']) {
      expect(journeyShowsBar(status), isTrue, reason: status);
    }
    expect(journeyShowsBar('delivered'), isFalse);
    expect(journeyShowsBar('exception'), isFalse);
  });

  testWidgets('a moving shipment says how far along it is', (tester) async {
    await pumpBar(tester, 'customs_clearance');
    expect(find.descendant(of: find.byType(JourneyBar), matching: find.byType(ColoredBox)), findsWidgets);
    expect(find.byWidgetPredicate((widget) => widget is Semantics && widget.properties.value == '3 / $journeyStageCount'), findsOneWidget);
  });

  testWidgets('a held shipment claims no stage', (tester) async {
    // The record keeps only the current status; a filled bar would be a guess.
    await pumpBar(tester, 'exception');
    expect(find.descendant(of: find.byType(JourneyBar), matching: find.byType(ColoredBox)), findsNothing);
  });
}
