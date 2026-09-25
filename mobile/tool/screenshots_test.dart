// iPhone screenshots of both apps on demo data, light and dark, for design
// review. Not part of the test suite; run it on purpose:
//
//   flutter test tool/screenshots_test.dart --update-goldens
//
// PNGs land in tool/screenshots/ (git-ignored). SF Pro is not available off
// Apple hardware, so Inter stands in for it; sizes, weights and spacing are
// the app's own.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/ops/main.dart';
import 'package:kcpl_customer/ops/ops_controller.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/widgets/large_title.dart';

Future<void> _font(String family, List<String> paths) async {
  final loader = FontLoader(family);
  for (final path in paths) {
    loader.addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  }
  await loader.load();
}

Future<void> _fonts() async {
  const inter = ['test/fonts/Inter-Regular.ttf', 'test/fonts/Inter-Medium.ttf', 'test/fonts/Inter-SemiBold.ttf'];
  await _font('CupertinoSystemText', inter);
  await _font('CupertinoSystemDisplay', inter);
  await _font('Roboto', inter);
  final config = File('.dart_tool/package_config.json').readAsStringSync();
  final root = RegExp(r'"name":\s*"cupertino_icons",\s*"rootUri":\s*"file://([^"]+)"').firstMatch(config)!.group(1)!;
  await _font('packages/cupertino_icons/CupertinoIcons', ['$root/assets/CupertinoIcons.ttf']);
  await _font('PhosphorRegular', ['assets/fonts/Phosphor-Regular.ttf']);
  await _font('PhosphorFill', ['assets/fonts/Phosphor-Fill.ttf']);
  await _font('NotoSansDevanagari', ['assets/fonts/NotoSansDevanagari-Regular.ttf', 'assets/fonts/NotoSansDevanagari-SemiBold.ttf']);
}

Future<void> _phone(WidgetTester tester, {bool dark = false}) async {
  tester.view.physicalSize = const Size(1179, 2556);
  tester.view.devicePixelRatio = 3;
  tester.view.padding = const FakeViewPadding(top: 59 * 3, bottom: 34 * 3);
  tester.view.viewPadding = const FakeViewPadding(top: 59 * 3, bottom: 34 * 3);
  tester.platformDispatcher.platformBrightnessTestValue = dark ? Brightness.dark : Brightness.light;
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(() {
    tester.view.reset();
    tester.platformDispatcher.clearAllTestValues();
  });
}

Future<void> _wait(WidgetTester tester, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _shot(WidgetTester tester, String name) async {
  await _wait(tester);
  await expectLater(find.byWidgetPredicate((w) => w is MaterialApp).first, matchesGoldenFile('screenshots/$name.png'));
}

Future<void> _signIn(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), 'secret');
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await _wait(tester, 30);
}

Future<void> _tab(WidgetTester tester, String label) async {
  await tester.tap(find.text(label).last);
  await _wait(tester);
}

void main() {
  setUpAll(() async {
    initFormatting();
    await _fonts();
  });
  final iPhone = TargetPlatformVariant.only(TargetPlatform.iOS);

  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';

    testWidgets('customer $mode', (tester) async {
      await _phone(tester, dark: dark);
      final controller = AppController(auth: DemoAuth(), api: DemoApi(), prefs: MemoryTokenStore(), configured: true);
      await controller.start();
      await tester.pumpWidget(KcplApp(controller: controller, demo: true));
      await _wait(tester, 20);
      await _shot(tester, 'customer-$mode-1-sign-in');
      await _signIn(tester, 'imports@annapurna.example');
      await _shot(tester, 'customer-$mode-2-home');
      await tester.drag(find.byKey(const ValueKey('home-sheet-grabber')), const Offset(0, -330));
      await _wait(tester, 20);
      await _shot(tester, 'customer-$mode-3-home-open');
      await _tab(tester, 'Shipments');
      await _shot(tester, 'customer-$mode-4-shipments');
      await tester.tap(find.textContaining('KCPL-S-24091', findRichText: true).first);
      await _shot(tester, 'customer-$mode-5-shipment');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await _tab(tester, 'Documents');
      await _shot(tester, 'customer-$mode-6-documents');
      await _tab(tester, 'Invoices');
      await _shot(tester, 'customer-$mode-7-invoices');
      await _tab(tester, 'Account');
      await _shot(tester, 'customer-$mode-8-account');
    }, variant: iPhone);

    testWidgets('ops $mode', (tester) async {
      await _phone(tester, dark: dark);
      final controller = OpsController(auth: DemoAuth(), api: DemoOpsApi(), configured: true);
      await controller.start();
      await tester.pumpWidget(OpsApp(controller: controller, demo: true));
      await _wait(tester, 20);
      await _signIn(tester, 'anil@kcpl.example');
      await _shot(tester, 'ops-$mode-1-today');
      await _tab(tester, 'Jobs');
      await _shot(tester, 'ops-$mode-2-jobs');
      await tester.tap(find.textContaining('KCPL-2609-0142').first);
      await _shot(tester, 'ops-$mode-3-job');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await _tab(tester, 'Alerts');
      await _shot(tester, 'ops-$mode-4-alerts');
      await _tab(tester, 'Me');
      await _shot(tester, 'ops-$mode-5-me');
    }, variant: iPhone);
  }
}
