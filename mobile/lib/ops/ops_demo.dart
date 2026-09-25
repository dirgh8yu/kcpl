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

  OpsSession get _session => const OpsSession(
    displayName: 'Anil Karki',
    email: _me,
    role: 'operations',
    roleLabel: 'Operations',
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
    final job = _jobs.firstWhere((j) => j.reference == reference, orElse: () => _jobs.first);
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
}
