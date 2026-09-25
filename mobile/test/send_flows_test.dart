import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/widgets/capture.dart';
import 'package:kcpl_customer/ui/widgets/large_title.dart';
import 'package:kcpl_customer/ui/widgets/tab_bar.dart';

import 'app_flow_test.dart' show MemberApi, pumpApp, ref, scrollTo, settle, signIn;

/// A real 1×1 PNG, so the preview decodes it as it would a photo.
final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC');

/// Hands back [next] from whichever source is chosen, as a camera would.
class FakeSource extends AttachmentSource {
  FakeSource([this.next]);
  Attachment? next;
  int opened = 0;

  Future<Attachment?> _give() async {
    opened++;
    return next;
  }

  @override
  Future<Attachment?> camera() => _give();
  @override
  Future<Attachment?> photos() => _give();
  @override
  Future<Attachment?> files() => _give();
}

FakeSource useSource([Attachment? next]) {
  final source = FakeSource(next ?? Attachment(filename: 'IMG_4471.png', bytes: _png, contentType: 'image/png'));
  AttachmentSource.current = source;
  addTearDown(() => AttachmentSource.current = const DeviceAttachmentSource());
  return source;
}

/// Taps the slot's "Take photo", then the same choice in the action sheet.
Future<void> takePhoto(WidgetTester tester) async {
  await tester.tap(find.text('Take photo').first);
  await settle(tester);
  await tester.tap(find.text('Take photo').last);
  await settle(tester);
}

Future<void> openShipment(WidgetTester tester, String reference) async {
  await tester.tap(find.text('Shipments').last);
  await settle(tester);
  await scrollTo(tester, ref(reference));
  await tester.tap(ref(reference).first);
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);

  testWidgets('a document KCPL is waiting on is photographed and sent from its own row', (tester) async {
    final source = useSource();
    final api = DemoApi();
    await pumpApp(tester, api: api);
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24091');

    await scrollTo(tester, find.text('Send'), pushed: true);
    await tester.tap(find.text('Send'));
    await settle(tester);
    expect(find.text('Send a document'), findsWidgets);

    await takePhoto(tester);
    expect(source.opened, 1);
    expect(find.text('import-permit-KCPL-S-24091.png'), findsOneWidget, reason: 'named for what it is, not IMG_4471');

    await tester.tap(find.text('Send to KCPL'));
    await settle(tester);
    expect(find.text('Sent to KCPL'), findsOneWidget);
    expect(api.sentDocuments.single.documentType, 'import_permit', reason: 'the row it was sent from chose the type');

    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.text('Send'), findsNothing, reason: 'the shipment reloaded and the permit is now with KCPL');
  });

  testWidgets('nothing is sent without a file, and a file the server would refuse is refused here', (tester) async {
    final source = useSource();
    final api = DemoApi();
    await pumpApp(tester, api: api);
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24091');
    await scrollTo(tester, find.text('Send a document'), pushed: true);
    await tester.tap(find.text('Send a document'));
    await settle(tester);

    await tester.tap(find.text('Send to KCPL'));
    await settle(tester);
    expect(find.text('Add a photo or a file first.'), findsOneWidget);

    source.next = Attachment(filename: 'scan.heic', bytes: _png, contentType: 'image/heic');
    AttachmentSource.current = _Unsupported();
    await takePhoto(tester);
    expect(find.text('Send a PDF, JPEG, PNG or WEBP file.'), findsOneWidget);
    expect(api.sentDocuments, isEmpty);
  });

  testWidgets('a delivered shipment asks once whether it arrived, and then says so', (tester) async {
    useSource();
    final api = DemoApi();
    await pumpApp(tester, api: api);
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24012');

    expect(find.text('Has it arrived?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm receipt'));
    await settle(tester);
    expect(find.text('Sunita Shrestha'), findsOneWidget, reason: 'the person confirming most often took delivery');

    await sheetScrollTo(tester, find.text('Take photo'));
    await takePhoto(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm receipt').last);
    await settle(tester);
    expect(find.text('Thank you'), findsOneWidget);
    expect(api.confirmations['KCPL-S-24012']?.receivedBy, 'Sunita Shrestha');
    expect(api.sentDocuments.single.documentType, 'other', reason: 'a customer photo is never filed as a POD');

    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.text('Has it arrived?'), findsNothing);
    expect(find.textContaining('You confirmed receipt on'), findsOneWidget);
  });

  testWidgets('a payment receipt goes to accounts with the balance filled in, and shows on the invoice', (tester) async {
    useSource();
    final api = DemoApi();
    await pumpApp(tester, api: api);
    await signIn(tester);
    await tester.tap(find.text('Invoices').last);
    await settle(tester);
    await scrollTo(tester, find.textContaining('KCPL-I-20260821-004', findRichText: true));
    await tester.tap(find.textContaining('KCPL-I-20260821-004', findRichText: true).first);
    await settle(tester);

    await tester.tap(find.text('Send payment receipt'));
    await settle(tester);
    expect(find.widgetWithText(TextField, '1040'), findsOneWidget, reason: 'the balance due is the usual amount');
    await takePhoto(tester);
    await tester.tap(find.text('Send to KCPL'));
    await settle(tester);
    expect(find.text('Sent to KCPL'), findsOneWidget);
    final sent = api.sentRemittances['KCPL-I-20260821-004']!.single;
    expect((sent.amount, sent.currency), (1040.0, 'USD'));

    await tester.tap(find.text('Done'));
    await settle(tester);
    await scrollTo(tester, find.text('Receipts you sent'), pushed: true);
    expect(find.text('With KCPL accounts'), findsOneWidget);
    expect(find.text('Acknowledged'), findsOneWidget);
  });

  testWidgets('an owner invites a colleague, gets the link to pass on, and can turn a login off', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.byType(TabBarItem).last);
    await settle(tester);
    await tester.tap(find.text('Team'));
    await settle(tester);
    expect(find.text('Linked by KCPL'), findsWidgets, reason: 'an agent KCPL linked is shown, apart');

    await tester.tap(find.text('Invite a colleague'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'new.hire@annapurna.example');
    await tester.tap(find.text('Send invitation'));
    await settle(tester);
    expect(find.text('Invitation sent'), findsOneWidget);
    expect(find.text('Share link'), findsOneWidget, reason: 'with no mail provider, the owner passes the link on');
    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.text('new.hire@annapurna.example'), findsOneWidget);

    await tester.tap(find.text('accounts@annapurna.example'));
    await settle(tester);
    await tester.tap(find.text('Turn off login'));
    await settle(tester);
    expect(find.text('Turned off'), findsNWidgets(2));
  });

  testWidgets('a login that may not send things to KCPL is offered none of it', (tester) async {
    await pumpApp(tester, api: MemberApi());
    await signIn(tester);
    await openShipment(tester, 'KCPL-S-24091');
    expect(find.text('Send'), findsNothing);
    expect(find.text('Send a document'), findsNothing);
    await tester.tap(find.byType(SheetCloseButton));
    await settle(tester);
    await tester.tap(find.byType(TabBarItem).last);
    await settle(tester);
    expect(find.text('Team'), findsNothing);
  });

  testWidgets('large system text and Nepali never clip the new sheets', (tester) async {
    useSource();
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final controller = await pumpApp(tester);
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
    await sheetScrollTo(tester, find.widgetWithText(FilledButton, 'प्राप्ति पुष्टि गर्नुहोस्'));
    await tester.tap(find.widgetWithText(FilledButton, 'प्राप्ति पुष्टि गर्नुहोस्'));
    await settle(tester);
    await takePhotoIn(tester, 'फोटो खिच्नुहोस्');
    await tester.tap(find.byType(SheetCloseButton).last);
    await settle(tester);
    await sheetScrollTo(tester, find.text('कागजात पठाउनुहोस्'));
    await tester.tap(find.text('कागजात पठाउनुहोस्'));
    await settle(tester);
    await takePhotoIn(tester, 'फोटो खिच्नुहोस्');
    while (find.byType(SheetCloseButton).evaluate().isNotEmpty) {
      await tester.tap(find.byType(SheetCloseButton).last);
      await settle(tester);
    }

    await tester.tap(find.byType(TabBarItem).at(3));
    await settle(tester);
    await scrollTo(tester, find.textContaining('KCPL-I-20260821-004', findRichText: true));
    await tester.tap(find.textContaining('KCPL-I-20260821-004', findRichText: true).first);
    await settle(tester);
    await sheetScrollTo(tester, find.text('भुक्तानी रसिद पठाउनुहोस्'));
    await tester.tap(find.text('भुक्तानी रसिद पठाउनुहोस्'));
    await settle(tester);
    await takePhotoIn(tester, 'फोटो खिच्नुहोस्');
    while (find.byType(SheetCloseButton).evaluate().isNotEmpty) {
      await tester.tap(find.byType(SheetCloseButton).last);
      await settle(tester);
    }

    await tester.tap(find.byType(TabBarItem).last);
    await settle(tester);
    await scrollTo(tester, find.text('टोली'));
    await tester.tap(find.text('टोली'));
    await settle(tester);
    await tester.tap(find.text('सहकर्मीलाई निम्तो दिनुहोस्'));
    await settle(tester);
  });

  test('an upload is multipart, authenticated, reports its progress, and is rebuilt for the retry', () async {
    var calls = 0;
    late String body;
    final client = MockClient((request) async {
      calls++;
      if (calls == 1) return http.Response('', 401);
      expect(request.headers['authorization'], 'Bearer token-2');
      expect(request.headers['x-kcpl-customer'], 'CUST-1');
      expect(request.url.path, '/api/mobile/v1/shipments/KCPL-S-1/documents');
      body = latin1.decode(request.bodyBytes);
      return http.Response(jsonEncode({'ok': true, 'message': 'Sent to KCPL.'}), 201);
    });
    final api = HttpKcplApi(base: Uri.parse('https://kcpl.example'), auth: _CountingAuth(), client: client)..customerId = 'CUST-1';
    final progress = <double>[];
    final bytes = List<int>.generate(100 * 1024, (i) => i % 251);
    final receipt = await api.sendDocument(
      'KCPL-S-1',
      'packing_list',
      Attachment(filename: 'packing-list.pdf', bytes: bytes, contentType: 'application/pdf'),
      onProgress: progress.add,
    );

    expect(receipt.message, 'Sent to KCPL.');
    expect(calls, 2, reason: 'a 401 is retried once with a fresh token');
    expect(body, contains('name="documentType"'));
    expect(body, contains('packing_list'));
    expect(body, contains('filename="packing-list.pdf"'));
    expect(progress.first, 0);
    expect(progress.last, 1);
    expect(progress.length, greaterThan(4), reason: 'the body goes in pieces, so progress moves');
  });
}

/// Scrolls the frontmost sheet itself: multi-line fields hold scrollables
/// of their own, so "the last scrollable" is not always the page.
Future<void> sheetScrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    300,
    scrollable: find.descendant(of: find.byType(CustomScrollView).last, matching: find.byType(Scrollable)).first,
  );
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
}

Future<void> takePhotoIn(WidgetTester tester, String label) async {
  await sheetScrollTo(tester, find.text(label));
  await tester.tap(find.text(label).first);
  await settle(tester);
  await tester.tap(find.text(label).last);
  await settle(tester);
}

/// A source whose file is one the server would refuse.
class _Unsupported extends AttachmentSource {
  @override
  Future<Attachment?> camera() async => throw const AttachmentRefused('type');
  @override
  Future<Attachment?> photos() => camera();
  @override
  Future<Attachment?> files() => camera();
}

class _CountingAuth extends DemoAuth {
  int _minted = 0;
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token-${++_minted}';
}
