import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/kcpl_api.dart' show ApiException;
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/demo/demo_backend.dart';
import 'package:kcpl_customer/ops/field_location.dart';
import 'package:kcpl_customer/ops/note_queue.dart';
import 'package:kcpl_customer/ops/ops_api.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/ops_models.dart';
import 'package:kcpl_customer/ops/screens/job_actions.dart' show nepalWallClock;
import 'package:kcpl_customer/ops/screens/signature_screen.dart';
import 'package:kcpl_customer/ui/format.dart';

import 'ops_test.dart' show pumpOps, settle, signIn, tapInView;
import 'send_flows_test.dart' show useSource;

class _Auth extends DemoAuth {
  @override
  Future<String> idToken({bool forceRefresh = false}) async => 'token';
}

HttpOpsApi _api(Future<http.Response> Function(http.Request request) handler) =>
    HttpOpsApi(base: Uri.parse('https://kcpl.example'), auth: _Auth(), client: MockClient(handler));

const _job = 'KCPL-2609-0142';

Future<void> _openJob(WidgetTester tester) async {
  await tapInView(tester, find.textContaining(_job).first);
  await settle(tester);
}

/// Signs with a short stroke, then taps Done. Rendering the image runs on
/// the engine, outside the test's fake clock.
Future<void> _sign(WidgetTester tester) async {
  final area = tester.getCenter(find.byKey(const ValueKey('signature-pad')));
  final pen = await tester.startGesture(area - const Offset(80, 0));
  for (var i = 0; i < 8; i++) {
    await pen.moveBy(Offset(20, i.isEven ? -12 : 12));
  }
  await pen.up();
  await tester.pump();
  await tester.runAsync(() async {
    await tester.tap(find.text('Done'));
    for (var i = 0; i < 20 && find.byType(SignatureScreen).evaluate().isNotEmpty; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await tester.pump();
    }
  });
  await settle(tester);
  expect(find.byType(SignatureScreen), findsNothing, reason: 'Done returned the signature');
}

void main() {
  setUpAll(initFormatting);
  tearDown(() => FieldLocation.current = () async => null);

  group('API client', () {
    test('POD goes to the evidence route as multipart, with the file type declared', () async {
      late http.Request seen;
      final api = _api((request) async {
        seen = request;
        return http.Response(jsonEncode({'ok': true, 'evidence': {'id': 'e1', 'attempt_id': 'a1', 'kind': 'signature', 'filename': 's.png', 'review_status': 'received'}}), 201);
      });
      final evidence = await api.addPodEvidence('KCPL-1', 'a1', 'signature', Attachment(filename: 's.png', bytes: const [1, 2, 3], contentType: 'image/png'));
      expect(seen.url.path, '/api/mobile/ops/v1/jobs/KCPL-1/delivery/evidence');
      final body = latin1.decode(seen.bodyBytes);
      expect(body, contains('name="attemptId"'));
      expect(body, contains('name="kind"'));
      expect(body, contains('content-type: image/png'), reason: 'the server checks the declared type');
      expect(evidence.reviewStatus, 'received');
    });

    test('a delivered outcome carries the recipient and where it happened', () async {
      late Map<String, dynamic> sent;
      final api = _api((request) async {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({'ok': true, 'attempt': {'id': 'a1', 'attempt_number': 1, 'status': 'delivered', 'recipient_name': 'Ram'}, 'blockers': ['POD has not been verified.']}),
          200,
        );
      });
      final outcome = await api.recordDelivery('KCPL-1', 'a1', status: 'delivered', recipientName: 'Ram', latitude: 27.01, longitude: 84.87);
      expect(sent['action'], 'update_attempt');
      expect(sent['status'], 'delivered');
      expect(sent['latitude'], 27.01);
      expect(outcome.attempt.status, 'delivered');
      expect(outcome.blockers, ['POD has not been verified.'], reason: 'delivered on the attempt is not Delivered on the shipment');
    });

    test('job actions post to one route, and a refused closeout says what is in the way', () async {
      final bodies = <Map<String, dynamic>>[];
      final api = _api((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        bodies.add(body);
        expect(request.url.path, '/api/mobile/ops/v1/jobs/KCPL-1/actions');
        if (body['action'] == 'close_job') {
          return http.Response(jsonEncode({'ok': false, 'code': 'CLOSEOUT_BLOCKED', 'blockers': ['POD missing.'], 'canOverride': false}), 409);
        }
        return http.Response(jsonEncode({'ok': true}), 200);
      });
      const sita = StaffOption(uid: 'u-sita', name: 'Sita', email: 'sita@kcpl.example', branches: ['Birgunj']);
      await api.addTask('KCPL-1', title: 'Call customs', branch: 'Birgunj', dueAt: '2026-09-25T17:00', assignee: sita);
      await api.reassign('KCPL-1', sita);
      await expectLater(api.closeJob('KCPL-1'), throwsA(isA<CloseoutBlocked>().having((b) => b.blockers, 'blockers', ['POD missing.'])));
      expect(bodies[0], containsPair('assignedToUid', 'u-sita'));
      expect(bodies[0], containsPair('dueAt', '2026-09-25T17:00'));
      expect(bodies[1], {'action': 'reassign', 'assignedToUid': 'u-sita'}, reason: 'only who; the server fills in the rest from its own list');
      expect(bodies[2]['action'], 'close_job');
    });
  });

  test('due times are Nepal wall-clock time whatever the phone’s zone', () {
    expect(nepalWallClock(DateTime.utc(2026, 9, 25, 11, 15)), '2026-09-25T17:00');
    expect(nepalWallClock(DateTime.utc(2026, 9, 25, 20)), '2026-09-26T01:45');
  });

  test('a signature stroke is smoothed through its midpoints', () {
    final path = signaturePath(const [Offset(0, 0), Offset(10, 10), Offset(20, 0), Offset(30, 10)]);
    final length = path.computeMetrics().fold<double>(0, (sum, metric) => sum + metric.length);
    expect(path.getBounds().right, 30, reason: 'it ends where the finger lifted');
    expect(length, lessThan(3 * 14.14), reason: 'curves cut the sampled corners a straight polyline would keep');
  });

  group('note queue', () {
    test('a note waits on the phone, only for its writer, and goes when KCPL can be reached', () async {
      final api = DemoOpsApi()..offline = true;
      final store = MemoryNoteQueueStore();
      final queue = NoteQueue(store: store, retryEvery: const Duration(hours: 1));
      await queue.attach(api, 'anil@kcpl.example');
      await queue.add('KCPL-1', text: 'Seal intact');
      expect(await queue.flush(), isFalse);
      expect(queue.waitingFor('KCPL-1'), hasLength(1));
      expect(store.saved, hasLength(1), reason: 'kept across a restart');

      // Someone else signing in on the same phone neither sees nor sends it.
      await queue.attach(api, 'sita@kcpl.example');
      expect(queue.waiting, isEmpty);

      api.offline = false;
      await queue.attach(api, 'anil@kcpl.example');
      expect(queue.waiting, isEmpty);
      expect(api.notes['KCPL-1']!.single.text, 'Seal intact');
      queue.dispose();
    });

    test('a note KCPL refuses is kept and marked, not retried for ever', () async {
      final queue = NoteQueue(retryEvery: const Duration(hours: 1));
      await queue.attach(_RefusingApi(), 'anil@kcpl.example');
      await queue.add('KCPL-1', text: 'x');
      await queue.flush();
      expect(queue.waiting.single.refusal, 'This shipment is outside your branch access.');
      queue.dispose();
    });
  });

  testWidgets('a delivery is started, signed for, photographed and placed, and POD goes to the desk', (tester) async {
    useSource();
    FieldLocation.current = () async => const FieldFix(26.4525, 87.2718, 8);
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await _openJob(tester);

    await tapInView(tester, find.text('Start delivery'));
    await settle(tester);
    await tester.tap(find.text('Start delivery').last);
    await settle(tester);
    expect(find.text('Attempt 1'), findsWidgets, reason: 'starting goes straight on to recording the outcome');
    expect(find.text('26.45250, 87.27180'), findsOneWidget);

    await tester.tap(find.text('Record delivery'));
    await settle(tester);
    expect(find.text('Who received it? Enter their name.'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Ram Bahadur');
    await tester.tap(find.text('Consignee'));
    await settle(tester);
    await tester.tap(find.text('Record delivery'));
    await settle(tester);
    expect(find.text('Add a signature or a photo as proof of delivery.'), findsOneWidget);

    await tapInView(tester, find.text('Get a signature'));
    await settle(tester);
    expect(find.byType(SignatureScreen), findsOneWidget);
    await _sign(tester);
    expect(find.text('Signed'), findsOneWidget);

    await tapInView(tester, find.text('Photograph the delivery'));
    await settle(tester);
    await tester.tap(find.text('Take photo').last);
    await settle(tester);

    await tester.tap(find.text('Record delivery'));
    await settle(tester);
    expect(find.text('Delivery recorded'), findsOneWidget);
    expect(api.lastOutcome?.recipient, 'Ram Bahadur');
    expect(api.lastOutcome?.latitude, 26.4525);
    expect(api.podSent.map((p) => p.kind), ['signature', 'photo']);
    expect(api.podSent.first.contentType, 'image/png');

    await tester.tap(find.text('Done'));
    await settle(tester);
    await tester.scrollUntilVisible(find.textContaining('Proof received'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.text('Attempt 1 · Received by Ram Bahadur'), findsOneWidget);
  });

  testWidgets('a failed attempt needs a reason', (tester) async {
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await _openJob(tester);
    await tapInView(tester, find.text('Start delivery'));
    await settle(tester);
    await tester.tap(find.text('Start delivery').last);
    await settle(tester);
    await tester.tap(find.text('Not delivered'));
    await settle(tester);
    await tester.tap(find.text('Record attempt'));
    await settle(tester);
    expect(find.text('Say why it could not be delivered.'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'Gate locked, nobody answered');
    await tester.tap(find.text('Record attempt'));
    await settle(tester);
    expect(find.text('Attempt recorded'), findsOneWidget);
    expect(api.lastOutcome?.status, 'failed');
  });

  testWidgets('a task is added with a due time and an assignee, and the job changes hands', (tester) async {
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await _openJob(tester);

    await tapInView(tester, find.text('New task'));
    await settle(tester);
    await tester.enterText(find.byType(TextField).first, 'Collect stamped delivery order');
    await tester.tap(find.text('Tomorrow, 10 AM'));
    await tester.tap(find.text('Nobody yet'));
    await settle(tester);
    await tester.tap(find.text('Sita Shrestha'));
    await settle(tester);
    await tester.tap(find.text('Add to $_job'));
    await settle(tester);
    final task = api.addedTasks[_job]!.single;
    expect(task.title, 'Collect stamped delivery order');
    expect(task.assignee, 'Sita Shrestha');
    expect(DateTime.parse(task.dueAt!).toLocal().hour, 10);
    await tester.scrollUntilVisible(find.text('Collect stamped delivery order'), 300, scrollable: find.byType(Scrollable).last);

    await tester.scrollUntilVisible(find.text('Give to someone else'), -300, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Give to someone else'));
    await settle(tester);
    await tester.tap(find.text('Suresh Yadav'));
    await settle(tester);
    expect(api.owners[_job]?.name, 'Suresh Yadav');
    expect(find.text('$_job is now with Suresh Yadav.'), findsOneWidget);
  });

  testWidgets('closing is refused while blockers stand, and Management can close with a reason', (tester) async {
    final api = DemoOpsApi();
    await pumpOps(tester, api: api);
    await signIn(tester);
    await _openJob(tester);
    await tapInView(tester, find.text('Close job…'));
    await settle(tester);
    expect(find.text('Proof of delivery has not been recorded.'), findsOneWidget);
    expect(find.text('Clear these first, or ask Management to close it with a reason.'), findsOneWidget);
    expect(find.text('Close anyway'), findsNothing, reason: 'not Management: the action is not offered');
  });

  testWidgets('Management closes over blockers only with a reason', (tester) async {
    final api = DemoOpsApi()..management = true;
    await pumpOps(tester, api: api);
    await signIn(tester);
    await _openJob(tester);
    await tapInView(tester, find.text('Close job…'));
    await settle(tester);
    await tester.tap(find.text('Close anyway'));
    await settle(tester);
    expect(find.textContaining('at least 8 characters'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'Customer collected at the ICD; POD with the carrier.');
    await tester.tap(find.text('Close anyway'));
    await settle(tester);
    expect(find.text('Job closed'), findsOneWidget);
  });

  testWidgets('a note written without signal waits on the phone and goes when it returns', (tester) async {
    final api = DemoOpsApi()..offline = true;
    final controller = await pumpOps(tester, api: api);
    // Signing in needs KCPL; the signal drops afterwards.
    api.offline = false;
    await signIn(tester);
    await _openJob(tester);
    api.offline = true;

    await tapInView(tester, find.text('Add a note or photo'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'Truck at gate 3, seal intact.');
    await tester.tap(find.text('Save to $_job'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.textContaining('Saved on this phone'), findsOneWidget);
    await settle(tester);
    await tester.scrollUntilVisible(find.text('Truck at gate 3, seal intact.'), 300, scrollable: find.byType(Scrollable).last);
    expect(find.textContaining('Waiting for signal'), findsOneWidget);

    api.offline = false;
    await tester.runAsync(controller.notes.flush);
    await settle(tester);
    expect(find.textContaining('Waiting for signal'), findsNothing);
    expect(api.notes[_job]!.single.text, 'Truck at gate 3, seal intact.');
  });
}

class _RefusingApi extends DemoOpsApi {
  @override
  Future<FieldNote> addNote(String reference, {String text = '', Attachment? photo, String documentType = 'other', SendProgress? onProgress}) async =>
      throw const ApiException(403, 'forbidden', 'This shipment is outside your branch access.');
}
