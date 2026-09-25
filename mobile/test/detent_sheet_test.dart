import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/widgets/detent_sheet.dart';

const _detents = [200.0, 400.0, 750.0];

/// A sheet on an 800-tall screen with 40 rows of content.
Future<({ValueNotifier<double> extent, List<int> refreshes})> _pump(WidgetTester tester, {bool reduceMotion = false}) async {
  tester.view.physicalSize = const Size(400, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  if (reduceMotion) {
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  }
  final extent = ValueNotifier<double>(0);
  final refreshes = <int>[];
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: DetentSheet(
          detents: (_) => _detents,
          initial: 1,
          extent: extent,
          onRefresh: () => refreshes.add(refreshes.length),
          builder: (context, controller) => ColoredBox(
            color: Colors.white,
            child: ListView.builder(
              controller: controller,
              itemCount: 40,
              itemBuilder: (context, i) => SizedBox(height: 50, child: Text('row $i')),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (extent: extent, refreshes: refreshes);
}

/// The top of the sheet on screen.
double _top(WidgetTester tester) => tester.getTopLeft(find.text('row 0')).dy;

void main() {
  for (final reduceMotion in [false, true]) {
    testWidgets('a slow drag settles at the nearest height (reduce motion: $reduceMotion)', (tester) async {
      final sheet = await _pump(tester, reduceMotion: reduceMotion);
      expect(sheet.extent.value, 400);
      // Up 120 slowly, a pause, then let go: nearer 400 than 750.
      final gesture = await tester.startGesture(const Offset(200, 500));
      for (var i = 0; i < 12; i++) {
        await gesture.moveBy(const Offset(0, -10));
        await tester.pump(const Duration(milliseconds: 50));
      }
      await tester.pump(const Duration(milliseconds: 300));
      await gesture.up();
      await tester.pumpAndSettle();
      expect(sheet.extent.value, 400);
      expect(_top(tester), 400);
    });
  }

  testWidgets('a flick carries the sheet where its momentum projects', (tester) async {
    final sheet = await _pump(tester);
    // A short, fast flick up from the middle goes all the way up.
    await tester.fling(find.text('row 0'), const Offset(0, -60), 1500);
    await tester.pumpAndSettle();
    expect(sheet.extent.value, 750);
    // And a flick down from the top comes all the way down.
    await tester.fling(find.text('row 0'), const Offset(0, 60), 2500);
    await tester.pumpAndSettle();
    expect(sheet.extent.value, 200);
  });

  testWidgets('the content scrolls only once the sheet is fully up', (tester) async {
    final sheet = await _pump(tester);
    await tester.drag(find.text('row 0'), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(sheet.extent.value, 750);
    // Unscrolled, row 4 would sit 200 below the sheet's top edge at 50.
    expect(tester.getTopLeft(find.text('row 4')).dy, lessThan(250), reason: 'what the sheet did not take, the list scrolled');
    // Scrolled content comes back down before the sheet does.
    await tester.drag(find.text('row 5'), const Offset(0, 200));
    await tester.pumpAndSettle();
    expect(sheet.extent.value, 750);
  });

  testWidgets('pulled well below its lowest height, it refreshes once and settles back', (tester) async {
    final sheet = await _pump(tester);
    await tester.drag(find.text('row 0'), const Offset(0, 500));
    await tester.pumpAndSettle();
    expect(sheet.refreshes, hasLength(1));
    expect(sheet.extent.value, 200);
    // A relayout afterwards does not pull it again.
    tester.view.physicalSize = const Size(400, 801);
    await tester.pumpAndSettle();
    expect(sheet.refreshes, hasLength(1));
  });

  testWidgets('a touch catches the sheet mid-flight', (tester) async {
    final sheet = await _pump(tester);
    await tester.fling(find.text('row 0'), const Offset(0, -60), 1500);
    await tester.pump(const Duration(milliseconds: 40));
    final caught = sheet.extent.value;
    expect(caught, inExclusiveRange(400, 750));
    final hold = await tester.startGesture(Offset(200, 800 - caught + 20));
    await tester.pump(const Duration(milliseconds: 100));
    expect(sheet.extent.value, caught, reason: 'held where the finger landed');
    await hold.up();
    await tester.pumpAndSettle();
    expect(_detents, contains(sheet.extent.value));
  });
}
