import 'package:flutter/material.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/stats.dart' show Surface;
import '../../ui/widgets/common.dart';
import '../../ui/widgets/push_ui.dart';
import '../ops_controller.dart';
import 'driver_screen.dart';
import 'scan_screen.dart';
import '../ops_models.dart';
import '../ops_rows.dart';
import '../ops_l10n.dart';
import 'jobs_screen.dart' show JobFilter;

enum OpsTab { today, jobs, alerts, me }

/// The job most worth a look right now: this person's trouble first, then
/// anything in trouble, then their most urgent, then their next arrival.
OpsJob? leadJob(List<OpsJob> jobs, String email) {
  int rank(OpsJob j) =>
      (j.ownedBy(email) ? 0 : 10) +
      (j.exception
          ? 0
          : j.overdueTasks > 0
          ? 1
          : j.urgent
          ? 2
          : 5);
  final active = jobs.where((j) => j.status != 'delivered').toList();
  if (active.isEmpty) return null;
  active.sort((a, b) {
    final byRank = rank(a).compareTo(rank(b));
    if (byRank != 0) return byRank;
    return (a.eta ?? '9999').compareTo(b.eta ?? '9999');
  });
  return active.first;
}

class TodayScreen extends StatelessWidget {
  const TodayScreen({super.key, required this.onOpenJobs});
  final ValueChanged<JobFilter> onOpenJobs;

  @override
  Widget build(BuildContext context) {
    final controller = OpsScope.of(context);
    return AsyncPage<TodayBundle>(
      title: context.l.opsToday,
      actions: [IconButton(tooltip: context.l.opsScan, icon: const Icon(KIcons.scan, size: 22), onPressed: () => openScan(context))],
      load: () async {
        final bundle = await controller.api.today();
        controller.updateSession(bundle.session);
        return bundle;
      },
      builder: (context, bundle) => _body(context, bundle),
    );
  }

  List<Widget> _body(BuildContext context, TodayBundle bundle) {
    final p = context.palette;
    final session = bundle.session;
    final totals = bundle.totals;
    final email = session.email;
    bool needsAction(OpsJob j) => j.status != 'delivered' && (j.exception || j.overdueTasks > 0 || j.urgent);
    int byOwnerThenEta(OpsJob a, OpsJob b) {
      final mine = (b.ownedBy(email) ? 1 : 0) - (a.ownedBy(email) ? 1 : 0);
      return mine != 0 ? mine : (a.eta ?? '9999').compareTo(b.eta ?? '9999');
    }

    // Like Reminders' Today: what needs doing, what is under way, what is
    // done. Your own work leads each group.
    final lead = leadJob(bundle.jobs, email);
    final action = bundle.jobs.where(needsAction).toList()..sort((a, b) => a == lead ? -1 : (b == lead ? 1 : byOwnerThenEta(a, b)));
    final moving = bundle.jobs.where((j) => j.status != 'delivered' && !needsAction(j)).toList()..sort(byOwnerThenEta);
    final done = bundle.jobs.where((j) => j.status == 'delivered').toList();

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
        child: Text(
          [
            session.displayName,
            session.roleLabel,
            session.canAccessAllBranches ? context.l.opsAllBranches : session.branches.join(', '),
          ].join(' · '),
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
        ),
      ),
      RowGroup(
        margin: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
        indent: RowGroup.iconIndent,
        children: [
          RowTile(
            onTap: () => openDriver(context),
            leading: Icon(KIcons.truck, size: 22, color: p.accent),
            title: Text(context.l.opsTodaysDeliveries, style: TextStyle(color: p.accent)),
            subtitle: Text(context.l.opsDueTodaySummary(totals.deliveriesToday)),
            chevron: true,
          ),
        ],
      ),
      if (action.isNotEmpty) ...[
        SectionHeader(context.l.opsNeedsAction, count: action.length, attention: true, top: 20),
        RowGroup(indent: RowGroup.iconIndent, children: [for (final job in action.take(8)) JobRow(job, owner: true)]),
      ],
      if (moving.isNotEmpty) ...[
        SectionHeader(
          context.l.opsMoving,
          count: moving.length,
          actionLabel: context.l.opsAllJobs,
          onAction: () => onOpenJobs(JobFilter.all),
        ),
        RowGroup(indent: RowGroup.iconIndent, children: [for (final job in moving.take(8)) JobRow(job, owner: true)]),
      ],
      if (done.isNotEmpty) ...[
        SectionHeader(context.l.opsDelivered, count: done.length),
        RowGroup(indent: RowGroup.iconIndent, children: [for (final job in done.take(5)) JobRow(job, owner: true)]),
      ],
      if (totals.overdueTasks > 0 || totals.customsBlockers > 0)
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            if (totals.overdueTasks > 0)
              RowTile(
                onTap: () => onOpenJobs(JobFilter.overdue),
                leading: const Icon(KIcons.timer, size: 22),
                title: Text(context.l.opsOverdueTasks(totals.overdueTasks)),
                chevron: true,
              ),
            if (totals.customsBlockers > 0)
              RowTile(
                onTap: () => onOpenJobs(JobFilter.customs),
                leading: const Icon(KIcons.document, size: 22),
                title: Text(context.l.opsCustomsBlocks(totals.customsBlockers)),
                chevron: true,
              ),
          ],
        ),
      Footnote([context.l.opsDeliveringToday(totals.deliveriesToday), context.l.opsUnassignedCount(totals.unassigned)].join(' · ')),
      if (bundle.branches.length > 1) ...[SectionHeader(context.l.opsBranches), _BranchLoad(branches: bundle.branches)],
      if (action.isEmpty && moving.isEmpty && done.isEmpty)
        EmptyState(icon: KIcons.today, title: context.l.opsNothingWaiting, description: context.l.opsNothingWaitingBody),
      PushPrimer(copy: opsPushCopy(context.l)),
    ];
  }
}

/// Active jobs per branch as bars that grow in, with the urgent share in
/// crimson at the start of each: where the load and the trouble are, at a
/// glance.
class _BranchLoad extends StatelessWidget {
  const _BranchLoad({required this.branches});
  final List<BranchLoad> branches;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final peak = branches.fold<int>(1, (m, b) => b.active > m ? b.active : m);
    return Surface(
      margin: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 0),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          for (var i = 0; i < branches.length; i++)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(branches[i].branch, style: context.type.titleMedium)),
                      Text(
                        '${branches[i].active}',
                        style: context.type.titleMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final b = branches[i];
                      final full = constraints.maxWidth * b.active / peak;
                      final urgent = b.active == 0 ? 0.0 : full * b.urgent / b.active;
                      // Load is data: drawn where it stands, not grown in.
                      return Stack(
                        children: [
                          Container(
                            height: 4,
                            decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(2)),
                          ),
                          Container(
                            width: full,
                            height: 4,
                            decoration: BoxDecoration(color: p.ink, borderRadius: BorderRadius.circular(2)),
                          ),
                          if (urgent > 0)
                            Container(
                              width: urgent,
                              height: 4,
                              decoration: BoxDecoration(color: p.accent, borderRadius: BorderRadius.circular(2)),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 6),
                  Text(
                    [
                      context.l.opsUrgentCount(branches[i].urgent),
                      context.l.opsCustomsCount(branches[i].customsBlockers),
                      context.l.opsDeliveringToday(branches[i].deliveriesToday),
                    ].join(' · '),
                    style: context.type.bodySmall,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
