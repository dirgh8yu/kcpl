import 'package:flutter/material.dart';

import '../../ui/motion.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/filter_bar.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import '../ops_rows.dart';

enum JobFilter { mine, all, urgent, overdue, customs, exceptions }

const jobFilterLabels = {
  JobFilter.mine: 'Mine',
  JobFilter.all: 'All',
  JobFilter.urgent: 'Urgent',
  JobFilter.overdue: 'Overdue',
  JobFilter.customs: 'Customs',
  JobFilter.exceptions: 'Exceptions',
};

bool matchesJobFilter(OpsJob job, JobFilter filter, String email) => switch (filter) {
      JobFilter.mine => job.ownedBy(email),
      JobFilter.all => true,
      JobFilter.urgent => job.urgent,
      JobFilter.overdue => job.overdueTasks > 0,
      JobFilter.customs => job.customsOpen > 0,
      JobFilter.exceptions => job.exception,
    };

bool matchesJobQuery(OpsJob job, String query) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return true;
  return [job.reference, job.customerName, job.origin, job.destination, job.carrier ?? '', job.ownerName ?? '']
      .any((field) => field.toLowerCase().contains(needle));
}

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  JobFilter? _filter;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final controller = OpsScope.of(context);
    return AsyncPage<TodayBundle>(
      title: 'Jobs',
      load: controller.api.today,
      builder: (context, bundle) {
        final email = bundle.session.email;
        // Start on your own work when you have some, as a desk would.
        final filter = _filter ?? (bundle.jobs.any((j) => j.ownedBy(email)) ? JobFilter.mine : JobFilter.all);
        final visible = bundle.jobs.where((j) => matchesJobFilter(j, filter, email) && matchesJobQuery(j, _query)).toList();
        return [
          FilterBar<JobFilter>(
            hint: 'Search reference, customer, route or owner…',
            onQuery: (value) => setState(() => _query = value),
            options: jobFilterLabels,
            selected: filter,
            onSelected: (next) => setState(() => _filter = next),
          ),
          FilterSwap(
            filter: filter,
            child: visible.isEmpty
                ? EmptyState(
                    icon: Icons.search_off_rounded,
                    title: bundle.jobs.isEmpty ? 'No active jobs' : 'Nothing matches',
                    description: bundle.jobs.isEmpty ? 'Jobs in your branches appear here.' : 'Try another filter or clear the search.',
                  )
                : RowGroup(children: [for (final job in visible) JobRow(job)]),
          ),
        ];
      },
    );
  }
}
