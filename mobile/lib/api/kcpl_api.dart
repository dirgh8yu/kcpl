import 'models.dart';

/// A failure the server explained. [code] is the API's own code:
/// `denied`, `forbidden`, `missing`, `unavailable`, `unconfigured`, or
/// `network` when the server could not be reached at all.
class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message);
  final int status;
  final String code;
  final String message;

  bool get missing => code == 'missing';
  bool get forbidden => code == 'forbidden';

  @override
  String toString() => 'ApiException($status, $code, $message)';
}

/// The customer app's view of KCPL. Every call is scoped by the server to the
/// signed-in login and to [customerId] when that customer is one it may see.
abstract class KcplApi {
  /// The customer an agent chose. A preference: the server ignores an id
  /// this login is not linked to.
  String? customerId;

  Future<SessionView> session();
  Future<OverviewBundle> overview();
  Future<List<Shipment>> shipments();
  Future<ShipmentDetail> shipment(String reference);
  Future<DocumentsPage> documents();
  Future<InvoicesPage> invoices();
  Future<Invoice> invoice(String reference);
  Future<DownloadedFile> download(DocumentRow document);

  /// Raises a quote request; returns its reference (KCPL-Q-…). KCPL replies
  /// with a price through its usual channels.
  Future<String> requestQuote(QuoteRequest request);

  /// Sends a document for a shipment. [documentType] must be one the
  /// customer may originate; the file arrives unreviewed and unreleased.
  Future<SendReceipt> sendDocument(String reference, String documentType, Attachment file, {SendProgress? onProgress});

  /// "It arrived": evidence for the operator, never delivery itself.
  Future<SendReceipt> confirmDelivery(String reference, {String receivedBy = '', String note = ''});

  /// Payment receipts sent against an invoice, newest first.
  Future<List<Remittance>> remittances(String invoice);
  Future<SendReceipt> sendRemittance(String invoice, RemittanceDraft draft, {SendProgress? onProgress});

  /// The account owner's team. Other logins are refused by the server.
  Future<List<TeamMember>> team();
  Future<TeamInvite> invite(String email);

  /// [active] false disables a member's login; true restores it.
  Future<void> setMemberActive(String email, bool active);

  /// This phone, for push to the signed-in login.
  Future<void> registerPush(String token, String platform);
  Future<void> unregisterPush(String token);
}
