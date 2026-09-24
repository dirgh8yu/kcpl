import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/map/map_data.dart';
import 'package:kcpl_customer/ui/map/places.dart';
import 'package:kcpl_customer/ui/map/route_map.dart';
import 'package:kcpl_customer/ui/theme.dart';
import 'package:kcpl_customer/ui/widgets/stats.dart';

Future<void> pumpStill(WidgetTester tester, Widget child) async {
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  await tester.pumpWidget(
    MaterialApp(
      theme: kcplTheme(Brightness.light),
      home: Scaffold(body: Center(child: child)),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('places', () {
    test('desk spellings of the same place land on the same point', () {
      final icd = locate('Birgunj ICD, Nepal');
      expect(icd, isNotNull);
      expect(locate('ICD Birgunj'), isNotNull);
      // The longer name wins: the dry port, not the town.
      expect(locate('Birgunj ICD')!.lat, icd!.lat);
      expect(locate('Birgunj, Nepal')!.lat, isNot(icd.lat));
      expect(locate('Kathmandu (TIA), Nepal'), locate('Tribhuvan airport'));
    });

    test('an unknown place is left off the map rather than guessed', () {
      expect(locate('Somewhere, Nowhere'), isNull);
      expect(locate(''), isNull);
      expect(locate(null), isNull);
      // Known, but beyond the land the map carries.
      expect(locate('Rotterdam')!.onMap, isFalse);
      expect(locate('Kolkata')!.onMap, isTrue);
    });

    test('a route is drawn only when both ends are known and one is on the map', () {
      expect(RouteMap.canDraw('Haldia, India', 'Biratnagar, Nepal'), isTrue);
      expect(RouteMap.canDraw('Rotterdam', 'Kathmandu'), isTrue, reason: 'it leaves the frame towards Europe');
      expect(RouteMap.canDraw('Rotterdam', 'Hamburg'), isFalse);
      expect(RouteMap.canDraw('Kathmandu', 'Kathmandu, Nepal'), isFalse, reason: 'no journey to draw');
      expect(RouteMap.canDraw('Unknown port', 'Kathmandu'), isFalse);
    });
  });

  test('the bundled map decodes, with roads, water and Nepal\'s towns', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final map = await MapData.load();
    expect(map.places.map((p) => p.name), containsAll(['Kathmandu', 'Birganj', 'Biratnagar', 'Kolkata']));
    for (final path in [map.land, map.lakes, map.roadsMajor, map.borders]) {
      final bounds = path.getBounds();
      expect(bounds.isEmpty, isFalse);
      // Everything sits inside the frame the map covers.
      expect(bounds.left, greaterThanOrEqualTo(mapWest - 1));
      expect(bounds.right, lessThanOrEqualTo(mapEast + 1));
      expect(bounds.top, greaterThanOrEqualTo(mercatorY(mapNorth) - 1));
      expect(bounds.bottom, lessThanOrEqualTo(mercatorY(mapSouth) + 1));
    }
    expect(map.roadsMajor.contains(Offset(85.32, mercatorY(27.7))), isFalse, reason: 'roads are lines, not areas');
  });

  testWidgets('a route map draws, including one leaving the frame', (tester) async {
    await tester.runAsync(MapData.load);
    await pumpStill(
      tester,
      const SizedBox(
        width: 340,
        height: 190,
        child: RouteMap(
          origin: 'Rotterdam, Netherlands',
          destination: 'Kathmandu, Nepal',
          current: 'Kolkata',
          progress: 0.5,
          vehicle: KIcons.sea,
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(CustomPaint), findsWidgets);
  });

  testWidgets('a figure is crimson only when something has gone wrong', (tester) async {
    await pumpStill(
      tester,
      const SizedBox(
        width: 360,
        child: StatRow(stats: [Stat('Active', 4), Stat('Overdue', 1, attention: true), Stat('Exceptions', 0, attention: true)]),
      ),
    );
    Color? colour(String text) => tester.widget<Text>(find.text(text)).style?.color;
    final accent = Theme.of(tester.element(find.byType(StatRow))).extension<Palette>()!.accent;
    expect(colour('1'), accent);
    expect(colour('4'), isNot(accent));
    expect(colour('0'), isNot(accent), reason: 'nothing wrong, nothing red');
  });
}
