import '../api/models.dart';
import '../l10n/app_localizations.dart';
import 'theme.dart';

// Runtime values (a status, a document type) mapped to the portal's own
// wording. An unknown value gets a generic label, never a raw key.

String statusLabel(AppLocalizations l, String status) => switch (status) {
  'booking_confirmed' => l.statusBookingConfirmed,
  'preparing' => l.statusPreparing,
  'in_transit' => l.statusInTransit,
  'customs_clearance' => l.statusCustomsClearance,
  'out_for_delivery' => l.statusOutForDelivery,
  'delivered' => l.statusDelivered,
  'exception' => l.statusException,
  _ => l.statusUnknown,
};

Emphasis statusEmphasis(String status) => switch (status) {
  'exception' => Emphasis.attention,
  'delivered' => Emphasis.muted,
  _ => Emphasis.normal,
};

String modeLabel(AppLocalizations l, String mode) => switch (mode) {
  'air' => l.modeAir,
  'sea' || 'ocean' => l.modeSea,
  'road' => l.modeRoad,
  'rail' => l.modeRail,
  'courier' => l.modeCourier,
  'multimodal' => l.modeMultimodal,
  _ => l.modeUnsure,
};

String documentTypeLabel(AppLocalizations l, String type) => switch (type) {
  'air_waybill' => l.docAirWaybill,
  'bill_of_lading' => l.docBillOfLading,
  'road_consignment_note' => l.docRoadConsignmentNote,
  'shipping_instruction' => l.docShippingInstruction,
  'cargo_manifest' => l.docCargoManifest,
  'pickup_order' => l.docPickupOrder,
  'commercial_invoice' => l.docCommercialInvoice,
  'packing_list' => l.docPackingList,
  'customs_document' => l.docCustomsDocument,
  'certificate_of_origin' => l.docCertificateOfOrigin,
  'import_permit' => l.docImportPermit,
  'export_permit' => l.docExportPermit,
  'dangerous_goods_declaration' => l.docDangerousGoodsDeclaration,
  'insurance_certificate' => l.docInsuranceCertificate,
  'delivery_order' => l.docDeliveryOrder,
  'proof_of_delivery' => l.docProofOfDelivery,
  'other' => l.docOther,
  _ => l.docUnknown,
};

String invoiceStatusLabel(AppLocalizations l, Invoice invoice) => switch (invoice.status) {
  'paid' => l.invoicePaid,
  'overdue' => l.invoiceOverdue,
  'partially_paid' => l.invoicePartiallyPaid,
  'issued' => l.invoiceIssued,
  _ => l.invoiceOpen,
};

Emphasis invoiceEmphasis(Invoice invoice) => switch (invoice.status) {
  'overdue' => Emphasis.attention,
  'paid' => Emphasis.muted,
  _ => Emphasis.normal,
};

/// `null` for a released document, which needs no badge.
(String, Emphasis)? reviewState(AppLocalizations l, String state) => switch (state) {
  'confirmed' => (l.docsStateConfirmed, Emphasis.muted),
  'resend' => (l.docsStateResend, Emphasis.attention),
  'with_kcpl' => (l.docsStateWithKcpl, Emphasis.muted),
  _ => null,
};

/// Only what waits on the customer is crimson; what waits on KCPL is grey.
(String, Emphasis) requirementState(AppLocalizations l, String state) => switch (state) {
  'confirmed' => (l.xchgStateConfirmed, Emphasis.muted),
  'with_kcpl' => (l.xchgStateWithKcpl, Emphasis.muted),
  'resend' => (l.xchgStateResend, Emphasis.attention),
  _ => (l.xchgStateNeeded, Emphasis.attention),
};

/// Port of `freeTimeSummary` in app/shipment-free-time.ts. Each case has its
/// own with-location sentence because Nepali puts the place first.
String freeTimeSummary(AppLocalizations l, String? location, FreeTimeStatus status) {
  final at = location != null && location.isNotEmpty;
  final loc = location ?? '';
  switch (status.state) {
    case 'not_set':
      return l.ftsNotSet;
    case 'expired':
      final days = '${status.daysOverdue}';
      if (status.daysOverdue == 1) return at ? l.ftsExpiredYesterdayAt(loc) : l.ftsExpiredYesterday;
      return at ? l.ftsExpiredDaysAt(loc, days) : l.ftsExpiredDays(days);
    case 'last_day':
      return at ? l.ftsLastDayAt(loc) : l.ftsLastDay;
    default:
      final days = '${status.daysRemaining}';
      if (status.daysRemaining == 1) return at ? l.ftsOneDayAt(loc) : l.ftsOneDay;
      return at ? l.ftsDaysAt(days, loc) : l.ftsDays(days);
  }
}

Emphasis freeTimeEmphasis(FreeTimeStatus status) => switch (status.state) {
  'expired' || 'last_day' => Emphasis.attention,
  _ => Emphasis.normal,
};
