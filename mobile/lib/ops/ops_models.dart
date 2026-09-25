// Mirrors of the admin types the staff API returns (command-centre-data.ts,
// job-file.ts, workflow-guard.ts, notification-data.ts). Parsing is lenient,
// as in the customer app: a missing field becomes an empty value.

import '../api/models.dart';

String _s(Object? v, [String f = '']) => v is String ? v : f;
String? _ns(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
double _n(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
bool _b(Object? v) => v == true;
List<Map<String, dynamic>> _list(Object? v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];
List<String> _strings(Object? v) => v is List ? v.whereType<String>().toList() : const [];
Map<String, double> _money(Object? v) => v is Map ? {for (final e in v.entries) '${e.key}': _n(e.value)} : const {};

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

  OpsJob withOwner(String name, String email, String? phone) => OpsJob(
    reference: reference,
    customerName: customerName,
    origin: origin,
    destination: destination,
    mode: mode,
    status: status,
    primaryBranch: primaryBranch,
    ownerName: name,
    ownerEmail: email,
    ownerPhone: phone,
    priority: priority,
    eta: eta,
    currentLocation: currentLocation,
    carrier: carrier,
    openTasks: openTasks,
    overdueTasks: overdueTasks,
    customsOpen: customsOpen,
    updatedAt: updatedAt,
  );

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
  const BranchLoad({
    required this.branch,
    required this.active,
    required this.urgent,
    required this.customsBlockers,
    required this.deliveriesToday,
  });
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
  const JobTask({
    required this.id,
    required this.title,
    this.detail,
    required this.branch,
    this.dueAt,
    this.assignee,
    required this.completed,
  });
  final String id;
  final String title;
  final String? detail;
  final String branch;
  final String? dueAt;
  final String? assignee;
  final bool completed;

  JobTask copyWith({bool? completed}) => JobTask(
    id: id,
    title: title,
    detail: detail,
    branch: branch,
    dueAt: dueAt,
    assignee: assignee,
    completed: completed ?? this.completed,
  );

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
  const CustomsStep({
    required this.id,
    required this.title,
    this.detail,
    required this.branch,
    required this.required,
    required this.completed,
  });
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
    this.fieldNotes = const [],
    this.closeBlockers = const [],
    this.jobClosed = false,
    this.delivery,
  });

  /// Delivery Control, when it could be read alongside.
  final DeliveryControl? delivery;

  JobFile withDelivery(DeliveryControl? delivery) => JobFile(
    job: job,
    carrierReference: carrierReference,
    handlingBranches: handlingBranches,
    ownerTitle: ownerTitle,
    internalReference: internalReference,
    internalNotes: internalNotes,
    tasks: tasks,
    customs: customs,
    canViewCosts: canViewCosts,
    costTotals: costTotals,
    revenueTotals: revenueTotals,
    profitTotals: profitTotals,
    marginPercent: marginPercent,
    blockers: blockers,
    fieldNotes: fieldNotes,
    closeBlockers: closeBlockers,
    jobClosed: jobClosed,
    delivery: delivery,
  );

  /// What stands between this job and closing it, as closeout checks it.
  final List<String> closeBlockers;
  final bool jobClosed;

  /// Notes and photos added from the field, newest first.
  final List<FieldNote> fieldNotes;

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
      closeBlockers: workflow == null ? const [] : _strings(workflow['close_blockers']),
      jobClosed: workflow != null && _b(workflow['job_closed']),
      fieldNotes: _list(body['fieldNotes']).map(FieldNote.fromJson).toList(),
    );
  }
}

/// A note left on a job from the field, with or without a photo. On the web
/// it is Job File activity; a photo is in the job's Document Vault.
class FieldNote {
  const FieldNote({required this.id, required this.text, this.author, required this.createdAt, this.photoFilename});
  final String id;
  final String text;
  final String? author;
  final String createdAt;
  final String? photoFilename;

  factory FieldNote.fromJson(Map<String, dynamic> j) {
    final photo = (j['photo'] as Map?)?.cast<String, dynamic>();
    return FieldNote(
      id: _s(j['id']),
      text: _s(j['text']),
      author: _ns(j['author']),
      createdAt: _s(j['created_at']),
      photoFilename: photo == null ? null : _ns(photo['filename']),
    );
  }
}

/// A job a scanned or typed identifier could mean, within the caller's
/// branches.
class ScanMatch {
  const ScanMatch({required this.reference, required this.origin, required this.destination, required this.status, this.carrierReference});
  final String reference;
  final String origin;
  final String destination;
  final String status;
  final String? carrierReference;

  factory ScanMatch.fromJson(Map<String, dynamic> j) => ScanMatch(
    reference: _s(j['reference']),
    origin: _s(j['origin']),
    destination: _s(j['destination']),
    status: _s(j['status'], 'booking_confirmed'),
    carrierReference: _ns(j['carrier_reference']),
  );
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

/// One delivery attempt from Delivery Control (delivery-control.ts).
class DeliveryAttempt {
  const DeliveryAttempt({
    required this.id,
    required this.number,
    required this.status,
    this.scheduledFor,
    this.eventTime,
    this.location,
    this.recipientName,
    this.recipientRelation,
    this.failureReason,
    this.driverName,
  });
  final String id;
  final int number;

  /// scheduled, out_for_delivery, delivered, failed or refused.
  final String status;
  final String? scheduledFor;
  final String? eventTime;
  final String? location;
  final String? recipientName;
  final String? recipientRelation;
  final String? failureReason;
  final String? driverName;

  /// Still on its way: an outcome can be recorded.
  bool get open => status == 'scheduled' || status == 'out_for_delivery';

  factory DeliveryAttempt.fromJson(Map<String, dynamic> j) => DeliveryAttempt(
    id: _s(j['id']),
    number: _i(j['attempt_number']),
    status: _s(j['status'], 'scheduled'),
    scheduledFor: _ns(j['scheduled_for']),
    eventTime: _ns(j['event_time']),
    location: _ns(j['location']),
    recipientName: _ns(j['recipient_name']),
    recipientRelation: _ns(j['recipient_relation']),
    failureReason: _ns(j['failure_reason']),
    driverName: _ns(j['driver_name']),
  );
}

/// A signature, photo or document held as proof of delivery.
class PodEvidence {
  const PodEvidence({required this.id, required this.attemptId, required this.kind, required this.filename, required this.reviewStatus});
  final String id;
  final String attemptId;
  final String kind;
  final String filename;

  /// received, verified or rejected. Verification happens at the desk.
  final String reviewStatus;

  factory PodEvidence.fromJson(Map<String, dynamic> j) => PodEvidence(
    id: _s(j['id']),
    attemptId: _s(j['attempt_id']),
    kind: _s(j['kind'], 'photo'),
    filename: _s(j['filename']),
    reviewStatus: _s(j['review_status'], 'received'),
  );
}

/// A job's deliveries: attempts newest first, and where POD stands.
class DeliveryControl {
  const DeliveryControl({required this.attempts, required this.evidence, required this.shipmentStatus, required this.podStatus});
  final List<DeliveryAttempt> attempts;
  final List<PodEvidence> evidence;
  final String shipmentStatus;

  /// not_received, received, rejected or verified.
  final String podStatus;

  DeliveryAttempt? get latest => attempts.isEmpty ? null : attempts.first;

  /// The attempt an outcome can be recorded against, if any.
  DeliveryAttempt? get open => attempts.where((a) => a.open).firstOrNull;

  /// Delivered, waiting on POD: evidence can still be added.
  DeliveryAttempt? get awaitingPod => podStatus == 'verified' ? null : attempts.where((a) => a.status == 'delivered').firstOrNull;

  factory DeliveryControl.fromJson(Map<String, dynamic> j) {
    final attempts = _list(j['attempts']).map(DeliveryAttempt.fromJson).toList()..sort((a, b) => b.number.compareTo(a.number));
    return DeliveryControl(
      attempts: attempts,
      evidence: _list(j['evidence']).map(PodEvidence.fromJson).toList(),
      shipmentStatus: _s(j['shipment_status'], 'booking_confirmed'),
      podStatus: _s(j['pod_status'], 'not_received'),
    );
  }
}

/// Someone a job can be given to, as the web's picker offers.
class StaffOption {
  const StaffOption({required this.uid, required this.name, required this.email, this.phone, this.jobTitle, required this.branches});
  final String uid;
  final String name;
  final String email;
  final String? phone;
  final String? jobTitle;
  final List<String> branches;

  factory StaffOption.fromJson(Map<String, dynamic> j) => StaffOption(
    uid: _s(j['uid']),
    name: _s(j['display_name'], _s(j['email'])),
    email: _s(j['email']),
    phone: _ns(j['phone']),
    jobTitle: _ns(j['job_title']),
    branches: _strings(j['branches']),
  );
}

/// Closing was refused: these still stand in the way. Management may close
/// anyway with a reason, which the Job File records.
class CloseoutBlocked implements Exception {
  const CloseoutBlocked(this.blockers, {required this.canOverride});
  final List<String> blockers;
  final bool canOverride;
}

/// What a delivered outcome did: POD is still to be verified at the desk, so
/// the shipment is not yet Delivered in KCPL's records.
class DeliveryOutcome {
  const DeliveryOutcome({required this.attempt, required this.blockers});
  final DeliveryAttempt attempt;
  final List<String> blockers;
}
