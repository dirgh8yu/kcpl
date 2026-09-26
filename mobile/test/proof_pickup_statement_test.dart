import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/http_kcpl_api.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/app_controller.dart';
import 'package:kcpl_customer/auth/token_store.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/demo/demo_images.dart';
import 'package:kcpl_customer/main.dart';
import 'package:kcpl_customer/platform/file_opener.dart' as opener;
import 'package:kcpl_customer/push/push_service.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/screens/quotes_screen.dart';
import 'package:kcpl_customer/ui/screens/text_notices_screen.dart';

import 'app_flow_test.dart' show settle, signIn;
import 'push_ui_test.dart' show FakePush;
import 'send_flows_test.dart' show openShipment, sheetScrollTo, useSource;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

Future<AppController> _pump(WidgetTester tester, DemoApi api, {PushService? push}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = AppController(auth: DemoAuth(), api: api, prefs: MemoryTokenStore(), configured: true, push: push);
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  await signIn(tester);
  return controller;
}

/// A sheet over the app, on its own: the screen under test and nothing else.
Future<void> _pumpScreen(WidgetTester tester, DemoApi api, Widget screen) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = AppController(auth: DemoAuth(), api: api, prefs: MemoryTokenStore(), configured: true);
  await controller.start();
  await tester.pumpWidget(KcplApp(controller: controller, demo: true));
  await settle(tester);
  await signIn(tester);
  final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
  navigator.push(MaterialPageRoute<void>(builder: (_) => screen));
  await settle(tester);
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json; charset=utf-8'});

void main() {
  setUpAll(initFormatting);

  group('API', () {
    test('proof of delivery is read from the shipment, and nothing else about the delivery', () {
      final detail = ShipmentDetail.fromJson({
        'shipment': {'reference': 'KCPL-S-1', 'status': 'delivered'},
        'proofOfDelivery': {
          'delivered_at': '2026-09-20T08:30:00Z',
          'recipient_name': 'Sita Rai',
          'recipient_relation': 'Store manager',
          'verified_at': '2026-09-20T10:00:00Z',
          'items': [
            {'id': 'S1', 'kind': 'signature', 'content_type': 'image/png', 'captured_at': '2026-09-20T08:31:00Z'},
            {'id': 'D1', 'kind': 'document', 'content_type': 'application/pdf'},
          ],
        },
      });
      final proof = detail.proofOfDelivery!;
      expect(proof.recipientName, 'Sita Rai');
      expect(proof.items.map((item) => item.id), ['S1', 'D1']);
      expect(proof.items.first.isImage, isTrue);
      expect(proof.items.last.isImage, isFalse);
      expect(ShipmentDetail.fromJson({'shipment': <String, dynamic>{}}).proofOfDelivery, isNull);
    });

    test('a pickup rides on the booking; files and settings use their own endpoints', () async {
      final seen = <http.Request>[];
      final api = HttpKcplApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen.add(request);
          final path = request.url.path;
          if (path.endsWith('/statement')) {
            return http.Response.bytes(utf8.encode('%PDF-1.4'), 200, headers: {
              'content-type': 'application/pdf',
              'content-disposition': 'attachment; filename="KCPL-statement-2026-09-25.pdf"',
            });
          }
          if (path.contains('/pod/')) return http.Response.bytes(DemoImages.signature, 200, headers: {'content-type': 'image/png'});
          if (path.endsWith('/text-notices')) {
            return _json({
              'ok': true,
              'settings': {'channel': 'sms', 'phone': '+9779812345678'},
              'channels': {'sms': true, 'whatsapp': false},
            });
          }
          return _json({'ok': true});
        }),
      );

      await api.acceptQuote(
        'KCPL-Q-1',
        note: 'Fragile',
        pickup: const PickupRequest(date: '2026-09-27', window: 'morning', address: '  Balaju, Kathmandu ', contactPhone: '9812345678'),
      );
      expect(jsonDecode(seen.last.body), {
        'kind': 'booking',
        'quoteReference': 'KCPL-Q-1',
        'note': 'Fragile',
        'pickup': {'date': '2026-09-27', 'window': 'morning', 'address': 'Balaju, Kathmandu', 'contact_phone': '9812345678'},
      });
      await api.acceptQuote('KCPL-Q-2');
      expect(jsonDecode(seen.last.body)['pickup'], isNull, reason: 'no pickup means the customer brings the cargo');

      final statement = await api.statement();
      expect(seen.last.url.path, '/api/mobile/v1/statement');
      expect(statement.filename, 'KCPL-statement-2026-09-25.pdf');
      expect(statement.contentType, 'application/pdf');

      final file = await api.proofFile('KCPL-S-1', const ProofItem(id: 'S1', kind: 'signature', contentType: 'image/png'));
      expect(seen.last.url.path, '/api/mobile/v1/shipments/KCPL-S-1/pod/S1');
      expect(file.bytes, DemoImages.signature);

      final notices = await api.setTextNotices('sms', phone: '9812345678', consent: true);
      expect(seen[seen.length - 2].method, 'POST');
      expect(jsonDecode(seen[seen.length - 2].body), {'channel': 'sms', 'phone': '9812345678', 'consent': true});
      expect(notices.channel, 'sms');
      expect(notices.offered, ['sms']);
    });

    test('a document request names the document; anything odd is ignored', () {
      final target = PushTarget.fromData({'kind': 'document_request', 'reference': 'KCPL-S-1', 'document_type': 'packing_list'})!;
      expect(target.kind, 'document_request');
      expect(target.documentType, 'packing_list');
      expect(PushTarget.fromData({'kind': 'document_request', 'reference': 'KCPL-S-1', 'document_type': '../x'})!.documentType, isNull);
    });

    test('the demo pictures are real PNGs', () {
      for (final png in [DemoImages.signature, DemoImages.parcel]) {
        expect(png.sublist(0, 8), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      }
    });
  });

  testWidgets('a delivered shipment shows who received it, the signature and the photos', (tester) async {
    final api = DemoApi();
    await _pump(tester, api);
    await openShipment(tester, 'KCPL-S-24012');

    expect(find.text('Proof of delivery'), findsOneWidget);
    expect(find.text('Received by Bikash Tamang, Warehouse supervisor'), findsOneWidget);
    expect(find.textContaining('Checked by KCPL'), findsOneWidget);
    expect(find.bySemanticsLabel('Signature'), findsOneWidget);
    expect(find.bySemanticsLabel('Delivery photo 1'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Delivery photo 1'));
    await settle(tester);
    expect(find.byType(InteractiveViewer), findsOneWidget, reason: 'the photo opens full screen, to zoom');
    await tester.tap(find.byTooltip('Close'));
    await settle(tester);
    expect(find.byType(InteractiveViewer), findsNothing);
  });

  testWidgets('a shipment still moving has no proof of delivery', (tester) async {
    await _pump(tester, DemoApi());
    await openShipment(tester, 'KCPL-S-24091');
    expect(find.text('Proof of delivery'), findsNothing);
  });

  testWidgets('accepting a quote can ask KCPL to pick the cargo up', (tester) async {
    final api = DemoApi();
    // Built here, not read from the demo: its answers wait on a clock the
    // test does not run.
    final quote = PortalQuote(
      reference: 'KCPL-Q-20260921-014',
      status: 'quoted',
      createdAt: '2026-09-21T09:00:00Z',
      origin: 'Kolkata, India',
      destination: 'Birgunj ICD, Nepal',
      mode: 'sea',
      amount: 168500,
      currency: 'NPR',
      validUntil: DateTime.now().add(const Duration(days: 9)).toIso8601String().substring(0, 10),
    );
    await _pumpScreen(tester, api, QuoteDetailScreen(quote: quote, canProceed: true));

    await sheetScrollTo(tester, find.text('KCPL picks up the cargo'));
    await tester.tap(find.byType(Switch));
    await settle(tester);
    await sheetScrollTo(tester, find.text('Pickup address'));
    expect(find.text('Morning'), findsOneWidget);

    // An address is needed before it goes.
    await tester.tap(find.text('Ask to proceed'));
    await settle(tester);
    expect(find.text('Enter where the cargo is to be picked up.'), findsOneWidget);
    expect(api.bookingRequests, isEmpty);

    await tester.enterText(find.widgetWithText(TextField, 'Pickup address'), 'Balaju Industrial Area, Kathmandu');
    await tester.tap(find.text('Afternoon'));
    await settle(tester);
    await tester.tap(find.text('Ask to proceed'));
    await settle(tester);

    final pickup = api.pickups[quote.reference]!;
    expect(pickup.address, 'Balaju Industrial Area, Kathmandu');
    expect(pickup.window, 'afternoon');
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    expect(pickup.date, DateTime(tomorrow.year, tomorrow.month, tomorrow.day).toIso8601String().substring(0, 10));
    expect(find.textContaining('Pickup asked for'), findsOneWidget);
  });

  testWidgets('the statement opens as a PDF from Invoices', (tester) async {
    final opened = <DownloadedFile>[];
    final original = opener.openDownloadedFile;
    opener.openDownloadedFile = (file) async => opened.add(file);
    addTearDown(() => opener.openDownloadedFile = original);
    await _pump(tester, DemoApi());
    await tester.tap(find.text('Invoices').last);
    await settle(tester);
    await tester.tap(find.text('Account statement'));
    await settle(tester);
    expect(opened.single.contentType, 'application/pdf');
    expect(latin1.decode(opened.single.bytes.sublist(0, 8)), '%PDF-1.4');
  });

  testWidgets('SMS notices need a Nepali mobile and the customer’s agreement', (tester) async {
    final api = DemoApi();
    await _pumpScreen(tester, api, TextNoticesScreen(current: api.text));

    await tester.tap(find.text('SMS'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), '9812345678');
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('Tick the box to agree to these messages.'), findsOneWidget);
    expect(api.text.channel, 'none');

    await tester.tap(find.textContaining('I agree to receive'));
    await settle(tester);
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(api.text.channel, 'sms');
    expect(api.text.phone, '+9779812345678');
  });

  testWidgets('Account offers text notices only when KCPL has a channel on', (tester) async {
    final api = DemoApi()..text = const TextNotices();
    await _pump(tester, api);
    await tester.tap(find.text('Account').last);
    await settle(tester);
    expect(find.text('SMS and WhatsApp'), findsNothing);
  });

  testWidgets('"KCPL needs your packing list" opens the scanner in one tap', (tester) async {
    final source = useSource();
    final push = FakePush();
    final api = DemoApi();
    await _pump(tester, api, push: push);

    push.tapController.add(const PushTarget('document_request', 'KCPL-S-24077', documentType: 'packing_list'));
    await settle(tester);
    // The demo's packing list was sent back once already.
    expect(find.text('KCPL needs your packing list again'), findsOneWidget);

    await tester.tap(find.text('Scan packing list'));
    await settle(tester);
    expect(source.opened, 1, reason: 'no chooser first: straight to the scanner');
    await tester.tap(find.text('Send to KCPL'));
    await settle(tester);
    expect(api.sentDocuments.single.documentType, 'packing_list');
    expect(api.sentDocuments.single.shipmentReference, 'KCPL-S-24077');
  });
}
