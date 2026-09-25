import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../ui/format.dart';
import '../ui/labels.dart';
import '../ui/theme.dart';
import '../ui/widgets/common.dart';
import '../ui/widgets/journey.dart';
import 'ops_controller.dart';
import 'ops_models.dart';
import 'screens/job_detail_screen.dart';
import '../ui/widgets/sheet_route.dart';
import 'ops_l10n.dart';

void openJob(BuildContext context, String reference, {OpsJob? preview}) => Navigator.of(context).push(
  SheetRoute<void>(
    builder: (_) => JobDetailScreen(reference: reference, preview: preview),
  ),
);

/// The one thing about a job a desk should see first: trouble, then late
/// work, then urgency, then plain status.
(String, Emphasis) jobFlag(AppLocalizations l, OpsJob job) {
  if (job.exception) return (statusLabel(l, job.status), Emphasis.attention);
  if (job.overdueTasks > 0) return (l.opsOverdueCount(job.overdueTasks), Emphasis.attention);
  if (job.urgent) return (l.opsPriorityUrgent, Emphasis.attention);
  if (job.customsOpen > 0 && job.status == 'customs_clearance') return (l.opsCustomsOpenCount(job.customsOpen), Emphasis.normal);
  return (statusLabel(l, job.status), Emphasis.muted);
}

/// A job as a row: the route with its ETA, then what matters about it
/// (in crimson when it has gone wrong), its reference, and whose it is or
/// whose cargo, beneath.
class JobRow extends StatelessWidget {
  const JobRow(this.job, {super.key, this.owner = false});
  final OpsJob job;

  /// Say whose job it is ("Yours") rather than whose cargo.
  final bool owner;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final (flag, emphasis) = jobFlag(l, job);
    final email = OpsScope.of(context).session?.email ?? '';
    final who = owner ? (job.ownedBy(email) ? context.l.opsYours : (job.ownerName ?? context.l.opsUnassigned)) : job.customerName;
    return RowTile(
      onTap: () => openJob(context, job.reference, preview: job),
      leading: ModeBadge(mode: job.mode, status: job.status),
      title: RouteText(place(job.origin), place(job.destination)),
      accessory: Text(job.eta == null ? '—' : formatShortDate(job.eta)),
      subtitle: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: flag,
              style: TextStyle(color: emphasis == Emphasis.attention ? p.accent : null),
            ),
            TextSpan(text: ' · ${job.reference}'),
            if (who.isNotEmpty) TextSpan(text: ' · $who'),
          ],
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      below: job.status == 'delivered' ? null : JourneyBar(status: job.status),
    );
  }
}
