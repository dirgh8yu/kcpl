// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get chromeOverview => 'Overview';

  @override
  String get chromeShipments => 'Shipments';

  @override
  String get chromeDocuments => 'Documents';

  @override
  String get chromeDocs => 'Docs';

  @override
  String get chromeInvoices => 'Invoices';

  @override
  String get chromeSettings => 'Settings';

  @override
  String get chromeAccount => 'Account';

  @override
  String get chromeAccountSwitchFailed => 'That account could not be opened.';

  @override
  String get chromePublicSite => 'Public website';

  @override
  String get commonShipment => 'Shipment';

  @override
  String get commonRoute => 'Route';

  @override
  String get commonStatus => 'Status';

  @override
  String get commonDocuments => 'Documents';

  @override
  String get commonUpdated => 'Updated';

  @override
  String get commonDownload => 'Download';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonUnavailableTitle =>
      'This information is temporarily unavailable';

  @override
  String get commonUnavailableDetail =>
      'KCPL\'s systems could not be reached. Please try again in a moment, or contact your account manager.';

  @override
  String get statusBookingConfirmed => 'Booking confirmed';

  @override
  String get statusPreparing => 'Preparing';

  @override
  String get statusInTransit => 'In transit';

  @override
  String get statusCustomsClearance => 'Customs clearance';

  @override
  String get statusOutForDelivery => 'Out for delivery';

  @override
  String get statusDelivered => 'Delivered';

  @override
  String get statusException => 'Exception';

  @override
  String get statusUnknown => 'Shipment update';

  @override
  String get modeAir => 'Air freight';

  @override
  String get modeSea => 'Sea freight';

  @override
  String get modeRoad => 'Road freight';

  @override
  String get modeUnsure => 'Freight movement';

  @override
  String get invoiceIssued => 'Issued';

  @override
  String get invoicePartiallyPaid => 'Part paid';

  @override
  String get invoicePaid => 'Paid';

  @override
  String get invoiceOverdue => 'Overdue';

  @override
  String get invoiceOpen => 'Open';

  @override
  String get freeTimeLabel => 'Free time';

  @override
  String get freeTimeDeadline => 'Last free day';

  @override
  String get freeTimeConsequence =>
      'Once free time ends, the carrier or terminal may charge storage and demurrage for each day the cargo stays.';

  @override
  String get ftsNotSet => 'No free-time allowance recorded.';

  @override
  String get ftsExpiredYesterday =>
      'Free time ended yesterday. Charges may now apply.';

  @override
  String ftsExpiredYesterdayAt(String location) {
    return 'Free time at $location ended yesterday. Charges may now apply.';
  }

  @override
  String ftsExpiredDays(String days) {
    return 'Free time ended $days days ago. Charges may now apply.';
  }

  @override
  String ftsExpiredDaysAt(String location, String days) {
    return 'Free time at $location ended $days days ago. Charges may now apply.';
  }

  @override
  String get ftsLastDay => 'Today is the last free day.';

  @override
  String ftsLastDayAt(String location) {
    return 'Today is the last free day at $location.';
  }

  @override
  String get ftsOneDay => '1 free day left.';

  @override
  String ftsOneDayAt(String location) {
    return '1 free day left at $location.';
  }

  @override
  String ftsDays(String days) {
    return '$days free days left.';
  }

  @override
  String ftsDaysAt(String days, String location) {
    return '$days free days left at $location.';
  }

  @override
  String get roleOwner => 'Account owner';

  @override
  String get roleMember => 'Team member';

  @override
  String get docAirWaybill => 'Air waybill (AWB)';

  @override
  String get docBillOfLading => 'Bill of lading (BL)';

  @override
  String get docRoadConsignmentNote => 'Road consignment note';

  @override
  String get docShippingInstruction => 'Shipping instruction';

  @override
  String get docCargoManifest => 'Cargo manifest';

  @override
  String get docPickupOrder => 'Pickup order';

  @override
  String get docCommercialInvoice => 'Commercial invoice';

  @override
  String get docPackingList => 'Packing list';

  @override
  String get docCustomsDocument => 'Customs document';

  @override
  String get docCertificateOfOrigin => 'Certificate of origin';

  @override
  String get docImportPermit => 'Import permit / licence';

  @override
  String get docExportPermit => 'Export permit / licence';

  @override
  String get docDangerousGoodsDeclaration => 'Dangerous goods declaration';

  @override
  String get docInsuranceCertificate => 'Cargo insurance certificate';

  @override
  String get docDeliveryOrder => 'Delivery order';

  @override
  String get docProofOfDelivery => 'Proof of delivery (POD)';

  @override
  String get docOther => 'Other document';

  @override
  String get docUnknown => 'Document';

  @override
  String get overviewDescription =>
      'Your live shipments, released documents and account position with KCPL.';

  @override
  String get overviewKpiActive => 'Active shipments';

  @override
  String get overviewKpiInTransit => 'In transit';

  @override
  String get overviewKpiArriving => 'Arriving in 7 days';

  @override
  String get overviewKpiFreeTime => 'Free time running out';

  @override
  String get overviewKpiDocuments => 'Documents needed';

  @override
  String get overviewKpiAttention => 'Needs attention';

  @override
  String get overviewFreeTimeTitle => 'Free time running out';

  @override
  String get overviewFreeTimeDescription =>
      'Storage and demurrage start when the carrier\'s free days end. Clearing the cargo before then avoids the charge.';

  @override
  String get overviewOutstandingTitle => 'Paperwork KCPL is waiting on';

  @override
  String get overviewOutstandingDescription =>
      'Send these from the shipment so KCPL can keep the cargo moving.';

  @override
  String get overviewAccountTitle => 'Outstanding with KCPL';

  @override
  String get overviewOpenInvoicesOne => '1 open invoice';

  @override
  String overviewOpenInvoices(String count) {
    return '$count open invoices';
  }

  @override
  String overviewOverdueCount(String count) {
    return '$count overdue';
  }

  @override
  String overviewCurrencyOutstanding(String currency) {
    return '$currency outstanding';
  }

  @override
  String overviewAmountOverdue(String amount) {
    return '$amount overdue';
  }

  @override
  String get overviewNothingOverdue => 'Nothing overdue';

  @override
  String get overviewMovementsTitle => 'Active shipments';

  @override
  String get overviewAllShipments => 'All shipments';

  @override
  String overviewNowAt(String location) {
    return 'Now at $location';
  }

  @override
  String get overviewEmptyDeliveredTitle => 'Nothing in transit right now';

  @override
  String get overviewEmptyDeliveredDescription =>
      'Every movement on your account has been delivered. Completed shipments stay available under Shipments.';

  @override
  String get overviewEmptyNoneTitle => 'No shipments yet';

  @override
  String get overviewEmptyNoneDescription =>
      'Once KCPL books your first shipment it will appear here with live milestones.';

  @override
  String get overviewPaperworkTitle => 'Recently released documents';

  @override
  String get overviewAllDocuments => 'All documents';

  @override
  String get overviewNoDocumentsTitle => 'No documents released yet';

  @override
  String get overviewNoDocumentsDescription =>
      'Bills of lading, air waybills and customs paperwork appear here once KCPL releases them to your account.';

  @override
  String get overviewViewInvoices => 'View invoices';

  @override
  String get overviewOrigin => 'Origin';

  @override
  String get overviewDestination => 'Destination';

  @override
  String get overviewColEta => 'ETA';

  @override
  String get shipsFocusAll => 'All';

  @override
  String get shipsFocusActive => 'Active';

  @override
  String get shipsFocusInTransit => 'In transit';

  @override
  String get shipsFocusAttention => 'Needs attention';

  @override
  String get shipsFocusDelivered => 'Delivered';

  @override
  String get shipsSearchPlaceholder => 'Search reference, route or carrier…';

  @override
  String get searchClear => 'Clear search';

  @override
  String get shipsEmptyFilteredTitle => 'No shipments match this view';

  @override
  String get shipsEmptyFilteredDescription =>
      'Try a different filter or clear the search.';

  @override
  String get shipsEmptyTitle => 'No shipments yet';

  @override
  String get shipsEmptyDescription =>
      'Once KCPL books a shipment for your account it appears here with its milestones and documents.';

  @override
  String docsCoverage(String scanned, String total) {
    return 'Covering your $scanned most recent shipments of $total';
  }

  @override
  String get docsAll => 'All';

  @override
  String get docsFromKcpl => 'From KCPL';

  @override
  String get docsSentByYou => 'Sent by you';

  @override
  String get docsStateConfirmed => 'Confirmed';

  @override
  String get docsStateResend => 'Send again';

  @override
  String get docsStateWithKcpl => 'With KCPL';

  @override
  String get docsEmptyFilteredTitle => 'No documents match this view';

  @override
  String get docsEmptyTitle => 'No documents yet';

  @override
  String get docsEmptyDescription =>
      'Paperwork KCPL releases to you, and anything you send from a shipment, is listed here.';

  @override
  String get docsSearchPlaceholder => 'Search file name, type or shipment…';

  @override
  String get invPositionTitle => 'Balances';

  @override
  String get invPositionDescription =>
      'Totals are grouped by the currency each invoice was issued in; KCPL does not convert between them here.';

  @override
  String invInvoicedReceipted(String invoiced, String paid) {
    return '$invoiced invoiced · $paid receipted';
  }

  @override
  String get invBillingTitle => 'Issued invoices';

  @override
  String get invColIssued => 'Issued';

  @override
  String get invColDue => 'Due';

  @override
  String get invColTotal => 'Total';

  @override
  String get invColPaid => 'Paid';

  @override
  String get invColBalance => 'Balance';

  @override
  String get invOpeningBalance => 'Opening balance';

  @override
  String get invEmptyTitle => 'No invoices issued';

  @override
  String get invEmptyDescription =>
      'Invoices appear here once KCPL issues them against your account.';

  @override
  String get invFootnote =>
      'Payment references, bank details and credit terms are confirmed by KCPL accounts. Contact your account manager if an invoice needs to be reissued or a payment is not yet reflected here.';

  @override
  String get invdStatement => 'Statement';

  @override
  String get invdColCharge => 'Charge';

  @override
  String get invdColQuantity => 'Quantity';

  @override
  String get invdColUnitPrice => 'Unit price';

  @override
  String get invdNoLinesTitle => 'No itemised charges';

  @override
  String get invdNoLinesDescription =>
      'This invoice carries a total without a line breakdown.';

  @override
  String get invdSubtotal => 'Subtotal';

  @override
  String get invdTax => 'Tax';

  @override
  String get invdReceipted => 'Receipted';

  @override
  String get invdBalanceDue => 'Balance due';

  @override
  String invdIssuedOn(String date) {
    return 'Issued $date';
  }

  @override
  String invdDueOn(String date) {
    return 'Due $date';
  }

  @override
  String get invdNotFoundTitle => 'Invoice not found';

  @override
  String get invdNotFoundDescription =>
      'Open it from your invoice list instead.';

  @override
  String get invdNoAccessTitle =>
      'Account billing is not shared with this login';

  @override
  String get invdNoAccessDescription =>
      'Ask your account owner or KCPL account manager if you also need invoice access.';

  @override
  String get shipNotFoundTitle => 'Shipment not found';

  @override
  String get shipNotFoundDescription =>
      'Check the reference, or open the shipment from your list.';

  @override
  String shipOpened(String date) {
    return 'Opened $date';
  }

  @override
  String shipLastUpdate(String when) {
    return 'Last update $when';
  }

  @override
  String get shipFreeTimeExpiredDescription =>
      'Storage or demurrage charges may be accruing on this cargo.';

  @override
  String get shipFreeTimeDescription =>
      'Clearing the cargo before this date avoids storage and demurrage charges.';

  @override
  String get shipLocation => 'Location';

  @override
  String get shipAsAdvised => 'As advised';

  @override
  String get shipDaysOverdue => 'Days overdue';

  @override
  String get shipDaysRemaining => 'Days remaining';

  @override
  String get shipChargeAfterExpiry => 'Charge after expiry';

  @override
  String shipPerDay(String currency, String amount) {
    return '$currency $amount per day';
  }

  @override
  String get shipAllowance => 'Allowance';

  @override
  String shipAllowanceDays(String days) {
    return '$days days';
  }

  @override
  String get shipFreeTimeFootnote =>
      'Free days are granted by the carrier or terminal. Contact your KCPL account manager if you need an extension.';

  @override
  String get shipMovementTitle => 'Shipment details';

  @override
  String get shipMode => 'Mode';

  @override
  String get shipCurrentLocation => 'Current location';

  @override
  String get shipNotReported => 'Not reported';

  @override
  String get shipEta => 'Estimated arrival';

  @override
  String get shipCarrierReference => 'Carrier reference';

  @override
  String get shipToBeConfirmed => 'To be confirmed';

  @override
  String get shipMilestonesTitle => 'Milestones';

  @override
  String get shipNoMilestonesTitle => 'No milestones recorded yet';

  @override
  String get shipNoMilestonesDescription =>
      'Updates appear here as KCPL progresses the shipment.';

  @override
  String get shipDocumentsDescription =>
      'Documents KCPL has released to you, and the ones you have sent.';

  @override
  String get shipNoDocumentsTitle => 'No documents yet';

  @override
  String get shipNoDocumentsDescription =>
      'Documents KCPL releases to you, and anything you send, will be listed here.';

  @override
  String get shipsColCarrier => 'Carrier';

  @override
  String get xchgTitle => 'What KCPL needs from you';

  @override
  String get xchgStateNeeded => 'Needed';

  @override
  String get xchgStateResend => 'Send again';

  @override
  String get xchgStateWithKcpl => 'With KCPL';

  @override
  String get xchgStateConfirmed => 'Confirmed';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsSignedInAs => 'Signed in as';

  @override
  String get settingsAccount => 'Account';

  @override
  String get settingsAccessLevel => 'Access level';

  @override
  String get settingsProvisioningNote =>
      'Your KCPL account manager provisions and removes portal logins. Contact them to add a colleague or change what this login can see.';

  @override
  String get appTitle => 'KCPL';

  @override
  String get signInTitle => 'Sign in to KCPL';

  @override
  String get signInSubtitle =>
      'Your shipments, documents and invoices with Kapileshwor Cargo.';

  @override
  String get emailLabel => 'Email address';

  @override
  String get passwordLabel => 'Password';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get signIn => 'Sign in';

  @override
  String get signingIn => 'Signing in…';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get resetNeedsEmail =>
      'Enter your email address first, then choose Forgot password.';

  @override
  String get resetSent =>
      'If that address has KCPL portal access, a password reset link is on its way.';

  @override
  String get signInFailed =>
      'Sign-in failed. Check your details and try again.';

  @override
  String get tooManyAttempts =>
      'Too many attempts. Wait a few minutes and try again.';

  @override
  String get networkError =>
      'KCPL could not be reached. Check your connection and try again.';

  @override
  String get sessionEnded => 'Your session has ended. Sign in again.';

  @override
  String get signOut => 'Sign out';

  @override
  String get retry => 'Try again';

  @override
  String get switchAccount => 'Switch account';

  @override
  String get downloading => 'Downloading…';

  @override
  String get downloadFailed => 'The document could not be downloaded.';

  @override
  String documentSaved(String filename) {
    return 'Saved $filename';
  }

  @override
  String get helpContact => 'Need help? Contact your KCPL account manager.';

  @override
  String get demoBanner => 'Demo data, not a real account';

  @override
  String appVersion(String version) {
    return 'Version $version';
  }

  @override
  String get modeRail => 'Rail freight';

  @override
  String get modeCourier => 'Courier';

  @override
  String get modeMultimodal => 'Multimodal';

  @override
  String get pushPrimerTitle => 'Know the moment your cargo moves';

  @override
  String get pushPrimerBody =>
      'Get a notification when a shipment moves, a document is ready or free time is running out.';

  @override
  String get pushTurnOn => 'Turn on';

  @override
  String get pushNotNow => 'Not now';

  @override
  String get pushSection => 'Notifications';

  @override
  String get pushSetting => 'Push notifications';

  @override
  String get pushOn => 'On';

  @override
  String get pushOff => 'Off';

  @override
  String get pushBlocked => 'Blocked in your phone\'s Settings';

  @override
  String get pushUnavailable => 'Not available in this build';

  @override
  String get pushBlockedHelp =>
      'Allow notifications for KCPL in your phone\'s Settings.';
}
