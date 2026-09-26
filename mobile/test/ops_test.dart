import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ui/widgets/large_title.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/api/kcpl_api.dart' show ApiException;
import 'package:kcpl_customer/auth/auth_repository.dart';
import 'package:kcpl_customer/demo/demo_backend.dart' show DemoAuth;
import 'package:kcpl_customer/ops/main.dart';
import 'package:kcpl_customer/ops/ops_api.dart';
import 'package:kcpl_customer/ops/ops_controller.dart';
import 'package:kcpl_customer/ops/ops_demo.dart';
import 'package:kcpl_customer/ops/route_order.dart';
import 'package:kcpl_customer/ops/ops_models.dart';
import 'package:kcpl_customer/ops/screens/job_detail_screen.dart';
import 'package:kcpl_customer/ops/screens/jobs_screen.dart';
import 'package:kcpl_customer/ui/widgets/filter_bar.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/widgets/tab_bar.dart';

class _Auth implements AuthRepository {
  bool signedOut = false;
  @override
  Future<String> idToken({bool forceRefresh = false}) async => forceRefresh ? 'fresh' : 'stale';
  @override
  Future<void> signOut() async => signedOut = true;
  @override
  Future<bool> restore() async => true;
  @override
  Future<void> signIn(String email, String password) async {}
  @override
  Future<void> signInWithIdp(IdpCredential credential) async {}
  @override
  Future<void> link(IdpCredential credential) async {}
  @override
  Future<void> sendPasswordReset(String email) async {}
}

/// Demo data whose saves always fail, to prove a tick undoes itself.
class _FailingSaves extends DemoOpsApi {
  @override
  Future<void> setTask(String reference, String taskId, bool completed) async =>
      throw const ApiException(403, 'forbidden', 'That item is outside your branch access.');
}

/// Counts how often Today is fetched.
class _CountingToday extends DemoOpsApi {
  int todays = 0;
  @override
  Future<TodayBundle> today() {
    todays++;
    return super.today();
  }
}

/// Firebase accepts the password; KCPL does not know the login as staff.
class _NotStaff extends DemoOpsApi {
  @override
  Future<OpsSession> session() async => throw const ApiException(403, 'denied', 'This account is not authorised for KCPL Operations.');
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
  await tester.pumpAndSettle();
}

Future<OpsController> pumpOps(WidgetTester tester, {OpsApi? api, RouteOrderStore? routes}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final controller = OpsController(auth: DemoAuth(), api: api ?? DemoOpsApi(), configured: true, routes: routes);
  await controller.start();
  await tester.pumpWidget(OpsApp(controller: controller, demo: true));
  await settle(tester);
  return controller;
}

/// Whether the checklist row titled [title] reads as ticked.
bool? ticked(WidgetTester tester, String title) => tester
    .widget<Semantics>(
      find.ancestor(of: find.text(title), matching: find.byWidgetPredicate((w) => w is Semantics && w.properties.checked != null)).first,
    )
    .properties
    .checked;

/// Scrolls [finder] into view, as a person would, then taps it.
Future<void> tapInView(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 300, scrollable: find.byType(Scrollable).last);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

Future<void> signIn(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).at(0), 'anil@kcpl.example');
  await tester.enterText(find.byType(TextField).at(1), 'secret');
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await settle(tester);
}

void main() {
  setUpAll(initFormatting);

  group('API client', () {
    test('ticks go to the staff routes with the bearer token and a boolean body', () async {
      final seen = <http.Request>[];
      final api = HttpOpsApi(
        base: Uri.parse('https://kcpl.example'),
        auth: _Auth(),
        client: MockClient((request) async {
          seen.add(request);
          return http.Response('{"ok":true}', 200);
        }),
      );
      await api.setTask('KCPL-1', 't/1', true);
      await api.setCustomsStep('KCPL-1', 'c1', false);
      await api.markRead('alert:1');
      expect(seen.map((r) => r.url.path), [
        '/api/mobile/ops/v1/jobs/KCPL-1/tasks/t%2F1',
        '/api/mobile/ops/v1/jobs/KCPL-1/customs/c1',
        '/api/mobile/ops/v1/alerts/alert%3A1',
      ]);
      expect(seen.every((r) => r.method == 'POST' && r.headers['authorization'] == 'Bearer stale'), isTrue);
      expect(jsonDecode(seen[0].body), {'completed': true});
      expect(jsonDecode(seen[1].body), {'completed': false});
    });

    test('a 401 is retried once with a fresh token, and a second signs out', () async {
      final auth = _Auth();
      var calls = 0;
      final api = HttpOpsApi(
        base: Uri.parse('https://kcpl.example'),
        auth: auth,
        client: MockClient((request) async {
          calls++;
          return http.Response('{"ok":false,"code":"signed_out"}', 401);
        }),
      );
      await expectLater(api.today(), throwsA(isA<SignedOutException>()));
      expect(calls, 2);
      expect(auth.signedOut, isTrue);
    });
  });

  test('a Job File in the server shape parses, with closeout blockers', () {
    final file = JobFile.fromJson({
      'job': {
        'reference': 'KCPL-2609-0142',
        'customer_name': 'Annapurna',
        'status': 'exception',
        'origin': 'Haldia, India',
        'destination': 'Biratnagar, Nepal',
        'mode': 'sea',
        'primary_branch': 'Birgunj',
        'handling_branches': ['Birgunj', 'Kolkata'],
        'assigned_to_name': 'Anil',
        'priority': 'urgent',
        'tasks': [
          {'id': 't1', 'title': 'Call', 'branch': 'Birgunj', 'due_at': '2000-01-01T00:00:00Z', 'completed': false},
          {'id': 't2', 'title': 'Done', 'branch': 'Birgunj', 'completed': true},
        ],
        'customs_steps': [
          {'id': 'c1', 'title': 'Declaration', 'branch': 'Birgunj', 'required': true, 'completed': false},
        ],
        'costs': [],
        'cost_totals': {'NPR': 1000},
        'revenue_totals': {'NPR': 1500},
        'profit_totals': {'NPR': 500},
        'margin_percent': {'NPR': 33.33},
        'can_view_costs': true,
        'updated_at': '2026-09-24T00:00:00Z',
      },
      'workflow': {
        'blockers': ['Required customs steps are still open.'],
      },
    });
    expect(file.job.urgent, isTrue);
    expect(file.job.overdueTasks, 1);
    expect(file.job.customsOpen, 1);
    expect(file.handlingBranches, ['Birgunj', 'Kolkata']);
    expect(file.profitTotals['NPR'], 500);
    expect(file.blockers.single, contains('customs'));
  });

  test('an alert links to the job it is about', () {
    OpsAlert alert(String path) => OpsAlert.fromJson({'id': 'a', 'action_path': path, 'created_at': ''});
    expect(alert('/admin/jobs/KCPL-2609-0142').jobReference, 'KCPL-2609-0142');
    expect(alert('/admin/shipments/KCPL-1?tab=x').jobReference, 'KCPL-1');
    expect(alert('/admin/finance').jobReference, isNull);
  });

  testWidgets('sign in lands on Today with your lead job and the numbers', (tester) async {
    await pumpOps(tester);
    expect(find.text('KCPL Operations'), findsOneWidget);
    expect(find.text('English'), findsOneWidget, reason: 'the staff app offers Nepali from sign-in');
    await signIn(tester);

    expect(find.text('Today'), findsWidgets);
    expect(find.textContaining('Needs action'), findsOneWidget);
    expect(find.textContaining('1 overdue task'), findsOneWidget);
    // Your exception leads: the first row under Needs action.
    final needsAction = tester.getTopLeft(find.textContaining('Needs action')).dy;
    final lead = tester.getTopLeft(find.textContaining('KCPL-2609-0142', findRichText: true).first).dy;
    final moving = tester.getTopLeft(find.textContaining('Moving')).dy;
    expect(lead, inExclusiveRange(needsAction, moving), reason: 'your exception leads');
    expect(find.textContaining('Yours', findRichText: true), findsWidgets);
    // The unread badge is right before Alerts is opened.
    expect(find.text('3'), findsWidgets);
  });

  testWidgets('Today overdue shortcut opens Jobs with the matching filter', (tester) async {
    await pumpOps(tester);
    await signIn(tester);
    await tapInView(tester, find.textContaining('1 overdue task'));
    await settle(tester);
    expect(tester.widget<FilterBar<JobFilter>>(find.byType(FilterBar<JobFilter>)).selected, JobFilter.overdue);
  });

  testWidgets('large system text keeps Ops navigation usable', (tester) async {
    await pumpOps(tester);
    await signIn(tester);
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    tester.view.physicalSize = const Size(960, 1704);
    await tester.pump();
    for (final tab in [1, 2, 3, 0]) {
      await tester.tap(find.byType(TabBarItem).at(tab));
      await settle(tester);
    }
    final label = tester.widget<Text>(find.descendant(of: find.byType(TabBarItem).first, matching: find.text('Today')));
    expect(label.maxLines, 2);
    expect(MediaQuery.textScalerOf(tester.element(find.byType(TabBarItem).first)).scale(14), 28);
  });

  testWidgets('ticking a task shows at once and sticks', (tester) async {
    await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await settle(tester);

    await tapInView(tester, find.text('Call customer with revised ETA'));
    await tester.pump();
    expect(ticked(tester, 'Call customer with revised ETA'), isTrue);
    await settle(tester);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('Tasks · 2 of 4 done'), findsOneWidget, reason: 'the count follows the tick');
    expect(ticked(tester, 'Call customer with revised ETA'), isTrue);
  });

  testWidgets('a tick the server refuses comes back off and says why', (tester) async {
    await pumpOps(tester, api: _FailingSaves());
    await signIn(tester);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await settle(tester);

    await tapInView(tester, find.text('Call customer with revised ETA'));
    await settle(tester);
    expect(find.text('That item is outside your branch access.'), findsOneWidget);
    expect(ticked(tester, 'Call customer with revised ETA'), isFalse);
    expect(find.text('Tasks · 1 of 4 done'), findsOneWidget);
  });

  testWidgets('jobs start on your own work and filter like the web', (tester) async {
    await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.text('Jobs').last);
    await settle(tester);
    expect(find.textContaining('KCPL-2609-0151'), findsOneWidget);
    expect(find.textContaining('KCPL-2609-0163'), findsNothing, reason: 'Mine by default');

    await tester.enterText(find.byType(TextField).last, 'KCPL-2609-0142');
    await settle(tester);
    expect(find.textContaining('KCPL-2609-0151'), findsNothing);
    await tester.tap(find.byTooltip('Clear search'));
    await settle(tester);
    expect(find.textContaining('KCPL-2609-0151'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'All'));
    await settle(tester);
    expect(find.textContaining('KCPL-2609-0163'), findsOneWidget);
  });

  testWidgets('opening an alert marks it read and opens its job', (tester) async {
    final controller = await pumpOps(tester);
    await signIn(tester);
    expect(controller.unread, 3);
    await tester.tap(find.text('Alerts').last);
    await settle(tester);
    await tester.tap(find.text('KCPL-2609-0151 arrived at Birgunj ICD'));
    await settle(tester);
    expect(controller.unread, 2);
    expect(find.byType(JobDetailScreen), findsOneWidget);
  });

  testWidgets('a login KCPL does not know as staff is left signed out', (tester) async {
    final controller = await pumpOps(tester, api: _NotStaff());
    await signIn(tester);
    expect(controller.status, OpsStatus.signedOut);
    expect(find.textContaining('not authorised for KCPL Operations'), findsOneWidget);
  });

  testWidgets('coming back from a job refreshes Today, so a tick shows in its numbers', (tester) async {
    final api = _CountingToday();
    await pumpOps(tester, api: api);
    await signIn(tester);
    expect(api.todays, 1);
    await tester.tap(find.textContaining('KCPL-2609-0142').first);
    await settle(tester);
    await tapInView(tester, find.text('Call customer with revised ETA'));
    await settle(tester);
    await tester.pump(const Duration(seconds: 6));
    await tester.tap(find.byType(SheetCloseButton));
    await settle(tester);
    expect(api.todays, 2);
  });

  testWidgets('KCPL Ops reads in Nepali when chosen, and keeps the choice', (tester) async {
    final controller = await pumpOps(tester);
    await signIn(tester);
    await tester.tap(find.text('Me').last);
    await settle(tester);
    await tester.scrollUntilVisible(find.text('नेपाली'), 200, scrollable: find.byType(Scrollable).hitTestable().first);
    // Clear of the floating tab bar.
    await tester.ensureVisible(find.text('नेपाली'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('नेपाली'));
    await settle(tester);
    expect(find.text('आज'), findsWidgets, reason: 'the Today tab');
    expect(find.text('भाषा'), findsOneWidget);
    expect(await controller.prefs.read('kcpl.ops.locale'), 'ne');
    await tester.tap(find.text('आज').last);
    await settle(tester);
    expect(find.textContaining('काम गर्नुपर्ने'), findsOneWidget, reason: 'Needs action, in Nepali');
    expect(tester.takeException(), isNull);
  });
}
