import 'dart:convert';

import '../api/kcpl_api.dart';
import '../api/models.dart';
import '../auth/auth_repository.dart';

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
            rows: [Requirement(documentType: 'packing_list', required: true, state: 'resend')],
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
        documents: _documents.where((d) => d.shipmentReference == reference).toList(),
        checklist: const [
          Requirement(documentType: 'commercial_invoice', required: true, state: 'confirmed'),
          Requirement(documentType: 'packing_list', required: true, state: 'with_kcpl'),
          Requirement(documentType: 'import_permit', required: true, state: 'needed'),
        ],
      ),
    );
  }

  @override
  Future<DocumentsPage> documents() => _later(DocumentsPage(documents: _documents, scanned: 5, total: 5));

  @override
  Future<InvoicesPage> invoices() => _later(InvoicesPage(invoices: _invoices, summary: _summary));

  @override
  Future<Invoice> invoice(String reference) async {
    final invoice = _invoices.where((i) => i.reference == reference).firstOrNull;
    if (invoice == null) throw const ApiException(404, 'missing', 'Invoice not found.');
    return _later(invoice);
  }

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
