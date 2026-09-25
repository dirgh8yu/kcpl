import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/ops_api.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/screens/job_detail_screen.dart';
import 'package:kcpl_customer/ops/screens/scan_screen.dart';
import 'package:kcpl_customer/ui/format.dart';

import 'ops_test.dart' show pumpOps, settle, signIn, tapInView;
import 'send_flows_test.dart' show useSource;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

/// A camera that "reads" whatever the test says, with a button to do it.
void fakeCamera(String code) {
  ScanDevice.camera = (context, onCode, paused) => Center(
    child: TextButton(onPressed: paused ? null : () => onCode(code), child: const Text('fake-scan')),
  );
}

void main() {
  setUpAll(initFormatting);
  tearDown(() {
    ScanDevice.camera = (context, onCode, paused) => const SizedBox();
  });

  group('API client', () {
    test('a field note is multipart to the job, with the photo and what it is', () async {
      late http.Request seen;
      final api = HttpOpsApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen = request;
          return http.Response(
            jsonEncode({
              'ok': true,
              'note': {'id': 'n1', 'text': 'Seal intact', 'created_at': '2026-09-25T10:00:00Z'},
            }),
            201,
          );
        }),
      );
      final progress = <double>[];
      final note = await api.addNote(
        'KCPL-1',
        text: 'Seal intact',
        photo: Attachment(filename: 'door.jpg', bytes: List.filled(70000, 7), contentType: 'image/jpeg'),
        documentType: 'proof_of_delivery',
        onProgress: progress.add,
      );
      expect(note.text, 'Seal intact');
      expect(seen.url.path, '/api/mobile/ops/v1/jobs/KCPL-1/notes');
      final body = latin1.decode(seen.bodyBytes);
      expect(body, contains('name="note"'));
      expect(body, contains('name="photo"; filename="door.jpg"'));
      expect(body, contains('proof_of_delivery'));
      expect(progress.last, 1);
    });

    test('a lookup asks with the scanned text as a query', () async {
      late http.Request seen;
      final api = HttpOpsApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen = request;
          return http.Response(
            jsonEncode({
              'ok': true,
              'matches': [
                {'reference': 'KCPL-1', 'origin': 'A', 'destination': 'B', 'status': 'in_transit'},
              ],
            }),
            200,
          );
        }),
      );
      final matches = await api.lookup('MSCU 123456-7');
      expect(seen.url.path, '/api/mobile/ops/v1/lookup');
      expect(seen.url.queryParameters['q'], 'MSCU 123456-7');
      expect(matches.single.reference, 'KCPL-1');
    });
  });

  testWidgets('a note from the field goes straight onto the job, with a photo filed as what it is', (tester) async {
    useSource();
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await tapInView(tester, find.textContaining('KCPL-2609-0142').first);
    await settle(tester);
    await tester.scrollUntilVisible(find.textContaining('Seal intact, driver waiting'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.textContaining('Seal intact, driver waiting'), findsOneWidget, reason: 'notes already on the job are shown');

    await tapInView(tester, find.text('Add a note or photo'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'Corrected list handed to customs.');
    await tester.tap(find.text('Take photo').first);
    await settle(tester);
    await tester.tap(find.text('Take photo').last);
    await settle(tester);
    await tapInView(tester, find.text('Proof of delivery (POD)'));
    await settle(tester);
    await tester.tap(find.text('Save to KCPL-2609-0142'));
    await settle(tester);

    expect(find.text('Add to job'), findsNothing, reason: 'saving goes straight back to the job');
    await tester.scrollUntilVisible(find.text('Corrected list handed to customs.'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.text('Corrected list handed to customs.'), findsOneWidget);
    expect(api.lastDocumentType, 'proof_of_delivery');
  });

  testWidgets('an empty note is not saved', (tester) async {
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await tapInView(tester, find.textContaining('KCPL-2609-0142').first);
    await settle(tester);
    await tapInView(tester, find.text('Add a note or photo'));
    await settle(tester);
    await tester.tap(find.text('Save to KCPL-2609-0142'));
    await settle(tester);
    expect(find.text('Write a note or add a photo.'), findsOneWidget);
    expect(api.notes, isEmpty);
  });

  testWidgets('a scanned code that means one job opens it', (tester) async {
    fakeCamera('KCPL-2609-0142');
    await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.byTooltip('Scan').first);
    await settle(tester);
    await tester.tap(find.text('fake-scan'));
    await settle(tester);
    expect(find.byType(JobDetailScreen), findsOneWidget, reason: 'the job took the scanner’s place');
    expect(find.byType(ScanScreen), findsNothing);
  });

  testWidgets('a code several jobs share lists them, and one nobody has says so', (tester) async {
    fakeCamera('CMDU 7719230');
    await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.byTooltip('Scan').first);
    await settle(tester);
    await tester.tap(find.text('fake-scan'));
    await settle(tester);
    expect(find.textContaining('jobs match CMDU 7719230'), findsOneWidget);

    await tester.tap(find.text('Scan again'));
    await settle(tester);
    await tester.tap(find.text('Type it'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'ZZZU9999999');
    await tester.tap(find.text('Find job'));
    await settle(tester);
    expect(find.text('No job matches ZZZU9999999'), findsOneWidget);
  });

  testWidgets('text read off a container door offers its numbers to tap', (tester) async {
    ScanDevice.readText = () async => ['MAX GROSS 30480 KG', 'CSQU 305438 3', 'Ref KCPL-2609-0142'];
    addTearDown(() => ScanDevice.readText = () async => null);
    await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.byTooltip('Scan').first);
    await settle(tester);
    await tester.tap(find.text('Read text'));
    await settle(tester);
    expect(find.text('CSQU3054383'), findsOneWidget, reason: 'the container number, checked, comes first');
    expect(find.text('30480'), findsNothing);
    await tester.tap(find.text('KCPL-2609-0142'));
    await settle(tester);
    expect(find.byType(JobDetailScreen), findsOneWidget);
  });
}
