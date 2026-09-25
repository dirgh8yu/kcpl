import '../api/kcpl_api.dart' show ApiException;
import '../api/models.dart' show Attachment, SendProgress;
import 'ops_api.dart';
import 'ops_models.dart';

/// Invented operations data for `KCPL_DEMO=true` builds of the staff app.
class DemoOpsApi implements OpsApi {
  DemoOpsApi({DateTime? now}) : _now = now ?? DateTime.now();
  final DateTime _now;

  final Map<String, bool> _tasks = {};
  final Map<String, bool> _customs = {};
  final Set<String> _read = {};

  String _day(int d) => _now.add(Duration(days: d)).toIso8601String().substring(0, 10);
  String _at(int hoursAgo) => _now.subtract(Duration(hours: hoursAgo)).toUtc().toIso8601String();
  String _in(int hours) => _now.add(Duration(hours: hours)).toUtc().toIso8601String();
  Future<T> _later<T>(T v) => Future<T>.delayed(const Duration(milliseconds: 250), () => v);

  static const _me = 'anil@kcpl.example';

  OpsSession get _session => OpsSession(
    displayName: 'Anil Karki',
    email: _me,
    role: management ? 'management' : 'operations',
    roleLabel: management ? 'Management' : 'Operations',
    branches: ['Birgunj', 'Kathmandu'],
    canAccessAllBranches: false,
    canViewCosts: false,
  );

  List<OpsJob> get _jobs => [
    OpsJob(
      reference: 'KCPL-2609-0142',
      customerName: 'Annapurna Home Goods',
      origin: 'Haldia, India',
      destination: 'Biratnagar, Nepal',
      mode: 'sea',
      status: 'exception',
      primaryBranch: 'Birgunj',
      ownerName: 'Anil Karki',
      ownerEmail: _me,
      ownerPhone: '+977 980-0000001',
      priority: 'urgent',
      eta: _day(-2),
      currentLocation: 'Jogbani border',
      carrier: 'CMA CGM',
      openTasks: 3,
      overdueTasks: 1,
      customsOpen: 2,
      updatedAt: _at(2),
    ),
    OpsJob(
      reference: 'KCPL-2609-0151',
      customerName: 'Machhapuchhre Pharma',
      origin: 'Kolkata, India',
      destination: 'Birgunj ICD, Nepal',
      mode: 'sea',
      status: 'customs_clearance',
      primaryBranch: 'Birgunj',
      ownerName: 'Anil Karki',
      ownerEmail: _me,
      ownerPhone: '+977 980-0000001',
      priority: 'high',
      eta: _day(1),
      currentLocation: 'Birgunj ICD',
      carrier: 'Maersk',
      openTasks: 2,
      overdueTasks: 0,
      customsOpen: 1,
      updatedAt: _at(1),
    ),
    OpsJob(
      reference: 'KCPL-2609-0163',
      customerName: 'Himal Traders',
      origin: 'Shenzhen, China',
      destination: 'Kathmandu (TIA), Nepal',
      mode: 'air',
      status: 'in_transit',
      primaryBranch: 'Kathmandu',
      ownerName: 'Sita Rai',
      ownerEmail: 'sita@kcpl.example',
      ownerPhone: '+977 980-0000002',
      priority: 'standard',
      eta: _day(2),
      currentLocation: 'Kunming',
      carrier: 'China Southern',
      openTasks: 1,
      overdueTasks: 0,
      customsOpen: 0,
      updatedAt: _at(5),
    ),
    OpsJob(
      reference: 'KCPL-2609-0170',
      customerName: 'Everest Build Co.',
      origin: 'New Delhi, India',
      destination: 'Kathmandu, Nepal',
      mode: 'road',
      status: 'out_for_delivery',
      primaryBranch: 'Kathmandu',
      ownerName: 'Sita Rai',
      ownerEmail: 'sita@kcpl.example',
      ownerPhone: '+977 980-0000002',
      priority: 'standard',
      eta: _day(0),
      currentLocation: 'Kalanki',
      carrier: 'KCPL fleet',
      openTasks: 1,
      overdueTasks: 0,
      customsOpen: 0,
      updatedAt: _at(1),
    ),
    OpsJob(
      reference: 'KCPL-2609-0177',
      customerName: 'Lumbini Textiles',
      origin: 'Guangzhou, China',
      destination: 'Birgunj, Nepal',
      mode: 'multimodal',
      status: 'booking_confirmed',
      primaryBranch: 'Birgunj',
      priority: 'standard',
      eta: _day(12),
      carrier: null,
      openTasks: 4,
      overdueTasks: 0,
      customsOpen: 3,
      updatedAt: _at(20),
    ),
  ];

  @override
  Future<OpsSession> session() => _later(_session);

  @override
  Future<TodayBundle> today() => _later(
    TodayBundle(
      session: _session,
      generatedAt: _at(0),
      totals: const OpsTotals(active: 5, urgent: 1, overdueTasks: 1, customsBlockers: 3, deliveriesToday: 1, unassigned: 1, exceptions: 1),
      jobs: _jobs,
      branches: const [
        BranchLoad(branch: 'Birgunj', active: 3, urgent: 1, customsBlockers: 3, deliveriesToday: 0),
        BranchLoad(branch: 'Kathmandu', active: 2, urgent: 0, customsBlockers: 0, deliveriesToday: 1),
      ],
    ),
  );

  @override
  Future<JobFile> job(String reference) async {
    final listed = _jobs.firstWhere((j) => j.reference == reference, orElse: () => _jobs.first);
    final owner = owners[reference];
    final job = owner == null ? listed : listed.withOwner(owner.name, owner.email, owner.phone);
    bool t(String id, bool fallback) => _tasks['$reference/$id'] ?? fallback;
    bool c(String id, bool fallback) => _customs['$reference/$id'] ?? fallback;
    return _later(
      JobFile(
        job: job,
        carrierReference: job.mode == 'air' ? '784-55120934' : 'CMDU 7719230',
        handlingBranches: [job.primaryBranch],
        ownerTitle: 'Operations executive',
        internalReference: 'BRG/26/0917',
        internalNotes: job.exception
            ? 'Border held the truck: packing list weights differ from the invoice. Corrected list requested from the shipper.'
            : null,
        tasks: [
          JobTask(
            id: 't1',
            title: 'Collect corrected packing list',
            branch: job.primaryBranch,
            dueAt: _in(-5),
            assignee: 'Anil Karki',
            completed: t('t1', false),
          ),
          JobTask(
            id: 't2',
            title: 'Call customer with revised ETA',
            branch: job.primaryBranch,
            dueAt: _in(4),
            assignee: 'Anil Karki',
            completed: t('t2', false),
          ),
          JobTask(
            id: 't3',
            title: 'Book onward truck to destination',
            branch: job.primaryBranch,
            dueAt: _in(28),
            completed: t('t3', false),
          ),
          JobTask(id: 't4', title: 'Share bill of lading copy', branch: job.primaryBranch, completed: t('t4', true)),
          ...?addedTasks[reference],
        ],
        customs: [
          CustomsStep(id: 'c1', title: 'Import declaration lodged', branch: job.primaryBranch, required: true, completed: c('c1', true)),
          CustomsStep(id: 'c2', title: 'Duty assessment paid', branch: job.primaryBranch, required: true, completed: c('c2', false)),
          CustomsStep(id: 'c3', title: 'Physical examination', branch: job.primaryBranch, required: false, completed: c('c3', false)),
        ],
        canViewCosts: false,
        costTotals: const {},
        revenueTotals: const {},
        profitTotals: const {},
        marginPercent: const {},
        blockers: const ['Required customs steps are still open.', 'Proof of delivery has not been recorded.'],
        closeBlockers: _closed.contains(reference) ? const [] : _closeBlockers(reference),
        jobClosed: _closed.contains(reference),
        fieldNotes: [
          ...?notes[reference],
          if (job.exception)
            FieldNote(
              id: 'n1',
              text: 'Truck parked at the Jogbani yard. Seal intact, driver waiting for the corrected list.',
              author: 'Suresh Yadav',
              createdAt: _at(5),
              photoFilename: 'jogbani-yard.jpg',
            ),
        ],
      ),
    );
  }

  /// Notes added in this session, newest first.
  final notes = <String, List<FieldNote>>{};

  /// How the last photo was filed.
  String? lastDocumentType;

  @override
  Future<FieldNote> addNote(
    String reference, {
    String text = '',
    Attachment? photo,
    String documentType = 'other',
    SendProgress? onProgress,
  }) async {
    _reachable();
    for (var step = 0; step <= 10; step++) {
      onProgress?.call(step / 10);
      await Future<void>.delayed(const Duration(milliseconds: 40));
    }
    final note = FieldNote(
      id: 'note-${DateTime.now().microsecondsSinceEpoch}',
      text: text.trim(),
      author: _session.displayName,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      photoFilename: photo?.filename,
    );
    (notes[reference] ??= []).insert(0, note);
    if (photo != null) lastDocumentType = documentType;
    return note;
  }

  @override
  Future<List<ScanMatch>> lookup(String query) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    String key(String? value) => (value ?? '').toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');
    final wanted = key(query);
    if (wanted.length < 4) throw const ApiException(400, 'invalid', 'That is too short to look up.');
    return [
      for (final job in _jobs)
        if (key(job.reference).contains(wanted) || key(job.mode == 'air' ? '784-55120934' : 'CMDU 7719230') == wanted)
          ScanMatch(
            reference: job.reference,
            origin: job.origin,
            destination: job.destination,
            status: job.status,
            carrierReference: job.mode == 'air' ? '784-55120934' : 'CMDU 7719230',
          ),
    ];
  }

  @override
  Future<void> setTask(String reference, String taskId, bool completed) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    _tasks['$reference/$taskId'] = completed;
  }

  @override
  Future<void> setCustomsStep(String reference, String stepId, bool completed) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    _customs['$reference/$stepId'] = completed;
  }

  @override
  Future<AlertsPage> alerts() {
    final alerts = [
      OpsAlert(
        id: 'a1',
        category: 'shipments',
        severity: 'critical',
        title: 'KCPL-2609-0142 held at Jogbani border',
        detail: 'Exception raised: packing list weights differ from the invoice.',
        actionPath: '/admin/jobs/KCPL-2609-0142',
        branch: 'Birgunj',
        createdAt: _at(2),
        resolved: false,
      ),
      OpsAlert(
        id: 'a2',
        category: 'tasks',
        severity: 'warning',
        title: 'Task overdue: Collect corrected packing list',
        detail: 'Due 5 hours ago on KCPL-2609-0142.',
        actionPath: '/admin/jobs/KCPL-2609-0142',
        branch: 'Birgunj',
        createdAt: _at(5),
        resolved: false,
      ),
      OpsAlert(
        id: 'a3',
        category: 'customs',
        severity: 'info',
        title: 'KCPL-2609-0151 arrived at Birgunj ICD',
        detail: 'Customs clearance can begin.',
        actionPath: '/admin/jobs/KCPL-2609-0151',
        branch: 'Birgunj',
        createdAt: _at(9),
        resolved: false,
      ),
      OpsAlert(
        id: 'a4',
        category: 'assignments',
        severity: 'info',
        title: 'You were assigned KCPL-2609-0151',
        detail: 'Assigned by Management.',
        actionPath: '/admin/jobs/KCPL-2609-0151',
        branch: 'Birgunj',
        createdAt: _at(30),
        resolved: false,
        readAt: _at(29),
      ),
    ].map((a) => _read.contains(a.id) ? a.markedRead(_at(0)) : a).toList();
    return _later(AlertsPage(alerts: alerts, unreadCount: alerts.where((a) => a.unread).length));
  }

  @override
  Future<void> markRead(String alertId) async => _read.add(alertId);

  @override
  Future<void> registerPush(String token, String platform) async {}

  @override
  Future<void> unregisterPush(String token) async {}

  // Field conditions, for the demo and tests.

  /// While true, nothing reaches "KCPL": sends fail as they would with no signal.
  bool offline = false;

  void _reachable() {
    if (offline) throw const ApiException(0, 'network', 'KCPL could not be reached.');
  }

  // Delivery Control.

  final Map<String, List<DeliveryAttempt>> _attempts = {};
  final Map<String, List<PodEvidence>> _evidence = {};

  /// The last delivered outcome recorded, with where it was recorded.
  ({String status, String recipient, double? latitude, double? longitude})? lastOutcome;

  /// When the last outcome said it happened.
  DateTime? lastOutcomeAt;

  @override
  Future<DeliveryControl> delivery(String reference) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _reachable();
    final attempts = _attempts[reference] ?? const [];
    final evidence = _evidence[reference] ?? const [];
    final delivered = attempts.any((a) => a.status == 'delivered');
    return DeliveryControl(
      attempts: [...attempts.reversed],
      evidence: evidence,
      shipmentStatus: delivered ? 'out_for_delivery' : _jobs.firstWhere((j) => j.reference == reference, orElse: () => _jobs.first).status,
      podStatus: evidence.isEmpty ? 'not_received' : 'received',
    );
  }

  @override
  Future<DeliveryAttempt> startDelivery(String reference, {String driverName = '', String vehicle = '', DateTime? at}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    _reachable();
    final list = _attempts[reference] ??= [];
    final attempt = DeliveryAttempt(
      id: 'attempt-${list.length + 1}',
      number: list.length + 1,
      status: 'out_for_delivery',
      scheduledFor: _at(0),
      eventTime: _at(0),
      driverName: driverName.isEmpty ? null : driverName,
    );
    list.add(attempt);
    return attempt;
  }

  @override
  Future<DeliveryOutcome> recordDelivery(
    String reference,
    String attemptId, {
    required String status,
    String recipientName = '',
    String recipientRelation = '',
    String recipientPhone = '',
    String failureReason = '',
    double? latitude,
    double? longitude,
    String notes = '',
    DateTime? at,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    _reachable();
    final list = _attempts[reference] ?? [];
    final index = list.indexWhere((a) => a.id == attemptId);
    if (index < 0) throw const ApiException(404, 'missing', 'Delivery attempt not found.');
    if (status == 'delivered' && recipientName.trim().length < 2) {
      throw const ApiException(400, 'invalid', 'Delivered attempts require a recipient name.');
    }
    if (status != 'delivered' && failureReason.trim().length < 6) {
      throw const ApiException(400, 'invalid', 'Failed or refused attempts require a reason of at least 6 characters.');
    }
    final old = list[index];
    final attempt = DeliveryAttempt(
      id: old.id,
      number: old.number,
      status: status,
      scheduledFor: old.scheduledFor,
      eventTime: _at(0),
      recipientName: recipientName.isEmpty ? null : recipientName,
      recipientRelation: recipientRelation.isEmpty ? null : recipientRelation,
      failureReason: failureReason.isEmpty ? null : failureReason,
      driverName: old.driverName,
    );
    list[index] = attempt;
    lastOutcome = (status: status, recipient: recipientName, latitude: latitude, longitude: longitude);
    lastOutcomeAt = at;
    return DeliveryOutcome(attempt: attempt, blockers: status == 'delivered' ? const ['POD has not been verified.'] : const []);
  }

  /// Every POD file sent, by kind, with its type as declared.
  final List<({String kind, String contentType, int bytes})> podSent = [];

  @override
  Future<PodEvidence> addPodEvidence(
    String reference,
    String attemptId,
    String kind,
    Attachment file, {
    DateTime? capturedAt,
    SendProgress? onProgress,
  }) async {
    for (var step = 0; step <= 5; step++) {
      onProgress?.call(step / 5);
      await Future<void>.delayed(const Duration(milliseconds: 30));
    }
    _reachable();
    podSent.add((kind: kind, contentType: file.contentType, bytes: file.bytes.length));
    final evidence = PodEvidence(
      id: 'pod-${podSent.length}',
      attemptId: attemptId,
      kind: kind,
      filename: file.filename,
      reviewStatus: 'received',
    );
    (_evidence[reference] ??= []).add(evidence);
    return evidence;
  }

  // Job actions.

  static const _staff = [
    StaffOption(uid: 'u-anil', name: 'Anil Karki', email: _me, phone: '+977 980-0000001', jobTitle: 'Operations executive', branches: ['Birgunj', 'Kathmandu']),
    StaffOption(uid: 'u-sita', name: 'Sita Shrestha', email: 'sita@kcpl.example', phone: '+977 980-0000002', jobTitle: 'Customs lead', branches: ['Birgunj']),
    StaffOption(uid: 'u-suresh', name: 'Suresh Yadav', email: 'suresh@kcpl.example', phone: '+977 980-0000003', jobTitle: 'Field officer', branches: ['Birgunj']),
    StaffOption(uid: 'u-maya', name: 'Maya Gurung', email: 'maya@kcpl.example', jobTitle: 'Operations executive', branches: ['Kathmandu']),
  ];

  final Map<String, ({String name, String email, String? phone})> owners = {};
  final Map<String, List<JobTask>> addedTasks = {};
  final Set<String> _closed = {};

  /// Set to let the demo sign-in act as Management.
  bool management = false;

  List<String> _closeBlockers(String reference) {
    final evidence = _evidence[reference] ?? const [];
    return [
      if (!(_customs['$reference/c2'] ?? false)) 'Required customs steps are still open.',
      if (evidence.isEmpty) 'Proof of delivery has not been recorded.',
    ];
  }

  @override
  Future<List<StaffOption>> staff() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _reachable();
    return _staff;
  }

  @override
  Future<void> addTask(String reference, {required String title, required String branch, String dueAt = '', String detail = '', StaffOption? assignee}) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    _reachable();
    if (title.trim().isEmpty) throw const ApiException(400, 'invalid', 'Add a task title.');
    final list = addedTasks[reference] ??= [];
    list.add(
      JobTask(
        id: 'added-${list.length + 1}',
        title: title.trim(),
        detail: detail.isEmpty ? null : detail,
        branch: branch,
        dueAt: dueAt.isEmpty ? null : DateTime.parse('$dueAt:00+05:45').toUtc().toIso8601String(),
        assignee: assignee?.name,
        completed: false,
      ),
    );
  }

  @override
  Future<void> reassign(String reference, StaffOption owner) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    _reachable();
    owners[reference] = (name: owner.name, email: owner.email, phone: owner.phone);
  }

  @override
  Future<void> closeJob(String reference, {String overrideReason = ''}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    _reachable();
    final blockers = _closeBlockers(reference);
    if (blockers.isNotEmpty && !(management && overrideReason.trim().length >= 8)) {
      throw CloseoutBlocked(blockers, canOverride: management);
    }
    _closed.add(reference);
  }

  // Driver mode.

  @override
  Future<DriverDay> deliveries() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _reachable();
    DriverDelivery stop(String reference, String customer, String address, {required bool mine, int hour = 11}) {
      final attempt = (_attempts[reference] ?? const <DeliveryAttempt>[]).where((a) => a.open).lastOrNull;
      final job = _jobs.firstWhere((j) => j.reference == reference, orElse: () => _jobs.first);
      return DriverDelivery(
        reference: reference,
        customerName: customer,
        destination: job.destination,
        address: address,
        status: job.status,
        attemptId: attempt?.id,
        attemptStatus: attempt?.status,
        attemptNumber: attempt?.number ?? 0,
        scheduledFor: DateTime(_now.year, _now.month, _now.day, hour).toUtc().toIso8601String(),
        driverName: attempt?.driverName,
        mine: mine,
      );
    }

    return DriverDay(
      day: _day(0),
      deliveries: [
        stop('KCPL-2609-0170', 'Everest Build Co.', 'Teku Road 14, Kathmandu', mine: true, hour: 10),
        stop('KCPL-2609-0142', 'Annapurna Home Goods', 'Main Road, Biratnagar', mine: true, hour: 13),
        stop('KCPL-2609-0151', 'Machhapuchhre Pharma', 'Birgunj ICD Gate 2', mine: false, hour: 15),
      ],
    );
  }

  @override
  Future<void> forget() async {}
}
