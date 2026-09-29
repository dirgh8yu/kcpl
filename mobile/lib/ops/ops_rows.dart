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
import '../ui/widgets/split_view.dart';
import 'ops_l10n.dart';

/// Beside the list on a tablet; as a sheet otherwise.
void openJob(BuildContext context, String reference, {OpsJob? preview}) {
  if (SplitView.select(context, reference)) return;
  Navigator.of(context).push(
    SheetRoute<void>(
      builder: (_) => JobDetailScreen(reference: reference, preview: preview),
    ),
  );
}

/// The one thing about a job a desk should see first: trouble, then late
/// work, then urgency, then plain status.
(String, Emphasis) jobFlag(AppLocalizations l, OpsJob job) {
  if (job.exception) return (statusLabel(l, job.status), Emphasis.attention);
  if (job.overdueTasks > 0) return (l.opsOverdueCount(job.overdueTasks), Emphasis.attention);
  final step = job.step;
  if (step != null && step.stuck) return (l.opsStuckStep(stepLabel(l, step)), Emphasis.attention);
  if (job.urgent) return (l.opsPriorityUrgent, Emphasis.attention);
  // The same "what's next" the web list and Job File show.
  if (step != null && !step.finished) return (l.opsNextStep(stepLabel(l, step)), Emphasis.normal);
  if (job.customsOpen > 0 && job.status == 'customs_clearance') return (l.opsCustomsOpenCount(job.customsOpen), Emphasis.normal);
  return (statusLabel(l, job.status), Emphasis.muted);
}

/// A Job File step's name in the app's language, by its id.
String stepLabel(AppLocalizations l, JobStep step) => switch (step.id) {
  'booking' => l.opsStepBooking,
  'pickup' => l.opsStepPickup,
  'documents' => l.opsStepDocuments,
  'customs' => l.opsStepCustoms,
  'transit' => l.opsStepTransit,
  'delivery' => l.opsStepDelivery,
  'proof' => l.opsStepProof,
  'invoice' => l.opsStepInvoice,
  'close' => l.opsStepClose,
  _ => step.label,
};

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
    return SplitSelected(
      id: job.reference,
      child: RowTile(
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
      ),
    );
  }
}
