import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../ui/labels.dart';
import '../../ui/motion.dart';
import '../../ui/screens/overview_screen.dart' show JourneyGraphic;
import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/bento.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/push_ui.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import '../ops_rows.dart';

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
  const TodayScreen({super.key, required this.onNavigate});
  final ValueChanged<OpsTab> onNavigate;

  @override
  Widget build(BuildContext context) {
    final controller = OpsScope.of(context);
    return AsyncPage<TodayBundle>(
      title: 'Today',
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
    final lead = leadJob(bundle.jobs, session.email);
    final mine = bundle.jobs.where((j) => j.ownedBy(session.email) && j != lead).toList();
    final trouble = bundle.jobs.where((j) => !j.ownedBy(session.email) && j != lead && (j.exception || j.overdueTasks > 0)).toList();

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter),
        child: Text(
          [session.displayName, session.roleLabel, session.canAccessAllBranches ? 'All branches' : session.branches.join(', ')].join(' · '),
          style: context.type.bodyLarge?.copyWith(color: p.secondary),
        ),
      ),
      const PushPrimer(copy: opsPushCopy),
      if (lead != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 0),
          child: _LeadCard(job: lead, mine: lead.ownedBy(session.email)),
        ),
      // Crimson only where something has gone wrong: late work and exceptions.
      const SizedBox(height: 24),
      Bento(
        rows: [
          [
            BentoTile(
              label: 'Active jobs',
              value: totals.active,
              large: true,
              flex: 3,
              caption: '${totals.urgent} urgent · ${totals.unassigned} unassigned',
              onTap: () => onNavigate(OpsTab.jobs),
              chart: Row(
                children: [
                  RingChart(fraction: totals.active == 0 ? 0 : totals.urgent / totals.active, size: 36, attention: totals.urgent > 0),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      totals.active == 0 ? 'Nothing active' : '${(100 * totals.urgent / totals.active).round()}% urgent',
                      style: context.type.labelMedium?.copyWith(color: p.secondary),
                    ),
                  ),
                ],
              ),
            ),
            BentoTile(
              label: 'Overdue tasks',
              value: totals.overdueTasks,
              caption: bundle.jobs.where((j) => j.overdueTasks > 0).take(3).map((j) => j.reference).join('\n'),
              attention: true,
              flex: 2,
              onTap: () => onNavigate(OpsTab.jobs),
            ),
          ],
          [
            BentoTile(label: 'Customs blocks', value: totals.customsBlockers, onTap: () => onNavigate(OpsTab.jobs)),
            BentoTile(label: 'Exceptions', value: totals.exceptions, attention: true),
            BentoTile(label: 'Deliveries today', value: totals.deliveriesToday),
          ],
        ],
      ),
      if (mine.isNotEmpty) ...[
        SectionHeader('Your jobs', actionLabel: 'All jobs', onAction: () => onNavigate(OpsTab.jobs)),
        RowGroup(children: [for (final job in mine.take(6)) JobRow(job)]),
      ],
      if (trouble.isNotEmpty) ...[
        SectionHeader('Needs attention'),
        RowGroup(children: [for (final job in trouble.take(6)) JobRow(job)]),
      ],
      if (bundle.branches.length > 1) ...[SectionHeader('Branches'), _BranchLoad(branches: bundle.branches)],
      if (lead == null && mine.isEmpty && trouble.isEmpty)
        const EmptyState(
          icon: KIcons.today,
          title: 'Nothing waiting on you',
          description: 'No active jobs in your branches need attention right now.',
        ),
    ];
  }
}

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.job, required this.mine});
  final OpsJob job;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final (flag, emphasis) = jobFlag(l, job);
    return JourneyGraphic(
      shipment: job.asShipment,
      trailing: mine ? 'Yours' : (job.ownerName ?? 'Unassigned'),
      status: flag,
      emphasis: emphasis,
      subtitle: job.customerName.isEmpty ? modeLabel(l, job.mode) : job.customerName,
      onTap: () => openJob(context, job.reference, preview: job),
    );
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
    final reduced = Motion.reduced(context);
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
                      return TweenAnimationBuilder<double>(
                        tween: Tween(begin: reduced ? 1 : 0, end: 1),
                        duration: Duration(milliseconds: reduced ? 0 : 700 + i * 80),
                        curve: Motion.easeOut,
                        builder: (context, t, _) => Stack(
                          children: [
                            Container(
                              height: 8,
                              decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(4)),
                            ),
                            Container(
                              width: full * t,
                              height: 8,
                              decoration: BoxDecoration(color: p.ink, borderRadius: BorderRadius.circular(4)),
                            ),
                            if (urgent > 0)
                              Container(
                                width: urgent * t,
                                height: 8,
                                decoration: BoxDecoration(color: p.accent, borderRadius: BorderRadius.circular(4)),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 6),
                  Text(
                    [
                      '${branches[i].urgent} urgent',
                      '${branches[i].customsBlockers} customs',
                      '${branches[i].deliveriesToday} delivering today',
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
