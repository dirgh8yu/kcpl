import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../ui/format.dart';
import '../../ui/labels.dart';
import '../../ui/motion.dart';
import '../../ui/screens/overview_screen.dart' show Figure, JourneyGraphic;
import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/push_ui.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import '../ops_rows.dart';

enum OpsTab { today, jobs, alerts, me }

/// The job most worth a look right now: this person's trouble first, then
/// anything in trouble, then their most urgent, then their next arrival.
OpsJob? leadJob(List<OpsJob> jobs, String email) {
  int rank(OpsJob j) => (j.ownedBy(email) ? 0 : 10) + (j.exception ? 0 : j.overdueTasks > 0 ? 1 : j.urgent ? 2 : 5);
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
        Padding(padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 0), child: _LeadCard(job: lead, mine: lead.ownedBy(session.email))),
      // Crimson only where something has gone wrong: late work and exceptions.
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 28, kGutter, 0),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Figure(label: 'Active jobs', value: totals.active, onTap: () => onNavigate(OpsTab.jobs)),
          Figure(label: 'Urgent', value: totals.urgent, onTap: () => onNavigate(OpsTab.jobs)),
          Figure(label: 'Overdue tasks', value: totals.overdueTasks, attention: totals.overdueTasks > 0, onTap: () => onNavigate(OpsTab.jobs)),
          Figure(label: 'Customs blocks', value: totals.customsBlockers, onTap: () => onNavigate(OpsTab.jobs)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Figure(label: 'Deliveries today', value: totals.deliveriesToday),
          Figure(label: 'Unassigned', value: totals.unassigned),
          Figure(label: 'Exceptions', value: totals.exceptions, attention: totals.exceptions > 0),
          const Spacer(),
        ]),
      ),
      if (mine.isNotEmpty) ...[
        SectionHeader('Your jobs', actionLabel: 'All jobs', onAction: () => onNavigate(OpsTab.jobs)),
        RowGroup(children: [for (final job in mine.take(6)) JobRow(job)]),
      ],
      if (trouble.isNotEmpty) ...[
        SectionHeader('Needs attention'),
        RowGroup(children: [for (final job in trouble.take(6)) JobRow(job)]),
      ],
      if (bundle.branches.length > 1) ...[
        SectionHeader('Branches'),
        _BranchLoad(branches: bundle.branches),
      ],
      if (lead == null && mine.isEmpty && trouble.isEmpty)
        const EmptyState(icon: Icons.wb_sunny_outlined, title: 'Nothing waiting on you', description: 'No active jobs in your branches need attention right now.'),
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
    final p = context.palette;
    final (flag, emphasis) = jobFlag(l, job);
    return Pressable(
      scale: 0.98,
      child: Material(
        color: p.fill,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          highlightColor: p.hairline,
          onTap: () => openJob(context, job.reference, preview: job),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(job.reference, style: context.type.labelMedium?.copyWith(color: p.secondary))),
                Text(mine ? 'Yours' : (job.ownerName ?? 'Unassigned'), style: context.type.labelMedium?.copyWith(color: p.secondary)),
              ]),
              const SizedBox(height: 14),
              JourneyGraphic(shipment: job.asShipment),
              const SizedBox(height: 18),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    StatusText(flag, emphasis, style: context.type.titleMedium),
                    const SizedBox(height: 2),
                    Text(
                      job.customerName.isEmpty ? modeLabel(l, job.mode) : job.customerName,
                      style: context.type.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ]),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(l.overviewColEta, style: context.type.bodySmall),
                      const SizedBox(height: 2),
                      Text(job.eta == null ? '—' : formatShortDate(job.eta), style: context.type.titleMedium),
                    ]),
                  ),
                ),
              ]),
            ]),
          ),
        ),
      ),
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
    return Column(children: [
      for (var i = 0; i < branches.length; i++)
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(branches[i].branch, style: context.type.titleMedium)),
              Text('${branches[i].active}', style: context.type.titleMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ]),
            const SizedBox(height: 8),
            LayoutBuilder(builder: (context, constraints) {
              final b = branches[i];
              final full = constraints.maxWidth * b.active / peak;
              final urgent = b.active == 0 ? 0.0 : full * b.urgent / b.active;
              return TweenAnimationBuilder<double>(
                tween: Tween(begin: reduced ? 1 : 0, end: 1),
                duration: Duration(milliseconds: reduced ? 0 : 700 + i * 80),
                curve: Motion.easeOut,
                builder: (context, t, _) => Stack(children: [
                  Container(height: 8, decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(4))),
                  Container(width: full * t, height: 8, decoration: BoxDecoration(color: p.ink, borderRadius: BorderRadius.circular(4))),
                  if (urgent > 0)
                    Container(width: urgent * t, height: 8, decoration: BoxDecoration(color: p.accent, borderRadius: BorderRadius.circular(4))),
                ]),
              );
            }),
            const SizedBox(height: 6),
            Text(
              [
                '${branches[i].urgent} urgent',
                '${branches[i].customsBlockers} customs',
                '${branches[i].deliveriesToday} delivering today',
              ].join(' · '),
              style: context.type.bodySmall,
            ),
          ]),
        ),
    ]);
  }
}
