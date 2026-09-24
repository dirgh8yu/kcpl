// Mirrors of the admin types the staff API returns (command-centre-data.ts,
// job-file.ts, workflow-guard.ts, notification-data.ts). Parsing is lenient,
// as in the customer app: a missing field becomes an empty value.

import '../api/models.dart';

String _s(Object? v, [String f = '']) => v is String ? v : f;
String? _ns(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
double _n(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
bool _b(Object? v) => v == true;
List<Map<String, dynamic>> _list(Object? v) =>
    v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];
List<String> _strings(Object? v) => v is List ? v.whereType<String>().toList() : const [];
Map<String, double> _money(Object? v) =>
    v is Map ? {for (final e in v.entries) '${e.key}': _n(e.value)} : const {};

class OpsSession {
  const OpsSession({
    required this.displayName,
    required this.email,
    required this.role,
    required this.roleLabel,
    required this.branches,
    required this.canAccessAllBranches,
    required this.canViewCosts,
  });

  final String displayName;
  final String email;
  final String role;
  final String roleLabel;
  final List<String> branches;
  final bool canAccessAllBranches;
  final bool canViewCosts;

  factory OpsSession.fromJson(Map<String, dynamic> j) => OpsSession(
        displayName: _s(j['displayName'], 'KCPL Staff'),
        email: _s(j['email']),
        role: _s(j['role'], 'operations'),
        roleLabel: _s(j['roleLabel'], 'Operations'),
        branches: _strings(j['branches']),
        canAccessAllBranches: _b(j['canAccessAllBranches']),
        canViewCosts: _b(j['canViewCosts']),
      );
}

/// A job as the command centre lists it.
class OpsJob {
  const OpsJob({
    required this.reference,
    required this.customerName,
    required this.origin,
    required this.destination,
    required this.mode,
    required this.status,
    required this.primaryBranch,
    this.ownerName,
    this.ownerEmail,
    this.ownerPhone,
    required this.priority,
    this.eta,
    this.currentLocation,
    this.carrier,
    required this.openTasks,
    required this.overdueTasks,
    required this.customsOpen,
    required this.updatedAt,
  });

  final String reference;
  final String customerName;
  final String origin;
  final String destination;
  final String mode;
  final String status;
  final String primaryBranch;
  final String? ownerName;
  final String? ownerEmail;
  final String? ownerPhone;
  final String priority;
  final String? eta;
  final String? currentLocation;
  final String? carrier;
  final int openTasks;
  final int overdueTasks;
  final int customsOpen;
  final String updatedAt;

  bool get urgent => priority == 'urgent';
  bool get exception => status == 'exception';

  bool ownedBy(String email) => ownerEmail != null && ownerEmail!.toLowerCase() == email.toLowerCase();

  /// The shape the shared journey widgets draw.
  Shipment get asShipment => Shipment(
        reference: reference,
        status: status,
        mode: mode,
        origin: origin,
        destination: destination,
        eta: eta,
        currentLocation: currentLocation,
        carrier: carrier,
        createdAt: updatedAt,
        updatedAt: updatedAt,
      );

  factory OpsJob.fromJson(Map<String, dynamic> j) => OpsJob(
        reference: _s(j['reference']),
        customerName: _s(j['customer_name']),
        origin: _s(j['origin']),
        destination: _s(j['destination']),
        mode: _s(j['mode'], 'unsure'),
        status: _s(j['status'], 'booking_confirmed'),
        primaryBranch: _s(j['primary_branch']),
        ownerName: _ns(j['assigned_to_name']),
        ownerEmail: _ns(j['assigned_to_email']),
        ownerPhone: _ns(j['assigned_to_phone']),
        priority: _s(j['priority'], 'standard'),
        eta: _ns(j['eta']),
        currentLocation: _ns(j['current_location']),
        carrier: _ns(j['carrier']),
        openTasks: _i(j['open_tasks']),
        overdueTasks: _i(j['overdue_tasks']),
        customsOpen: _i(j['required_customs_open']),
        updatedAt: _s(j['updated_at']),
      );
}

class OpsTotals {
  const OpsTotals({
    required this.active,
    required this.urgent,
    required this.overdueTasks,
    required this.customsBlockers,
    required this.deliveriesToday,
    required this.unassigned,
    required this.exceptions,
  });

  final int active;
  final int urgent;
  final int overdueTasks;
  final int customsBlockers;
  final int deliveriesToday;
  final int unassigned;
  final int exceptions;

  factory OpsTotals.fromJson(Map<String, dynamic> j) => OpsTotals(
        active: _i(j['active_jobs']),
        urgent: _i(j['urgent_jobs']),
        overdueTasks: _i(j['overdue_tasks']),
        customsBlockers: _i(j['customs_blockers']),
        deliveriesToday: _i(j['deliveries_today']),
        unassigned: _i(j['unassigned_jobs']),
        exceptions: _i(j['exception_jobs']),
      );
}

class BranchLoad {
  const BranchLoad({required this.branch, required this.active, required this.urgent, required this.customsBlockers, required this.deliveriesToday});
  final String branch;
  final int active;
  final int urgent;
  final int customsBlockers;
  final int deliveriesToday;

  factory BranchLoad.fromJson(Map<String, dynamic> j) => BranchLoad(
        branch: _s(j['branch']),
        active: _i(j['active_jobs']),
        urgent: _i(j['urgent_jobs']),
        customsBlockers: _i(j['customs_blockers']),
        deliveriesToday: _i(j['deliveries_today']),
      );
}

class TodayBundle {
  const TodayBundle({required this.session, required this.totals, required this.jobs, required this.branches, required this.generatedAt});
  final OpsSession session;
  final OpsTotals totals;
  final List<OpsJob> jobs;
  final List<BranchLoad> branches;
  final String generatedAt;

  factory TodayBundle.fromJson(Map<String, dynamic> body) {
    final data = (body['data'] as Map?)?.cast<String, dynamic>() ?? const {};
    return TodayBundle(
      session: OpsSession.fromJson((body['session'] as Map?)?.cast<String, dynamic>() ?? const {}),
      totals: OpsTotals.fromJson((data['totals'] as Map?)?.cast<String, dynamic>() ?? const {}),
      jobs: _list(data['jobs']).map(OpsJob.fromJson).toList(),
      branches: _list(data['branch_load']).map(BranchLoad.fromJson).toList(),
      generatedAt: _s(data['generated_at']),
    );
  }
}

class JobTask {
  const JobTask({required this.id, required this.title, this.detail, required this.branch, this.dueAt, this.assignee, required this.completed});
  final String id;
  final String title;
  final String? detail;
  final String branch;
  final String? dueAt;
  final String? assignee;
  final bool completed;

  JobTask copyWith({bool? completed}) =>
      JobTask(id: id, title: title, detail: detail, branch: branch, dueAt: dueAt, assignee: assignee, completed: completed ?? this.completed);

  bool overdue(DateTime now) {
    final due = dueAt == null ? null : DateTime.tryParse(dueAt!);
    return !completed && due != null && due.isBefore(now);
  }

  factory JobTask.fromJson(Map<String, dynamic> j) => JobTask(
        id: _s(j['id']),
        title: _s(j['title']),
        detail: _ns(j['detail']),
        branch: _s(j['branch']),
        dueAt: _ns(j['due_at']),
        assignee: _ns(j['assigned_to_name']),
        completed: _b(j['completed']),
      );
}

class CustomsStep {
  const CustomsStep({required this.id, required this.title, this.detail, required this.branch, required this.required, required this.completed});
  final String id;
  final String title;
  final String? detail;
  final String branch;
  final bool required;
  final bool completed;

  CustomsStep copyWith({bool? completed}) =>
      CustomsStep(id: id, title: title, detail: detail, branch: branch, required: required, completed: completed ?? this.completed);

  factory CustomsStep.fromJson(Map<String, dynamic> j) => CustomsStep(
        id: _s(j['id']),
        title: _s(j['title']),
        detail: _ns(j['detail']),
        branch: _s(j['branch']),
        required: _b(j['required']),
        completed: _b(j['completed']),
      );
}

class JobFile {
  const JobFile({
    required this.job,
    this.carrierReference,
    required this.handlingBranches,
    this.ownerTitle,
    this.internalReference,
    this.internalNotes,
    required this.tasks,
    required this.customs,
    required this.canViewCosts,
    required this.costTotals,
    required this.revenueTotals,
    required this.profitTotals,
    required this.marginPercent,
    required this.blockers,
  });

  /// The list-row fields, so the header renders from either source.
  final OpsJob job;
  final String? carrierReference;
  final List<String> handlingBranches;
  final String? ownerTitle;
  final String? internalReference;
  final String? internalNotes;
  final List<JobTask> tasks;
  final List<CustomsStep> customs;
  final bool canViewCosts;
  final Map<String, double> costTotals;
  final Map<String, double> revenueTotals;
  final Map<String, double> profitTotals;
  final Map<String, double> marginPercent;

  /// What stands between this job and closeout, in the Job File's words.
  final List<String> blockers;

  factory JobFile.fromJson(Map<String, dynamic> body) {
    final j = (body['job'] as Map?)?.cast<String, dynamic>() ?? const {};
    final workflow = (body['workflow'] as Map?)?.cast<String, dynamic>();
    final tasks = _list(j['tasks']).map(JobTask.fromJson).toList();
    final customs = _list(j['customs_steps']).map(CustomsStep.fromJson).toList();
    return JobFile(
      job: OpsJob(
        reference: _s(j['reference']),
        customerName: _s(j['customer_name']),
        origin: _s(j['origin']),
        destination: _s(j['destination']),
        mode: _s(j['mode'], 'unsure'),
        status: _s(j['status'], 'booking_confirmed'),
        primaryBranch: _s(j['primary_branch']),
        ownerName: _ns(j['assigned_to_name']),
        ownerEmail: _ns(j['assigned_to_email']),
        ownerPhone: _ns(j['assigned_to_phone']),
        priority: _s(j['priority'], 'standard'),
        eta: _ns(j['eta']),
        currentLocation: _ns(j['current_location']),
        carrier: _ns(j['carrier']),
        openTasks: tasks.where((t) => !t.completed).length,
        overdueTasks: tasks.where((t) => t.overdue(DateTime.now())).length,
        customsOpen: customs.where((c) => c.required && !c.completed).length,
        updatedAt: _s(j['updated_at']),
      ),
      carrierReference: _ns(j['carrier_reference']),
      handlingBranches: _strings(j['handling_branches']),
      ownerTitle: _ns(j['assigned_to_job_title']),
      internalReference: _ns(j['internal_reference']),
      internalNotes: _ns(j['internal_notes']),
      tasks: tasks,
      customs: customs,
      canViewCosts: _b(j['can_view_costs']),
      costTotals: _money(j['cost_totals']),
      revenueTotals: _money(j['revenue_totals']),
      profitTotals: _money(j['profit_totals']),
      marginPercent: _money(j['margin_percent']),
      blockers: workflow == null ? const [] : _strings(workflow['blockers']),
    );
  }
}

class OpsAlert {
  const OpsAlert({
    required this.id,
    required this.category,
    required this.severity,
    required this.title,
    required this.detail,
    required this.actionPath,
    this.branch,
    required this.createdAt,
    required this.resolved,
    this.readAt,
  });

  final String id;
  final String category;
  final String severity;
  final String title;
  final String detail;
  final String actionPath;
  final String? branch;
  final String createdAt;
  final bool resolved;
  final String? readAt;

  bool get unread => readAt == null && !resolved;

  OpsAlert markedRead(String at) => OpsAlert(
        id: id,
        category: category,
        severity: severity,
        title: title,
        detail: detail,
        actionPath: actionPath,
        branch: branch,
        createdAt: createdAt,
        resolved: resolved,
        readAt: at,
      );

  /// The shipment an alert is about, when its link points at a Job File.
  String? get jobReference => RegExp(r'/admin/(?:jobs|shipments)/([A-Za-z0-9-]+)').firstMatch(actionPath)?.group(1);

  factory OpsAlert.fromJson(Map<String, dynamic> j) => OpsAlert(
        id: _s(j['id']),
        category: _s(j['category'], 'activity'),
        severity: _s(j['severity'], 'info'),
        title: _s(j['title']),
        detail: _s(j['detail']),
        actionPath: _s(j['action_path']),
        branch: _ns(j['branch']),
        createdAt: _s(j['created_at']),
        resolved: _b(j['resolved']),
        readAt: _ns(j['read_at']),
      );
}

class AlertsPage {
  const AlertsPage({required this.alerts, required this.unreadCount});
  final List<OpsAlert> alerts;
  final int unreadCount;
}
