import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../ui/format.dart';
import '../ui/labels.dart';
import '../ui/theme.dart';
import '../ui/widgets/common.dart';
import '../ui/widgets/journey.dart';
import 'ops_models.dart';
import 'screens/job_detail_screen.dart';
import '../ui/widgets/sheet_route.dart';

void openJob(BuildContext context, String reference, {OpsJob? preview}) => Navigator.of(context).push(
  SheetRoute<void>(
    builder: (_) => JobDetailScreen(reference: reference, preview: preview),
  ),
);

/// The one thing about a job a desk should see first: trouble, then late
/// work, then urgency, then plain status.
(String, Emphasis) jobFlag(AppLocalizations l, OpsJob job) {
  if (job.exception) return (statusLabel(l, job.status), Emphasis.attention);
  if (job.overdueTasks > 0) return ('${job.overdueTasks} overdue', Emphasis.attention);
  if (job.urgent) return ('Urgent', Emphasis.attention);
  if (job.customsOpen > 0 && job.status == 'customs_clearance') return ('${job.customsOpen} customs open', Emphasis.normal);
  return (statusLabel(l, job.status), Emphasis.muted);
}

class JobRow extends StatelessWidget {
  const JobRow(this.job, {super.key});
  final OpsJob job;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final (flag, emphasis) = jobFlag(l, job);
    return RowTile(
      onTap: () => openJob(context, job.reference, preview: job),
      leading: ModeBadge(mode: job.mode, status: job.status),
      title: RouteText(place(job.origin), place(job.destination)),
      subtitle: Text(
        [job.reference, if (job.customerName.isNotEmpty) job.customerName].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(job.eta == null ? '—' : formatShortDate(job.eta), style: context.type.titleSmall),
          const SizedBox(height: 3),
          StatusText(flag, emphasis, style: context.type.bodySmall),
        ],
      ),
      below: job.status == 'delivered'
          ? null
          : Padding(
              padding: const EdgeInsetsDirectional.only(start: 34),
              child: JourneyBar(status: job.status),
            ),
    );
  }
}
