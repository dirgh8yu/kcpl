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
}
