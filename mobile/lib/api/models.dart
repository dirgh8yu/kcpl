// Mirrors of the portal's view types (app/portal/portal-access-policy.ts and
// portal-data.server.ts). Those are allowlisted projections, so everything
// here is already safe to show the customer. Parsing is lenient: a missing or
// mistyped field becomes an empty value rather than a crash, as on the web.

String _s(Object? value, [String fallback = '']) => value is String ? value : fallback;
String? _ns(Object? value) => value is String && value.trim().isNotEmpty ? value : null;
double _n(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
int _i(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;
bool _b(Object? value) => value == true;
List<Map<String, dynamic>> _list(Object? value) =>
    value is List ? value.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];
Map<String, dynamic> _map(Object? value) => value is Map ? value.cast<String, dynamic>() : const {};

class CustomerScope {
  const CustomerScope({required this.id, required this.name});
  final String id;
  final String name;

  factory CustomerScope.fromJson(Map<String, dynamic> json) => CustomerScope(id: _s(json['id']), name: _s(json['name']));
}

class SessionView {
  const SessionView({
    required this.email,
    required this.displayName,
    required this.customerId,
    required this.customerName,
    required this.customers,
    required this.role,
    required this.canViewFinance,
    required this.locale,
  });

  final String email;
  final String displayName;
  final String customerId;
  final String customerName;
  final List<CustomerScope> customers;
  final String role;
  final bool canViewFinance;
  final String locale;

  factory SessionView.fromJson(Map<String, dynamic> json) => SessionView(
    email: _s(json['email']),
    displayName: _s(json['displayName']),
    customerId: _s(json['customerId']),
    customerName: _s(json['customerName']),
    customers: _list(json['customers']).map(CustomerScope.fromJson).toList(),
    role: _s(json['role'], 'member'),
    canViewFinance: _b(_map(json['capabilities'])['canViewFinance']),
    locale: _s(json['locale'], 'en'),
  );
}

class Shipment {
  const Shipment({
    required this.reference,
    required this.status,
    required this.mode,
    required this.origin,
    required this.destination,
    this.eta,
    this.currentLocation,
    this.carrier,
    this.carrierReference,
    this.customerNote,
    required this.createdAt,
    required this.updatedAt,
  });

  final String reference;
  final String status;
  final String mode;
  final String origin;
  final String destination;
  final String? eta;
  final String? currentLocation;
  final String? carrier;
  final String? carrierReference;
  final String? customerNote;
  final String createdAt;
  final String updatedAt;

  bool get delivered => status == 'delivered';

  factory Shipment.fromJson(Map<String, dynamic> json) => Shipment(
    reference: _s(json['reference']),
    status: _s(json['status'], 'unknown'),
    mode: _s(json['mode'], 'unsure'),
    origin: _s(json['origin']),
    destination: _s(json['destination']),
    eta: _ns(json['eta']),
    currentLocation: _ns(json['current_location']),
    carrier: _ns(json['carrier']),
    carrierReference: _ns(json['carrier_reference']),
    customerNote: _ns(json['customer_note']),
    createdAt: _s(json['created_at']),
    updatedAt: _s(json['updated_at']),
  );
}

class ShipmentEvent {
  const ShipmentEvent({required this.id, required this.title, this.location, this.details, required this.eventTime});
  final String id;
  final String title;
  final String? location;
  final String? details;
  final String eventTime;

  factory ShipmentEvent.fromJson(Map<String, dynamic> json) => ShipmentEvent(
    id: _s(json['id']),
    title: _s(json['title']),
    location: _ns(json['location']),
    details: _ns(json['details']),
    eventTime: _s(json['event_time']),
  );
}

class DocumentRow {
  const DocumentRow({
    required this.id,
    required this.shipmentReference,
    required this.filename,
    required this.contentType,
    required this.sizeBytes,
    required this.documentType,
    required this.uploadedAt,
    required this.fromCustomer,
    required this.reviewState,
  });

  final String id;
  final String shipmentReference;
  final String filename;
  final String contentType;
  final int sizeBytes;
  final String documentType;
  final String uploadedAt;
  final bool fromCustomer;

  /// `released`, `with_kcpl`, `confirmed` or `resend`.
  final String reviewState;

  factory DocumentRow.fromJson(Map<String, dynamic> json) => DocumentRow(
    id: '${json['id'] ?? ''}',
    shipmentReference: _s(json['shipment_reference']),
    filename: _s(json['filename']),
    contentType: _s(json['content_type']),
    sizeBytes: _i(json['size_bytes']),
    documentType: _s(json['document_type'], 'other'),
    uploadedAt: _s(json['uploaded_at']),
    fromCustomer: _b(json['from_customer']),
    reviewState: _s(json['review_state'], 'released'),
  );
}

class Requirement {
  const Requirement({required this.documentType, required this.required, required this.state});
  final String documentType;
  final bool required;

  /// `needed`, `with_kcpl`, `confirmed` or `resend`.
  final String state;

  factory Requirement.fromJson(Map<String, dynamic> json) =>
      Requirement(documentType: _s(json['document_type'], 'other'), required: _b(json['required']), state: _s(json['state'], 'needed'));
}

class FreeTimeStatus {
  const FreeTimeStatus({required this.state, this.deadline, required this.daysRemaining, required this.daysOverdue, this.projectedCharge});

  /// `not_set`, `running`, `last_day` or `expired`.
  final String state;
  final String? deadline;
  final int daysRemaining;
  final int daysOverdue;
  final double? projectedCharge;

  factory FreeTimeStatus.fromJson(Map<String, dynamic> json) => FreeTimeStatus(
    state: _s(json['state'], 'not_set'),
    deadline: _ns(json['deadline']),
    daysRemaining: _i(json['daysRemaining']),
    daysOverdue: _i(json['daysOverdue']),
    projectedCharge: json['projectedCharge'] is num ? _n(json['projectedCharge']) : null,
  );
}

class FreeTime {
  const FreeTime({this.location, this.days, this.dailyCharge, this.chargeCurrency, required this.status});
  final String? location;
  final int? days;
  final double? dailyCharge;
  final String? chargeCurrency;
  final FreeTimeStatus status;

  factory FreeTime.fromJson(Map<String, dynamic> json) {
    final record = _map(json['freeTime']);
    return FreeTime(
      location: _ns(record['location']),
      days: record['days'] is num ? _i(record['days']) : null,
      dailyCharge: record['daily_charge'] is num ? _n(record['daily_charge']) : null,
      chargeCurrency: _ns(record['charge_currency']),
      status: FreeTimeStatus.fromJson(_map(json['status'])),
    );
  }
}

class ShipmentDetail {
  const ShipmentDetail({required this.shipment, this.freeTime, required this.events, required this.documents, required this.checklist});

  final Shipment shipment;
  final FreeTime? freeTime;
  final List<ShipmentEvent> events;
  final List<DocumentRow> documents;
  final List<Requirement> checklist;

  factory ShipmentDetail.fromJson(Map<String, dynamic> json) => ShipmentDetail(
    shipment: Shipment.fromJson(_map(json['shipment'])),
    freeTime: json['freeTime'] is Map ? FreeTime.fromJson(_map(json['freeTime'])) : null,
    events: _list(json['events']).map(ShipmentEvent.fromJson).toList(),
    documents: _list(json['documents']).map(DocumentRow.fromJson).toList(),
    checklist: _list(json['checklist']).map(Requirement.fromJson).toList(),
  );
}

class FreeTimeRow {
  const FreeTimeRow({required this.reference, required this.origin, required this.destination, this.location, required this.status});
  final String reference;
  final String origin;
  final String destination;
  final String? location;
  final FreeTimeStatus status;

  factory FreeTimeRow.fromJson(Map<String, dynamic> json) => FreeTimeRow(
    reference: _s(json['reference']),
    origin: _s(json['origin']),
    destination: _s(json['destination']),
    location: _ns(json['location']),
    status: FreeTimeStatus.fromJson(_map(json['status'])),
  );
}

class OutstandingDocuments {
  const OutstandingDocuments({required this.reference, required this.origin, required this.destination, required this.rows});
  final String reference;
  final String origin;
  final String destination;
  final List<Requirement> rows;

  factory OutstandingDocuments.fromJson(Map<String, dynamic> json) => OutstandingDocuments(
    reference: _s(json['reference']),
    origin: _s(json['origin']),
    destination: _s(json['destination']),
    rows: _list(json['rows']).map(Requirement.fromJson).toList(),
  );
}

class CurrencyBalance {
  const CurrencyBalance({
    required this.currency,
    required this.invoiced,
    required this.paid,
    required this.outstanding,
    required this.overdue,
  });
  final String currency;
  final double invoiced;
  final double paid;
  final double outstanding;
  final double overdue;

  factory CurrencyBalance.fromJson(Map<String, dynamic> json) => CurrencyBalance(
    currency: _s(json['currency'], 'NPR'),
    invoiced: _n(json['invoiced']),
    paid: _n(json['paid']),
    outstanding: _n(json['outstanding']),
    overdue: _n(json['overdue']),
  );
}

class FinanceSummary {
  const FinanceSummary({required this.balances, required this.openInvoices, required this.overdueInvoices});
  final List<CurrencyBalance> balances;
  final int openInvoices;
  final int overdueInvoices;

  factory FinanceSummary.fromJson(Map<String, dynamic> json) => FinanceSummary(
    balances: _list(json['balances']).map(CurrencyBalance.fromJson).toList(),
    openInvoices: _i(json['openInvoices']),
    overdueInvoices: _i(json['overdueInvoices']),
  );
}

class Overview {
  const Overview({
    required this.shipments,
    required this.activeCount,
    required this.inTransitCount,
    required this.arrivingCount,
    required this.attentionCount,
    required this.deliveredCount,
    required this.documents,
    required this.outstanding,
    required this.outstandingCount,
    required this.freeTime,
    this.finance,
  });

  final List<Shipment> shipments;
  final int activeCount;
  final int inTransitCount;
  final int arrivingCount;
  final int attentionCount;
  final int deliveredCount;
  final List<DocumentRow> documents;
  final List<OutstandingDocuments> outstanding;
  final int outstandingCount;
  final List<FreeTimeRow> freeTime;
  final FinanceSummary? finance;

  factory Overview.fromJson(Map<String, dynamic> json) => Overview(
    shipments: _list(json['shipments']).map(Shipment.fromJson).toList(),
    activeCount: _i(json['activeCount']),
    inTransitCount: _i(json['inTransitCount']),
    arrivingCount: _i(json['arrivingCount']),
    attentionCount: _i(json['attentionCount']),
    deliveredCount: _i(json['deliveredCount']),
    documents: _list(json['documents']).map(DocumentRow.fromJson).toList(),
    outstanding: _list(json['outstanding']).map(OutstandingDocuments.fromJson).toList(),
    outstandingCount: _i(json['outstandingCount']),
    freeTime: _list(json['freeTime']).map(FreeTimeRow.fromJson).toList(),
    finance: json['finance'] is Map ? FinanceSummary.fromJson(_map(json['finance'])) : null,
  );
}

class InvoiceLine {
  const InvoiceLine({required this.id, required this.description, required this.quantity, required this.unitPrice, required this.total});
  final String id;
  final String description;
  final double quantity;
  final double unitPrice;
  final double total;

  factory InvoiceLine.fromJson(Map<String, dynamic> json) => InvoiceLine(
    id: _s(json['id']),
    description: _s(json['description'], 'Charge'),
    quantity: _n(json['quantity']),
    unitPrice: _n(json['unit_price']),
    total: _n(json['total']),
  );
}

class Invoice {
  const Invoice({
    required this.reference,
    required this.recordType,
    required this.status,
    required this.issueDate,
    required this.dueDate,
    required this.currency,
    required this.subtotal,
    required this.taxTotal,
    required this.total,
    required this.amountPaid,
    required this.balanceDue,
    this.shipmentReference,
    this.externalInvoiceNumber,
    required this.lines,
  });

  final String reference;
  final String recordType;
  final String status;
  final String issueDate;
  final String dueDate;
  final String currency;
  final double subtotal;
  final double taxTotal;
  final double total;
  final double amountPaid;
  final double balanceDue;
  final String? shipmentReference;
  final String? externalInvoiceNumber;
  final List<InvoiceLine> lines;

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
    reference: _s(json['reference']),
    recordType: _s(json['record_type'], 'invoice'),
    status: _s(json['status'], 'issued'),
    issueDate: _s(json['issue_date']),
    dueDate: _s(json['due_date']),
    currency: _s(json['currency'], 'NPR'),
    subtotal: _n(json['subtotal']),
    taxTotal: _n(json['tax_total']),
    total: _n(json['total']),
    amountPaid: _n(json['amount_paid']),
    balanceDue: _n(json['balance_due']),
    shipmentReference: _ns(json['shipment_reference']),
    externalInvoiceNumber: _ns(json['external_invoice_number']),
    lines: _list(json['line_items']).map(InvoiceLine.fromJson).toList(),
  );
}

class OverviewBundle {
  const OverviewBundle(this.session, this.overview);
  final SessionView session;
  final Overview overview;
}

class DocumentsPage {
  const DocumentsPage({required this.documents, required this.scanned, required this.total});
  final List<DocumentRow> documents;
  final int scanned;
  final int total;
}

class InvoicesPage {
  const InvoicesPage({required this.invoices, required this.summary});
  final List<Invoice> invoices;
  final FinanceSummary summary;
}

class DownloadedFile {
  const DownloadedFile({required this.filename, required this.contentType, required this.bytes});
  final String filename;
  final String contentType;
  final List<int> bytes;
}
