import 'dart:convert';

import '../api/kcpl_api.dart';
import '../api/models.dart';
import '../auth/auth_repository.dart';
import 'demo_images.dart';

/// Invented sample data for `--dart-define=KCPL_DEMO=true` builds: store
/// screenshots and design review with no KCPL account and no network. The
/// company names are made up and labelled as demo on screen.
class DemoAuth implements AuthRepository {
  bool _signedIn = false;

  @override
  Future<bool> restore() async => _signedIn;

  @override
  Future<void> signIn(String email, String password) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    _signedIn = true;
  }

  @override
  Future<void> signInWithIdp(IdpCredential credential) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    _signedIn = true;
  }

  @override
  Future<void> link(IdpCredential credential) async {}

  @override
  Future<void> sendPasswordReset(String email) async {}

  @override
  Future<String> idToken({bool forceRefresh = false}) async {
    if (!_signedIn) throw const SignedOutException();
    return 'demo';
  }

  @override
  Future<void> signOut() async => _signedIn = false;
}

class DemoApi extends KcplApi {
  DemoApi({DateTime? now}) : _now = now ?? DateTime.now();
  final DateTime _now;

  static const _customers = [
    CustomerScope(id: 'DEMO-ANNAPURNA', name: 'Annapurna Home Goods (demo)'),
    CustomerScope(id: 'DEMO-MACHHAPUCHHRE', name: 'Machhapuchhre Pharma (demo)'),
  ];

  String _day(int offset) => _now.add(Duration(days: offset)).toIso8601String().substring(0, 10);
  String _at(int hoursAgo) => _now.subtract(Duration(hours: hoursAgo)).toUtc().toIso8601String();

  CustomerScope get _active => _customers.firstWhere((c) => c.id == customerId, orElse: () => _customers.first);

  Future<T> _later<T>(T value) => Future<T>.delayed(const Duration(milliseconds: 250), () => value);

  @override
  Future<SessionView> session() => _later(
    SessionView(
      email: 'imports@annapurna.example',
      displayName: 'Sunita Shrestha',
      customerId: _active.id,
      customerName: _active.name,
      customers: _customers,
      role: 'owner',
      canViewFinance: true,
      locale: 'en',
      canSubmitRequests: true,
    ),
  );

  List<Shipment> get _shipments => [
    Shipment(
      reference: 'KCPL-S-24091',
      status: 'customs_clearance',
      mode: 'sea',
      origin: 'Kolkata, India',
      destination: 'Birgunj ICD, Nepal',
      eta: _day(3),
      currentLocation: 'Birgunj ICD',
      carrier: 'Maersk',
      carrierReference: 'MAEU 241877301',
      createdAt: _at(24 * 26),
      updatedAt: _at(3),
    ),
    Shipment(
      reference: 'KCPL-S-24103',
      status: 'in_transit',
      mode: 'air',
      origin: 'Shenzhen, China',
      destination: 'Kathmandu (TIA), Nepal',
      eta: _day(1),
      currentLocation: 'Kunming transit hub',
      carrier: 'China Southern Cargo',
      carrierReference: '784-55120934',
      createdAt: _at(24 * 5),
      updatedAt: _at(6),
    ),
    Shipment(
      reference: 'KCPL-S-24110',
      status: 'booking_confirmed',
      mode: 'road',
      origin: 'New Delhi, India',
      destination: 'Kathmandu, Nepal',
      eta: _day(9),
      carrier: 'KCPL road network',
      createdAt: _at(30),
      updatedAt: _at(30),
    ),
    Shipment(
      reference: 'KCPL-S-24077',
      status: 'exception',
      mode: 'sea',
      origin: 'Haldia, India',
      destination: 'Biratnagar, Nepal',
      eta: _day(-2),
      currentLocation: 'Jogbani border',
      carrier: 'CMA CGM',
      carrierReference: 'CMDU 7719230',
      customerNote: 'Held at the border pending a corrected packing list.',
      createdAt: _at(24 * 34),
      updatedAt: _at(20),
    ),
    Shipment(
      reference: 'KCPL-S-24012',
      status: 'delivered',
      mode: 'air',
      origin: 'Dubai, UAE',
      destination: 'Kathmandu (TIA), Nepal',
      eta: _day(-12),
      carrier: 'flydubai Cargo',
      carrierReference: '141-22091544',
      createdAt: _at(24 * 20),
      updatedAt: _at(24 * 12),
    ),
  ];

  List<DocumentRow> get _documents => [
    DocumentRow(
      id: '3',
      shipmentReference: 'KCPL-S-24091',
      filename: 'BL-MAEU241877301.pdf',
      contentType: 'application/pdf',
      sizeBytes: 284211,
      documentType: 'bill_of_lading',
      uploadedAt: _at(50),
      fromCustomer: false,
      reviewState: 'released',
    ),
    DocumentRow(
      id: '2',
      shipmentReference: 'KCPL-S-24103',
      filename: 'AWB-784-55120934.pdf',
      contentType: 'application/pdf',
      sizeBytes: 118930,
      documentType: 'air_waybill',
      uploadedAt: _at(70),
      fromCustomer: false,
      reviewState: 'released',
    ),
    DocumentRow(
      id: '5',
      shipmentReference: 'KCPL-S-24091',
      filename: 'commercial-invoice-AHG-0921.pdf',
      contentType: 'application/pdf',
      sizeBytes: 90112,
      documentType: 'commercial_invoice',
      uploadedAt: _at(24 * 6),
      fromCustomer: true,
      reviewState: 'confirmed',
    ),
    DocumentRow(
      id: '4',
      shipmentReference: 'KCPL-S-24077',
      filename: 'packing-list-rev1.pdf',
      contentType: 'application/pdf',
      sizeBytes: 64300,
      documentType: 'packing_list',
      uploadedAt: _at(24 * 3),
      fromCustomer: true,
      reviewState: 'resend',
    ),
    DocumentRow(
      id: '1',
      shipmentReference: 'KCPL-S-24012',
      filename: 'POD-24012-signed.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 402554,
      documentType: 'proof_of_delivery',
      uploadedAt: _at(24 * 12),
      fromCustomer: false,
      reviewState: 'released',
    ),
  ];

  List<Invoice> get _invoices => [
    Invoice(
      reference: 'KCPL-I-20260918-011',
      recordType: 'invoice',
      status: 'issued',
      issueDate: _day(-6),
      dueDate: _day(24),
      currency: 'NPR',
      subtotal: 186000,
      taxTotal: 24180,
      total: 210180,
      amountPaid: 0,
      balanceDue: 210180,
      shipmentReference: 'KCPL-S-24091',
      lines: const [
        InvoiceLine(id: '1', description: 'Ocean freight Kolkata to Birgunj ICD, 1 x 20ft', quantity: 1, unitPrice: 142000, total: 142000),
        InvoiceLine(id: '2', description: 'Customs clearance and documentation', quantity: 1, unitPrice: 28000, total: 28000),
        InvoiceLine(id: '3', description: 'ICD handling', quantity: 1, unitPrice: 16000, total: 16000),
      ],
    ),
    Invoice(
      reference: 'KCPL-I-20260821-004',
      recordType: 'invoice',
      status: 'overdue',
      issueDate: _day(-34),
      dueDate: _day(-4),
      currency: 'USD',
      subtotal: 1840,
      taxTotal: 0,
      total: 1840,
      amountPaid: 800,
      balanceDue: 1040,
      shipmentReference: 'KCPL-S-24077',
      lines: const [InvoiceLine(id: '1', description: 'Sea freight Haldia to Biratnagar', quantity: 1, unitPrice: 1840, total: 1840)],
    ),
    Invoice(
      reference: 'KCPL-I-20260809-002',
      recordType: 'invoice',
      status: 'paid',
      issueDate: _day(-46),
      dueDate: _day(-16),
      currency: 'NPR',
      subtotal: 96500,
      taxTotal: 12545,
      total: 109045,
      amountPaid: 109045,
      balanceDue: 0,
      shipmentReference: 'KCPL-S-24012',
      lines: const [],
    ),
  ];

  FinanceSummary get _summary => const FinanceSummary(
    balances: [
      CurrencyBalance(currency: 'NPR', invoiced: 319225, paid: 109045, outstanding: 210180, overdue: 0),
      CurrencyBalance(currency: 'USD', invoiced: 1840, paid: 800, outstanding: 1040, overdue: 1040),
    ],
    openInvoices: 2,
    overdueInvoices: 1,
  );

  @override
  Future<OverviewBundle> overview() async {
    final shipments = _shipments;
    final active = shipments.where((s) => !s.delivered).toList();
    return OverviewBundle(
      await session(),
      Overview(
        shipments: active,
        activeCount: active.length,
        inTransitCount: shipments.where((s) => s.status == 'in_transit').length,
        arrivingCount: 2,
        attentionCount: shipments.where((s) => s.status == 'exception').length,
        deliveredCount: shipments.where((s) => s.delivered).length,
        documents: _documents.where((d) => !d.fromCustomer).take(3).toList(),
        outstanding: const [
          OutstandingDocuments(
            reference: 'KCPL-S-24077',
            origin: 'Haldia, India',
            destination: 'Biratnagar, Nepal',
            rows: [Requirement(documentType: 'packing_list', required: true, state: 'resend', uploadable: true)],
          ),
        ],
        outstandingCount: 1,
        freeTime: [
          FreeTimeRow(
            reference: 'KCPL-S-24091',
            origin: 'Kolkata, India',
            destination: 'Birgunj ICD, Nepal',
            location: 'Birgunj ICD',
            status: FreeTimeStatus(state: 'running', deadline: _day(2), daysRemaining: 3, daysOverdue: 0),
          ),
        ],
        finance: _summary,
      ),
    );
  }

  @override
  Future<List<Shipment>> shipments() => _later(_shipments);

  @override
  Future<ShipmentDetail> shipment(String reference) async {
    final shipment = _shipments.where((s) => s.reference == reference).firstOrNull;
    if (shipment == null) throw const ApiException(404, 'missing', 'Shipment not found.');
    return _later(
      ShipmentDetail(
        shipment: shipment,
        freeTime: reference == 'KCPL-S-24091'
            ? FreeTime(
                location: 'Birgunj ICD',
                days: 7,
                dailyCharge: 45,
                chargeCurrency: 'USD',
                status: FreeTimeStatus(state: 'running', deadline: _day(2), daysRemaining: 3, daysOverdue: 0),
              )
            : null,
        events: [
          ShipmentEvent(id: 'e4', title: 'Customs declaration lodged', location: shipment.currentLocation, eventTime: _at(3)),
          ShipmentEvent(id: 'e3', title: 'Arrived at destination depot', location: shipment.currentLocation, eventTime: _at(28)),
          ShipmentEvent(id: 'e2', title: 'Departed origin', location: shipment.origin, details: 'Loaded on board.', eventTime: _at(24 * 9)),
          ShipmentEvent(id: 'e1', title: 'Booking confirmed', location: shipment.origin, eventTime: _at(24 * 12)),
        ],
        documents: [
          ...sentDocuments.where((d) => d.shipmentReference == reference),
          ..._documents.where((d) => d.shipmentReference == reference),
        ],
        checklist: [
          for (final row in _checklist(reference))
            sentDocuments.any((d) => d.shipmentReference == reference && d.documentType == row.documentType)
                ? Requirement(documentType: row.documentType, required: row.required, state: 'with_kcpl', uploadable: row.uploadable)
                : row,
        ],
        confirmation: confirmations[reference],
        canConfirmDelivery: shipment.status == 'delivered' || shipment.status == 'out_for_delivery',
        canRate: shipment.status == 'delivered' && !ratings.containsKey(reference),
        rating: ratings[reference],
        proofOfDelivery: shipment.status == 'delivered'
            ? ProofOfDelivery(
                deliveredAt: _at(24 * 12 - 2),
                recipientName: 'Bikash Tamang',
                recipientRelation: 'Warehouse supervisor',
                verifiedAt: _at(24 * 11),
                items: [
                  ProofItem(id: 'sig', kind: 'signature', contentType: 'image/png', capturedAt: _at(24 * 12 - 2)),
                  ProofItem(id: 'photo-1', kind: 'photo', contentType: 'image/png', capturedAt: _at(24 * 12 - 2)),
                ],
              )
            : null,
      ),
    );
  }

  List<Requirement> _checklist(String reference) => switch (reference) {
    'KCPL-S-24077' => const [
      Requirement(documentType: 'commercial_invoice', required: true, state: 'confirmed', uploadable: true),
      Requirement(documentType: 'packing_list', required: true, state: 'resend', uploadable: true),
      Requirement(documentType: 'bill_of_lading', required: true, state: 'confirmed'),
    ],
    'KCPL-S-24012' => const [Requirement(documentType: 'commercial_invoice', required: true, state: 'confirmed', uploadable: true)],
    _ => const [
      Requirement(documentType: 'commercial_invoice', required: true, state: 'confirmed', uploadable: true),
      Requirement(documentType: 'packing_list', required: true, state: 'with_kcpl', uploadable: true),
      Requirement(documentType: 'import_permit', required: true, state: 'needed', uploadable: true),
    ],
  };

  /// Everything sent from the app in this session, newest first.
  final sentDocuments = <DocumentRow>[];
  final confirmations = <String, DeliveryConfirmation>{};
  final sentRemittances = <String, List<Remittance>>{};

  /// Reports progress in steps, as a real upload on a phone signal would.
  Future<void> _transfer(SendProgress? onProgress) async {
    for (var step = 0; step <= 10; step++) {
      onProgress?.call(step / 10);
      await Future<void>.delayed(const Duration(milliseconds: 60));
    }
  }

  @override
  Future<SendReceipt> sendDocument(String reference, String documentType, Attachment file, {SendProgress? onProgress}) async {
    await _transfer(onProgress);
    sentDocuments.insert(
      0,
      DocumentRow(
        id: 'sent-${sentDocuments.length + 1}',
        shipmentReference: reference,
        filename: file.filename,
        contentType: file.contentType,
        sizeBytes: file.bytes.length,
        documentType: documentType,
        uploadedAt: DateTime.now().toUtc().toIso8601String(),
        fromCustomer: true,
        reviewState: 'with_kcpl',
      ),
    );
    return const SendReceipt(message: 'Sent to KCPL. It will show as confirmed once the team has checked it.');
  }

  @override
  Future<SendReceipt> confirmDelivery(String reference, {String receivedBy = '', String note = ''}) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (confirmations.containsKey(reference)) {
      return const SendReceipt(message: 'You have already confirmed receipt of this shipment.', duplicate: true);
    }
    confirmations[reference] = DeliveryConfirmation(
      confirmedAt: DateTime.now().toUtc().toIso8601String(),
      receivedBy: receivedBy.trim().isEmpty ? null : receivedBy.trim(),
    );
    return const SendReceipt(message: 'Thank you. KCPL has been told the cargo arrived.');
  }

  @override
  Future<List<Remittance>> remittances(String invoice) => _later([
    ...?sentRemittances[invoice],
    if (invoice == 'KCPL-I-20260821-004')
      Remittance(
        id: 'r1',
        filename: 'nabil-advice-0821.pdf',
        amount: 800,
        currency: 'USD',
        paidOn: _day(-20),
        uploadedAt: _at(24 * 20),
        acknowledged: true,
      ),
  ]);

  @override
  Future<SendReceipt> sendRemittance(String invoice, RemittanceDraft draft, {SendProgress? onProgress}) async {
    await _transfer(onProgress);
    (sentRemittances[invoice] ??= []).insert(
      0,
      Remittance(
        id: 'sent-${DateTime.now().microsecondsSinceEpoch}',
        filename: draft.file.filename,
        amount: draft.amount,
        currency: draft.currency,
        paidOn: draft.paidOn,
        uploadedAt: DateTime.now().toUtc().toIso8601String(),
        acknowledged: false,
      ),
    );
    return const SendReceipt(message: 'Sent to KCPL accounts. The invoice will update once the payment has been matched.');
  }

  late final _team = <TeamMember>[
    TeamMember(email: 'imports@annapurna.example', role: 'owner', active: true, bound: true, lastSignInAt: _at(1), linked: false),
    TeamMember(email: 'accounts@annapurna.example', role: 'member', active: true, bound: true, lastSignInAt: _at(26), linked: false),
    const TeamMember(email: 'store@annapurna.example', role: 'member', active: true, bound: false, linked: false),
    const TeamMember(email: 'old.clerk@annapurna.example', role: 'member', active: false, bound: true, linked: false),
    TeamMember(email: 'desk@himalaya-agents.example', role: 'member', active: true, bound: true, lastSignInAt: _at(24 * 3), linked: true),
  ];

  @override
  Future<List<TeamMember>> team() => _later(List.of(_team));

  @override
  Future<TeamInvite> invite(String email) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final address = email.trim().toLowerCase();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(address)) {
      throw const ApiException(400, 'invalid', 'Enter a valid email address.');
    }
    if (_team.any((m) => m.email == address)) throw const ApiException(400, 'invalid', 'That address already has a login.');
    _team.add(TeamMember(email: address, role: 'member', active: true, bound: false, linked: false));
    // As a server with no mail provider does: the link comes back to pass on.
    return TeamInvite(email: address, delivered: false, link: 'https://kcpl.example/portal/invite?demo=$address');
  }

  @override
  Future<void> setMemberActive(String email, bool active) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = _team.indexWhere((m) => m.email == email);
    if (index < 0) throw const ApiException(404, 'missing', 'Login not found.');
    final member = _team[index];
    _team[index] = TeamMember(
      email: member.email,
      role: member.role,
      active: active,
      bound: member.bound,
      lastSignInAt: member.lastSignInAt,
      linked: member.linked,
    );
  }

  @override
  Future<DocumentsPage> documents() => _later(DocumentsPage(documents: [...sentDocuments, ..._documents], scanned: 5, total: 5));

  @override
  Future<InvoicesPage> invoices() => _later(InvoicesPage(invoices: _invoices, summary: _summary));

  @override
  Future<Invoice> invoice(String reference) async {
    final invoice = _invoices.where((i) => i.reference == reference).firstOrNull;
    if (invoice == null) throw const ApiException(404, 'missing', 'Invoice not found.');
    return _later(invoice);
  }

  /// The requests raised, newest last.
  final quoteRequests = <QuoteRequest>[];

  @override
  Future<String> requestQuote(QuoteRequest request) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    quoteRequests.add(request);
    return 'KCPL-Q-${_now.year}${_now.month.toString().padLeft(2, '0')}${_now.day.toString().padLeft(2, '0')}-DEMO${quoteRequests.length.toString().padLeft(2, '0')}';
  }

  // Quotes.

  /// Quotes the customer asked to proceed with, by reference.
  final Map<String, String> bookingRequests = {};

  @override
  Future<QuotesPage> quotes() => _later(
    QuotesPage(
      quotes: [
        PortalQuote(
          reference: 'KCPL-Q-20260921-014',
          status: 'quoted',
          createdAt: _at(90),
          origin: 'Kolkata, India',
          destination: 'Birgunj ICD, Nepal',
          mode: 'sea',
          cargoType: 'Household goods, 1 x 20ft',
          weight: '11800 kg',
          amount: 168500,
          currency: 'NPR',
          validUntil: _day(9),
          note: 'Includes customs clearance at Birgunj and ICD handling. Detention beyond 7 free days is extra.',
          bookingRequestedAt: bookingRequests.containsKey('KCPL-Q-20260921-014') ? _at(0) : null,
        ),
        PortalQuote(
          reference: 'KCPL-Q-20260902-006',
          status: 'quoted',
          createdAt: _at(560),
          origin: 'Shenzhen, China',
          destination: 'Kathmandu (TIA), Nepal',
          mode: 'air',
          cargoType: 'Spare parts',
          weight: '240 kg',
          amount: 1320,
          currency: 'USD',
          validUntil: _day(-3),
        ),
      ],
      requests: [
        PortalQuote(
          reference: 'KCPL-Q-20260924-002',
          status: 'new',
          createdAt: _at(20),
          origin: 'Haldia, India',
          destination: 'Biratnagar, Nepal',
          mode: 'road',
          cargoType: 'Ceramic tiles',
          currency: 'NPR',
        ),
      ],
    ),
  );

  @override
  Future<void> acceptQuote(String reference, {String note = '', PickupRequest? pickup}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    bookingRequests[reference] = note;
    if (pickup != null) pickups[reference] = pickup;
  }

  final Map<String, PickupRequest> pickups = {};

  // Proof of delivery, the statement, and text notices.

  @override
  Future<DownloadedFile> proofFile(String shipment, ProofItem item) => _later(
    DownloadedFile(
      filename: '$shipment-${item.kind}.png',
      contentType: 'image/png',
      bytes: item.kind == 'signature' ? DemoImages.signature : DemoImages.parcel,
    ),
  );

  @override
  Future<DownloadedFile> statement() => _later(
    DownloadedFile(filename: 'KCPL-statement-demo.pdf', contentType: 'application/pdf', bytes: _demoPdf('KCPL demo build: statement of account')),
  );

  TextNotices text = const TextNotices(offered: ['sms', 'whatsapp']);

  @override
  Future<TextNotices> textNotices() => _later(text);

  @override
  Future<TextNotices> setTextNotices(String channel, {String phone = '', bool consent = false}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (channel != 'none' && !consent) throw const ApiException(400, 'invalid', 'Tick the box to agree to receive these messages.');
    final digits = phone.replaceAll(RegExp(r'[\s().-]'), '');
    final local = RegExp(r'^(?:\+?977)?(9[678]\d{8})$').firstMatch(digits);
    if (channel != 'none' && local == null && !(channel == 'whatsapp' && RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(digits))) {
      throw const ApiException(400, 'invalid', 'Enter a mobile number such as 98XXXXXXXX.');
    }
    return text = TextNotices(
      channel: channel,
      phone: channel == 'none' ? null : (local == null ? digits : '+977${local.group(1)}'),
      offered: text.offered,
    );
  }

  // Notification settings.

  NotificationPreferences preferences = const NotificationPreferences(shipmentUpdates: true, documents: true, freeTime: true);

  @override
  Future<NotificationPreferences> notificationPreferences() => _later(preferences);

  @override
  Future<NotificationPreferences> setNotificationPreferences(NotificationPreferences preferences) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return this.preferences = preferences;
  }

  // Paying online.

  final Map<String, PaymentStatus> payments = {};

  /// What the next payment will come back as, once "the gateway" is done.
  String nextPaymentOutcome = 'paid';

  /// Rupees per unit, as NRB published them for the demo.
  static const demoRates = {'NPR': 1.0, 'USD': 133.25, 'INR': 1.6};

  @override
  Future<PaymentOptions> paymentOptions(String invoice) async {
    final found = _invoices.where((i) => i.reference == invoice).firstOrNull;
    final rate = demoRates[found?.currency];
    final payable = found != null && rate != null && found.balanceDue > 0 && !payments.values.any((p) => p.invoice == invoice && p.paid);
    return _later(
      payable
          ? PaymentOptions(
              gateways: const ['khalti', 'esewa', 'connectips'],
              currency: found.currency,
              balance: found.balanceDue,
              rate: rate,
              rateDate: found.currency == 'NPR' ? null : _day(0),
            )
          : PaymentOptions.none,
    );
  }

  @override
  Future<PaymentStart> startPayment(String invoice, String gateway, {double? amount}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final found = _invoices.firstWhere((i) => i.reference == invoice);
    final paying = amount ?? found.balanceDue;
    if (paying <= 0 || paying > found.balanceDue) throw const ApiException(400, 'invalid', 'That is more than is owed on this invoice.');
    final id = (payments.length + 1).toRadixString(16).padLeft(20, '0');
    final npr = (paying * (demoRates[found.currency] ?? 1) * 100).roundToDouble() / 100;
    payments[id] = PaymentStatus(id: id, invoice: invoice, gateway: gateway, amount: npr, status: 'started');
    return PaymentStart(intent: id, url: Uri.parse('https://kcpl.example/pay/$id'));
  }

  /// Settles a started payment as [nextPaymentOutcome], as the gateway's
  /// return would.
  void completePayment(String id) {
    final started = payments[id]!;
    // Rupees against another currency are applied by accounts, as on KCPL.
    final foreign = _invoices.firstWhere((i) => i.reference == started.invoice).currency != 'NPR';
    final outcome = foreign && nextPaymentOutcome == 'paid' ? 'needs_review' : nextPaymentOutcome;
    payments[id] = PaymentStatus(
      id: id,
      invoice: started.invoice,
      gateway: started.gateway,
      amount: started.amount,
      status: outcome,
      message: outcome == 'failed'
          ? 'The payment was cancelled.'
          : outcome == 'needs_review' && foreign
          ? 'Payment received. KCPL accounts will apply it to the invoice at the rate shown.'
          : null,
    );
  }

  @override
  Future<PaymentStatus> payment(String intent) async {
    final found = payments[intent];
    if (found == null) throw const ApiException(404, 'missing', 'Payment not found.');
    return _later(found);
  }

  // Messages and ratings.

  late final Map<String, List<ShipmentMessage>> threads = {
    'KCPL-S-24091': [
      ShipmentMessage(
        id: 'm1',
        fromKcpl: false,
        author: 'You',
        body: 'Is the declaration in? We need the goods by Friday.',
        createdAt: _at(5),
      ),
      ShipmentMessage(
        id: 'm2',
        fromKcpl: true,
        author: 'KCPL · Sita',
        body: 'Lodged this morning. Inspection is booked for tomorrow; I will write as soon as it clears.',
        createdAt: _at(3),
      ),
    ],
  };

  final Map<String, DeliveryRating> ratings = {};

  @override
  Future<List<ShipmentMessage>> messages(String reference) => _later([...?threads[reference]]);

  @override
  Future<ShipmentMessage> sendMessage(String reference, String body) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final message = ShipmentMessage(
      id: 'm${DateTime.now().microsecondsSinceEpoch}',
      fromKcpl: false,
      author: 'You',
      body: body.trim(),
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );
    (threads[reference] ??= []).add(message);
    return message;
  }

  @override
  Future<RatingReceipt> rateDelivery(String reference, int score, {String comment = ''}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (ratings.containsKey(reference)) throw const ApiException(409, 'conflict', 'You have already rated this delivery.');
    ratings[reference] = DeliveryRating(score: score, createdAt: DateTime.now().toUtc().toIso8601String());
    final complaint = score <= 3;
    return RatingReceipt(
      message: complaint ? 'Thank you. The team that handled this delivery will be in touch.' : 'Thank you for telling us.',
      complaint: complaint,
      reviewUrl: complaint ? null : Uri.parse('https://g.page/r/kcpl-demo/review'),
    );
  }

  // Tracking links.

  final Map<String, int> trackingLinks = {};

  @override
  Future<TrackingLink> createTrackingLink(String reference) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    trackingLinks[reference] = (trackingLinks[reference] ?? 0) + 1;
    return TrackingLink(
      url: Uri.parse('https://kcpl.example/t/demo${reference.hashCode.abs()}'),
      expiresAt: _now.add(const Duration(days: 30)).toUtc().toIso8601String(),
    );
  }

  @override
  Future<int> revokeTrackingLinks(String reference) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    return trackingLinks.remove(reference) ?? 0;
  }

  // Live Activities.

  final Map<String, String> liveActivities = {};

  @override
  Future<void> followLive(String reference, {required String activityToken, required String pushToken}) async =>
      liveActivities[activityToken] = reference;

  @override
  Future<void> unfollowLive(String activityToken) async => liveActivities.remove(activityToken);

  @override
  Future<void> registerPush(String token, String platform) async {}

  @override
  Future<void> unregisterPush(String token) async {}

  @override
  Future<DownloadedFile> download(DocumentRow document) => _later(
    DownloadedFile(
      filename: '${document.filename}.txt',
      contentType: 'text/plain',
      bytes: utf8.encode('KCPL demo build: sample in place of ${document.filename}.\n'),
    ),
  );
}

/// A one-page PDF saying what it stands in for.
List<int> _demoPdf(String line) {
  final content = 'BT /F1 14 Tf 60 780 Td ($line) Tj ET';
  final objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ${content.length} >>\nstream\n$content\nendstream',
  ];
  final pdf = StringBuffer('%PDF-1.4\n');
  final offsets = <int>[];
  for (var i = 0; i < objects.length; i++) {
    offsets.add(pdf.length);
    pdf.write('${i + 1} 0 obj\n${objects[i]}\nendobj\n');
  }
  final xref = pdf.length;
  pdf.write('xref\n0 ${objects.length + 1}\n0000000000 65535 f \n');
  for (final offset in offsets) {
    pdf.write('${offset.toString().padLeft(10, '0')} 00000 n \n');
  }
  pdf.write('trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n');
  return latin1.encode(pdf.toString());
}
