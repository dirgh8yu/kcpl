import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/theme.dart';
import 'package:kcpl_customer/ui/widgets/brand_hero.dart';

Future<void> _pump(WidgetTester tester, {required bool reduceMotion}) async {
  if (reduceMotion) {
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  }
  await tester.pumpWidget(
    MaterialApp(
      theme: kcplTheme(Brightness.light),
      home: const Scaffold(body: BrandHero(height: 320)),
    ),
  );
}

double _opacityOf(WidgetTester tester, String text) =>
    tester.widget<Opacity>(find.ancestor(of: find.text(text), matching: find.byType(Opacity)).first).opacity;

void main() {
  testWidgets('the name rises out of the K once, and then holds still', (tester) async {
    await _pump(tester, reduceMotion: false);
    expect(_opacityOf(tester, 'Kapileshwor Cargo'), 0, reason: 'the K comes first');
    await tester.pump(const Duration(milliseconds: 1200));
    final midway = tester.getTopLeft(find.text('Kapileshwor Cargo')).dy;
    await tester.pumpAndSettle();
    expect(_opacityOf(tester, 'Kapileshwor Cargo'), 1);
    expect(_opacityOf(tester, 'PVT. LTD.'), 1);
    expect(tester.getTopLeft(find.text('Kapileshwor Cargo')).dy, lessThan(midway), reason: 'it rises');
    expect(tester.hasRunningAnimations, isFalse, reason: 'it plays once, not in a loop');
  });

  testWidgets('under Reduce Motion the lockup is simply there', (tester) async {
    await _pump(tester, reduceMotion: true);
    await tester.pump();
    expect(_opacityOf(tester, 'Kapileshwor Cargo'), 1);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('the panel is KCPL crimson and reads as the company name', (tester) async {
    final semantics = tester.ensureSemantics();
    await _pump(tester, reduceMotion: true);
    final box = tester.widget<ColoredBox>(
      find.descendant(of: find.byType(BrandHero), matching: find.byType(ColoredBox)).first,
    );
    expect(box.color, KcplColors.crimson);
    expect(find.bySemanticsLabel('Kapileshwor Cargo Pvt. Ltd.'), findsOneWidget);
    semantics.dispose();
  });
}
