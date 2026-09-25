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
import 'package:kcpl_customer/auth/social_sign_in.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/ops/main.dart';
import 'package:kcpl_customer/ops/ops_controller.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/ops/screens/scan_screen.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/widgets/capture.dart';
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
  await _font('.SF Pro Text', inter);
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

Future<void> _shot(WidgetTester tester, String name, {bool settle = true}) async {
  if (settle) await _wait(tester);
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

/// A photo of paperwork, as the camera would hand it back.
class _Paper extends AttachmentSource {
  const _Paper();
  @override
  Future<Attachment?> camera() async => Attachment(filename: 'IMG_4471.png', bytes: _paperPng(), contentType: 'image/png');
  @override
  Future<Attachment?> photos() => camera();
  @override
  Future<Attachment?> files() => camera();
}

/// A grey page with lines of "text", drawn once.
List<int> _paperPng() => File('tool/paper.png').readAsBytesSync();

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
      final controller = AppController(
        auth: DemoAuth(),
        api: DemoApi(),
        prefs: MemoryTokenStore(),
        configured: true,
        social: const DemoSocial(),
      );
      await controller.start();
      await tester.pumpWidget(KcplApp(controller: controller, demo: true));
      await _wait(tester, 20);
      await _shot(tester, 'customer-$mode-1-sign-in');
      await tester.tap(find.text('Continue with Google'));
      await _wait(tester, 30);
      await _shot(tester, 'customer-$mode-2-home');
      await tester.drag(find.byKey(const ValueKey('home-sheet-grabber')), const Offset(0, -330));
      await _wait(tester, 20);
      await _shot(tester, 'customer-$mode-3-home-open');
      await tester.tap(find.text('Where is your cargo going?'));
      await _wait(tester);
      await tester.enterText(find.byType(TextField).at(0), 'Kol');
      await _wait(tester, 3);
      await _shot(tester, 'customer-$mode-3a-quote-typing');
      await tester.tap(find.text('Kolkata').last);
      await tester.enterText(find.byType(TextField).at(1), 'Birgunj I');
      await _wait(tester, 3);
      await tester.tap(find.text('Birgunj ICD').last);
      await tester.tap(find.text('Sea'));
      await _wait(tester);
      await _shot(tester, 'customer-$mode-3b-quote');
      await tester.tap(find.text('Request quote'));
      await _wait(tester, 20);
      await _shot(tester, 'customer-$mode-3c-quote-sent');
      await tester.tap(find.text('Done'));
      await _wait(tester);
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

    testWidgets('customer features $mode', (tester) async {
      await _phone(tester, dark: dark);
      AttachmentSource.current = const _Paper();
      final controller = AppController(
        auth: DemoAuth(),
        api: DemoApi(),
        prefs: MemoryTokenStore(),
        configured: true,
        social: const DemoSocial(),
      );
      await controller.start();
      await tester.pumpWidget(KcplApp(controller: controller, demo: true));
      await _wait(tester, 20);
      await tester.tap(find.text('Continue with Google'));
      await _wait(tester, 30);
      await _tab(tester, 'Shipments');
      await tester.tap(find.textContaining('KCPL-S-24091', findRichText: true).first);
      await _wait(tester);
      await tester.scrollUntilVisible(find.text('Send'), 300, scrollable: find.byType(Scrollable).last);
      await _shot(tester, 'customer-$mode-9a-checklist-send');
      await tester.tap(find.text('Send'));
      await _wait(tester);
      await tester.tap(find.text('Take photo').first);
      await _wait(tester, 4);
      await tester.tap(find.text('Take photo').last);
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9b-send-document');
      await tester.tap(find.text('Send to KCPL'));
      await tester.pump(const Duration(milliseconds: 250));
      await _shot(tester, 'customer-$mode-9c-sending', settle: false);
      await _wait(tester, 20);
      await tester.tap(find.text('Done'));
      await _wait(tester);
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await tester.tap(find.textContaining('KCPL-S-24012', findRichText: true).first);
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9d-arrived');
      await tester.tap(find.widgetWithText(FilledButton, 'Confirm receipt'));
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9e-confirm');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await _tab(tester, 'Invoices');
      await tester.tap(find.textContaining('KCPL-I-20260821-004', findRichText: true).first);
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9f-invoice');
      await tester.tap(find.text('Send payment receipt'));
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9g-receipt');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await _tab(tester, 'Account');
      await tester.tap(find.text('Team'));
      await _wait(tester);
      await _shot(tester, 'customer-$mode-9h-team');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await controller.lock.setEnabled(false, '');
      AttachmentSource.current = const DeviceAttachmentSource();
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
      await tester.scrollUntilVisible(find.text('Add a note or photo'), 300, scrollable: find.byType(Scrollable).last);
      await _shot(tester, 'ops-$mode-3a-job-field');
      await tester.tap(find.text('Add a note or photo').last);
      await _wait(tester);
      await tester.enterText(find.byType(TextField).last, 'Seal intact. Corrected packing list handed to customs at 11:20.');
      await _wait(tester, 3);
      await _shot(tester, 'ops-$mode-3b-add-note');
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      await tester.tap(find.byType(SheetCloseButton).last);
      await _wait(tester);
      ScanDevice.camera = (context, onCode, paused) => const ColoredBox(color: Color(0xFF2B2B2B));
      ScanDevice.readText = () async => ['MAX GROSS 30480 KG', 'CSQU 305438 3', 'TARE 2200', 'Ref KCPL-2609-0142'];
      await tester.tap(find.byTooltip('Scan').first);
      await _wait(tester);
      await _shot(tester, 'ops-$mode-3c-scan');
      await tester.tap(find.text('Read text'));
      await _wait(tester);
      await _shot(tester, 'ops-$mode-3d-scan-read');
      await tester.tap(find.byTooltip('Close').first);
      await _wait(tester);
      await _tab(tester, 'Alerts');
      await _shot(tester, 'ops-$mode-4-alerts');
      await _tab(tester, 'Me');
      await _shot(tester, 'ops-$mode-5-me');
    }, variant: iPhone);
  }
}
