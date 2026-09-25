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
    this.canSubmitRequests = false,
  });

  final String email;
  final String displayName;
  final String customerId;
  final String customerName;
  final List<CustomerScope> customers;
  final String role;
  final bool canViewFinance;
  final String locale;

  /// May raise quote requests (the portal's owner capability).
  final bool canSubmitRequests;

  factory SessionView.fromJson(Map<String, dynamic> json) => SessionView(
    email: _s(json['email']),
    displayName: _s(json['displayName']),
    customerId: _s(json['customerId']),
    customerName: _s(json['customerName']),
    customers: _list(json['customers']).map(CustomerScope.fromJson).toList(),
    role: _s(json['role'], 'member'),
    canViewFinance: _b(_map(json['capabilities'])['canViewFinance']),
    locale: _s(json['locale'], 'en'),
    canSubmitRequests: _b(_map(json['capabilities'])['canSubmitRequests']),
  );
}

/// A quote request, as the portal's enquiry form takes one. [mode] is
/// `air`, `sea`, `road` or `unsure`; [weightUnit] `kg`, `tonnes` or `lb`.
class QuoteRequest {
  const QuoteRequest({
    required this.origin,
    required this.destination,
    this.mode = 'unsure',
    this.cargoType = '',
    this.weight = '',
    this.weightUnit = 'kg',
    this.timing = '',
    this.requirements = '',
  });

  final String origin;
  final String destination;
  final String mode;
  final String cargoType;
  final String weight;
  final String weightUnit;
  final String timing;
  final String requirements;

  Map<String, String> toJson() => {
    'kind': 'enquiry',
    'origin': origin.trim(),
    'destination': destination.trim(),
    'mode': mode,
    'cargoType': cargoType.trim(),
    'weight': weight.trim(),
    'weightUnit': weightUnit,
    'timing': timing.trim(),
    'requirements': requirements.trim(),
  };
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
  const Requirement({required this.documentType, required this.required, required this.state, this.uploadable = false});
  final String documentType;
  final bool required;

  /// `needed`, `with_kcpl`, `confirmed` or `resend`.
  final String state;

  /// A paper the customer originates and may send from the app. The server
  /// decides; a bill of lading or a customs entry is KCPL's to file.
  final bool uploadable;

  /// Waiting on the customer, and something they can send.
  bool get canSend => uploadable && (state == 'needed' || state == 'resend');

  factory Requirement.fromJson(Map<String, dynamic> json) => Requirement(
    documentType: _s(json['document_type'], 'other'),
    required: _b(json['required']),
    state: _s(json['state'], 'needed'),
    uploadable: _b(json['uploadable']),
  );
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

/// This login's own "it arrived".
class DeliveryConfirmation {
  const DeliveryConfirmation({required this.confirmedAt, this.receivedBy});
  final String confirmedAt;
  final String? receivedBy;

  factory DeliveryConfirmation.fromJson(Map<String, dynamic> json) =>
      DeliveryConfirmation(confirmedAt: _s(json['confirmed_at']), receivedBy: _ns(json['received_by']));
}

class ShipmentDetail {
  const ShipmentDetail({
    required this.shipment,
    this.freeTime,
    required this.events,
    required this.documents,
    required this.checklist,
    this.confirmation,
    this.canConfirmDelivery = false,
    this.canRate = false,
    this.rating,
  });

  final Shipment shipment;
  final FreeTime? freeTime;
  final List<ShipmentEvent> events;
  final List<DocumentRow> documents;
  final List<Requirement> checklist;
  final DeliveryConfirmation? confirmation;

  /// Decided by the server on the web page's own rule: this login may send
  /// things to KCPL, and the shipment has reached delivery.
  final bool canConfirmDelivery;

  /// Delivered and not yet rated by this login: "How did this delivery go?"
  final bool canRate;

  /// This login's own rating, once given.
  final DeliveryRating? rating;

  factory ShipmentDetail.fromJson(Map<String, dynamic> json) => ShipmentDetail(
    shipment: Shipment.fromJson(_map(json['shipment'])),
    freeTime: json['freeTime'] is Map ? FreeTime.fromJson(_map(json['freeTime'])) : null,
    events: _list(json['events']).map(ShipmentEvent.fromJson).toList(),
    documents: _list(json['documents']).map(DocumentRow.fromJson).toList(),
    checklist: _list(json['checklist']).map(Requirement.fromJson).toList(),
    confirmation: json['confirmation'] is Map ? DeliveryConfirmation.fromJson(_map(json['confirmation'])) : null,
    canConfirmDelivery: _b(json['canConfirmDelivery']),
    canRate: _b(json['canRate']),
    rating: json['rating'] is Map ? DeliveryRating.fromJson(_map(json['rating'])) : null,
  );
}

class DeliveryRating {
  const DeliveryRating({required this.score, this.createdAt = ''});
  final int score;
  final String createdAt;

  factory DeliveryRating.fromJson(Map<String, dynamic> json) => DeliveryRating(score: _i(json['score']), createdAt: _s(json['created_at']));
}

/// What KCPL said back to a rating. A low score goes to the team as a
/// complaint; a happy customer may be offered a public review page.
class RatingReceipt {
  const RatingReceipt({required this.message, this.complaint = false, this.reviewUrl});
  final String message;
  final bool complaint;
  final Uri? reviewUrl;

  factory RatingReceipt.fromJson(Map<String, dynamic> json) {
    final url = _ns(json['reviewUrl']);
    final uri = url == null ? null : Uri.tryParse(url);
    return RatingReceipt(
      message: _s(json['message']),
      complaint: _b(json['complaint']),
      // Only ever a web page: nothing else is opened from here.
      reviewUrl: uri != null && uri.scheme == 'https' ? uri : null,
    );
  }
}

/// One message on a shipment's conversation with KCPL. [author] is already
/// worded for the reader ("KCPL · Sita" for a customer).
class ShipmentMessage {
  const ShipmentMessage({required this.id, required this.fromKcpl, required this.author, required this.body, required this.createdAt});
  final String id;
  final bool fromKcpl;
  final String author;
  final String body;
  final String createdAt;

  factory ShipmentMessage.fromJson(Map<String, dynamic> json) => ShipmentMessage(
    id: _s(json['id']),
    fromKcpl: json['from'] == 'kcpl',
    author: _s(json['author']),
    body: _s(json['body']),
    createdAt: _s(json['created_at']),
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

/// A file on its way to KCPL: a photo from the camera, or a PDF or image
/// from the phone. [contentType] is what the server will sniff it to be.
class Attachment {
  const Attachment({required this.filename, required this.bytes, required this.contentType});
  final String filename;
  final List<int> bytes;
  final String contentType;

  bool get isImage => contentType.startsWith('image/');
}

/// Reported as bytes leave the phone, from 0 to 1.
typedef SendProgress = void Function(double fraction);

/// What KCPL said back to something sent. [duplicate] means it already had
/// this exact file, which is a success, not an error.
class SendReceipt {
  const SendReceipt({required this.message, this.duplicate = false});
  final String message;
  final bool duplicate;

  factory SendReceipt.fromJson(Map<String, dynamic> json) =>
      SendReceipt(message: _s(json['message']), duplicate: _b(json['duplicate']) || _b(json['alreadyConfirmed']));
}

/// A payment receipt the customer sent against an invoice: a claim for KCPL
/// accounts to match, until they acknowledge it.
class Remittance {
  const Remittance({
    required this.id,
    required this.filename,
    this.amount,
    this.currency,
    this.paidOn,
    required this.uploadedAt,
    required this.acknowledged,
  });

  final String id;
  final String filename;
  final double? amount;
  final String? currency;
  final String? paidOn;
  final String uploadedAt;
  final bool acknowledged;

  factory Remittance.fromJson(Map<String, dynamic> json) => Remittance(
    id: _s(json['id']),
    filename: _s(json['filename'], 'Receipt'),
    amount: json['amount'] is num ? _n(json['amount']) : null,
    currency: _ns(json['currency']),
    paidOn: _ns(json['paid_on']),
    uploadedAt: _s(json['uploaded_at']),
    acknowledged: json['review_state'] == 'acknowledged',
  );
}

class RemittanceDraft {
  const RemittanceDraft({required this.file, this.amount, this.currency, this.paidOn, this.note = ''});
  final Attachment file;
  final double? amount;
  final String? currency;

  /// YYYY-MM-DD.
  final String? paidOn;
  final String note;
}

/// A login on the customer's account, as the owner's team panel lists it.
class TeamMember {
  const TeamMember({
    required this.email,
    required this.role,
    required this.active,
    required this.bound,
    this.lastSignInAt,
    required this.linked,
  });

  final String email;
  final String role;
  final bool active;

  /// Has signed in at least once; until then the invitation is outstanding.
  final bool bound;
  final String? lastSignInAt;

  /// An agent KCPL linked from another account: shown, not the owner's to change.
  final bool linked;

  bool get owner => role == 'owner';

  factory TeamMember.fromJson(Map<String, dynamic> json) => TeamMember(
    email: _s(json['email']),
    role: _s(json['role'], 'member'),
    active: _b(json['active']),
    bound: _b(json['bound']),
    lastSignInAt: _ns(json['last_sign_in_at']),
    linked: _b(json['linked']),
  );
}

/// The result of inviting someone. When KCPL has no mail provider set up,
/// the one-time [link] comes back for the owner to pass on themselves.
class TeamInvite {
  const TeamInvite({required this.email, required this.delivered, this.link, this.warning});
  final String email;
  final bool delivered;
  final String? link;
  final String? warning;

  factory TeamInvite.fromJson(Map<String, dynamic> json) =>
      TeamInvite(email: _s(json['email']), delivered: _b(json['delivered']), link: _ns(json['link']), warning: _ns(json['warning']));
}

/// A quote KCPL priced, or a request still with KCPL, as the portal's
/// Requests page lists them.
class PortalQuote {
  const PortalQuote({
    required this.reference,
    required this.status,
    required this.createdAt,
    required this.origin,
    required this.destination,
    required this.mode,
    this.cargoType,
    this.weight,
    this.amount,
    required this.currency,
    this.validUntil,
    this.note,
    this.shipmentReference,
    this.bookingRequestedAt,
  });

  final String reference;
  final String status;
  final String createdAt;
  final String origin;
  final String destination;
  final String mode;
  final String? cargoType;

  /// "1200 kg", as entered.
  final String? weight;

  /// Null until KCPL has priced it.
  final double? amount;
  final String currency;
  final String? validUntil;

  /// What KCPL wrote to the customer with the price.
  final String? note;
  final String? shipmentReference;

  /// When the customer asked to proceed, if they have.
  final String? bookingRequestedAt;

  bool get priced => amount != null;
  bool get booked => shipmentReference != null;

  /// Past its validity date.
  bool expired([DateTime? now]) {
    final until = validUntil == null ? null : DateTime.tryParse(validUntil!.length <= 10 ? '${validUntil}T23:59:59+05:45' : validUntil!);
    return until != null && until.isBefore(now ?? DateTime.now());
  }

  /// Priced, current, not booked, not yet asked for.
  bool canProceed([DateTime? now]) => priced && !booked && bookingRequestedAt == null && !expired(now);

  factory PortalQuote.fromJson(Map<String, dynamic> json) {
    final weight = _ns(json['weight']);
    return PortalQuote(
      reference: _s(json['reference']),
      status: _s(json['status'], 'new'),
      createdAt: _s(json['created_at']),
      origin: _s(json['origin']),
      destination: _s(json['destination']),
      mode: _s(json['mode'], 'unsure'),
      cargoType: _ns(json['cargo_type']),
      weight: weight == null ? null : [weight, ?_ns(json['weight_unit'])].join(' '),
      amount: json['quoted_amount'] is num ? (json['quoted_amount'] as num).toDouble() : null,
      currency: _s(json['quote_currency'], 'NPR'),
      validUntil: _ns(json['valid_until']),
      note: _ns(json['customer_quote_note']),
      shipmentReference: _ns(json['shipment_reference']),
      bookingRequestedAt: _ns(json['booking_requested_at']),
    );
  }
}

class QuotesPage {
  const QuotesPage({required this.quotes, required this.requests});

  /// Priced by KCPL.
  final List<PortalQuote> quotes;

  /// Still being priced.
  final List<PortalQuote> requests;

  factory QuotesPage.fromJson(Map<String, dynamic> json) => QuotesPage(
    quotes: _list(json['quotes']).map(PortalQuote.fromJson).toList(),
    requests: _list(json['requests']).map(PortalQuote.fromJson).toList(),
  );
}

/// Which emails the login receives, as the portal's settings page has them.
class NotificationPreferences {
  const NotificationPreferences({required this.shipmentUpdates, required this.documents, required this.freeTime, this.invoices = true});
  final bool shipmentUpdates;
  final bool documents;
  final bool freeTime;

  /// Invoices due in three days or overdue. Sent only to logins that can see
  /// the account's invoices, but always saved back: the server takes a
  /// missing switch as off.
  final bool invoices;

  NotificationPreferences copyWith({bool? shipmentUpdates, bool? documents, bool? freeTime, bool? invoices}) => NotificationPreferences(
    shipmentUpdates: shipmentUpdates ?? this.shipmentUpdates,
    documents: documents ?? this.documents,
    freeTime: freeTime ?? this.freeTime,
    invoices: invoices ?? this.invoices,
  );

  Map<String, bool> toJson() => {'shipment_updates': shipmentUpdates, 'documents': documents, 'free_time': freeTime, 'invoices': invoices};

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) => NotificationPreferences(
    // Absent means subscribed, as on the web.
    shipmentUpdates: json['shipment_updates'] != false,
    documents: json['documents'] != false,
    freeTime: json['free_time'] != false,
    invoices: json['invoices'] != false,
  );
}

/// Nepal's payment gateways, as the server names them.
const paymentGatewayNames = {'khalti': 'Khalti', 'esewa': 'eSewa', 'connectips': 'connectIPS'};

/// A payment begun: where to send the browser, and how to ask after it.
class PaymentStart {
  const PaymentStart({required this.intent, required this.url});
  final String intent;
  final Uri url;
}

/// A payment as KCPL knows it. Only [paid] means the invoice took it;
/// [review] means the money arrived and accounts will apply it by hand.
class PaymentStatus {
  const PaymentStatus({required this.id, required this.invoice, required this.gateway, required this.amount, required this.status, this.message});
  final String id;
  final String invoice;
  final String gateway;
  final double amount;

  /// created, started, paid, failed or needs_review.
  final String status;
  final String? message;

  bool get paid => status == 'paid';
  bool get review => status == 'needs_review';
  bool get failed => status == 'failed';
  bool get settled => paid || review || failed;

  factory PaymentStatus.fromJson(Map<String, dynamic> json) => PaymentStatus(
    id: _s(json['id']),
    invoice: _s(json['invoice']),
    gateway: _s(json['gateway']),
    amount: _n(json['amount']),
    status: _s(json['status'], 'created'),
    message: _ns(json['message']),
  );
}

/// A link anyone can open to follow a shipment without a login.
class TrackingLink {
  const TrackingLink({required this.url, required this.expiresAt});
  final Uri url;
  final String expiresAt;
}
