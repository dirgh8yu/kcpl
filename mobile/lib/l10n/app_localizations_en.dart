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
  String get topicShipmentUpdates => 'Shipment milestones';

  @override
  String get topicDocuments => 'Document requests and releases';

  @override
  String get topicFreeTime => 'Free time running out';

  @override
  String get topicInvoices => 'Invoices coming due';

  @override
  String get topicShipmentUpdatesHint =>
      'When a shipment is booked, moves, clears customs, is out for delivery or is delivered.';

  @override
  String get topicDocumentsHint =>
      'When KCPL needs paperwork from you, or releases a document to your account.';

  @override
  String get topicFreeTimeHint =>
      'Before storage or demurrage charges start on cargo at a port or depot.';

  @override
  String get topicInvoicesHint =>
      'Three days before an invoice is due, and if it becomes overdue.';

  @override
  String get settingsEmailTitle => 'What we send you';

  @override
  String get settingsEmailDescription =>
      'Milestones are sent as they happen, not as a digest.';

  @override
  String get settingsSaveFailed => 'The change could not be saved.';

  @override
  String get reqQuotesTitle => 'Quotes issued to you';

  @override
  String get reqQuotesDescription =>
      'Prices KCPL has confirmed. Ask to proceed and your account manager will convert the quote into a booking.';

  @override
  String get reqColQuote => 'Quote';

  @override
  String get reqColValid => 'Valid until';

  @override
  String get reqAskToProceed => 'Ask to proceed';

  @override
  String get reqNoQuotesTitle => 'No quotes yet';

  @override
  String get reqNoQuotesDescription =>
      'Quotes KCPL issues to your account appear here with their price and validity.';

  @override
  String get reqProgressTitle => 'Requests KCPL is working on';

  @override
  String get reqProgressDescription =>
      'Requests that have not been priced yet.';

  @override
  String reqBookingSent(String reference) {
    return 'KCPL has been notified that you want to proceed with $reference.';
  }

  @override
  String get reqBookingFailed => 'The booking request could not be sent.';

  @override
  String reqRaisedOn(String date) {
    return 'Raised $date';
  }

  @override
  String get reqNothingWaitingTitle => 'Nothing waiting';

  @override
  String get reqNothingWaitingDescription =>
      'Every request you have raised has been priced.';

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
  String get docsLoadOlder => 'Load older documents';

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

  @override
  String homeOnTheWay(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count shipments on the way',
      one: '1 shipment on the way',
      zero: 'Nothing on the way',
    );
    return '$_temp0';
  }

  @override
  String homeNeedsAttention(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count need attention',
      one: '1 needs attention',
    );
    return '$_temp0';
  }

  @override
  String homeArriving(int count) {
    return '$count arriving this week';
  }

  @override
  String get homeAllClear => 'Everything is moving as planned';

  @override
  String get homeNeedsYou => 'Needs you';

  @override
  String get quoteWhereTo => 'Where is your cargo going?';

  @override
  String get quoteTitle => 'Get a quote';

  @override
  String get quoteFrom => 'From';

  @override
  String get quoteFromHint => 'Pickup city, port or border';

  @override
  String get quoteTo => 'To';

  @override
  String get quoteToHint => 'Where it should arrive';

  @override
  String get quoteYourRoutes => 'Your routes';

  @override
  String get quoteModeTitle => 'How should it travel?';

  @override
  String get quoteModeRoad => 'Road';

  @override
  String get quoteModeRoadDetail =>
      'Overland, through the India and China borders';

  @override
  String get quoteModeSea => 'Sea';

  @override
  String get quoteModeSeaDetail =>
      'Via Kolkata, Haldia or Vizag, for the largest loads';

  @override
  String get quoteModeAir => 'Air';

  @override
  String get quoteModeAirDetail => 'Fastest, into Kathmandu (TIA)';

  @override
  String get quoteModeUnsure => 'Let KCPL advise';

  @override
  String get quoteModeUnsureDetail =>
      'We will suggest the best way for your cargo';

  @override
  String get quoteCargoTitle => 'Cargo';

  @override
  String get quoteCargoHint => 'What is it? Garments, machinery…';

  @override
  String get quoteWeightHint => 'Weight (optional)';

  @override
  String get quoteWhenTitle => 'When';

  @override
  String get quoteWhenSoon => 'As soon as possible';

  @override
  String get quoteWhenWeeks => 'Within 2 weeks';

  @override
  String get quoteWhenMonth => 'This month';

  @override
  String get quoteWhenFlexible => 'Flexible';

  @override
  String get quoteNotesTitle => 'Anything else';

  @override
  String get quoteNotesHint =>
      'Dimensions, packaging, Incoterms, special handling';

  @override
  String get quoteSubmit => 'Request quote';

  @override
  String get quoteSending => 'Sending…';

  @override
  String get quoteNeedsRoute => 'Add where it is coming from and going to.';

  @override
  String get quoteSentTitle => 'Quote requested';

  @override
  String quoteSentBody(String route) {
    return 'KCPL will reply with a price for $route.';
  }

  @override
  String get quoteDone => 'Done';

  @override
  String get continueWithApple => 'Continue with Apple';

  @override
  String get continueWithGoogle => 'Continue with Google';

  @override
  String get signInWithEmail => 'Sign in with email';

  @override
  String get orWithEmail => 'or with your email';

  @override
  String linkProvider(String provider) {
    return 'This email already has a KCPL password. Sign in with it once and $provider will be connected for next time.';
  }

  @override
  String providerOff(String provider) {
    return '$provider sign-in is not switched on for KCPL yet. Use your email and password.';
  }

  @override
  String get sendDocTitle => 'Send a document';

  @override
  String get sendDocKind => 'What is it?';

  @override
  String get sendDocFile => 'The document';

  @override
  String sendDocFor(String reference) {
    return 'For $reference';
  }

  @override
  String get captureTakePhoto => 'Take photo';

  @override
  String get captureChoosePhoto => 'Choose photo';

  @override
  String get captureChooseFile => 'Choose file';

  @override
  String get captureReplace => 'Replace';

  @override
  String get captureCameraDenied =>
      'KCPL can\'t use the camera. Allow it in your phone\'s Settings.';

  @override
  String get captureUnsupported => 'Send a PDF, JPEG, PNG or WEBP file.';

  @override
  String captureTooLarge(String size) {
    return 'Files must be $size MB or smaller.';
  }

  @override
  String get captureHint =>
      'Lay the paper flat in good light, with all four corners in view.';

  @override
  String get sendToKcpl => 'Send to KCPL';

  @override
  String get sending => 'Sending…';

  @override
  String sendingPercent(String percent) {
    return 'Sending… $percent%';
  }

  @override
  String get sendDocFootnote =>
      'KCPL checks every document before it counts. Bills of lading, customs entries and proofs of delivery are filed by KCPL.';

  @override
  String get sentTitle => 'Sent to KCPL';

  @override
  String get sendChooseKind => 'Choose what the document is.';

  @override
  String get sendChooseFile => 'Add a photo or a file first.';

  @override
  String get sendAction => 'Send';

  @override
  String get confirmPrompt => 'Has it arrived?';

  @override
  String get confirmPromptBody => 'Let KCPL know the cargo reached you.';

  @override
  String get confirmTitle => 'Confirm receipt';

  @override
  String get confirmReceivedBy => 'Received by';

  @override
  String get confirmReceivedByHint => 'Who took delivery';

  @override
  String get confirmNote => 'Anything KCPL should know';

  @override
  String get confirmNoteHint => 'Condition, missing pieces, damage…';

  @override
  String get confirmPhoto => 'Photo of the delivery';

  @override
  String get confirmPhotoOptional =>
      'Optional. It is filed on the shipment for KCPL to see.';

  @override
  String get confirmFootnote =>
      'This tells KCPL the cargo arrived. It isn\'t a proof of delivery: KCPL still files that.';

  @override
  String get confirmedTitle => 'Thank you';

  @override
  String confirmedOn(String date) {
    return 'You confirmed receipt on $date';
  }

  @override
  String confirmedBy(String name) {
    return 'Received by $name';
  }

  @override
  String get receiptSend => 'Send payment receipt';

  @override
  String get receiptTitle => 'Payment receipt';

  @override
  String get receiptFile => 'Bank receipt or advice';

  @override
  String get receiptAmount => 'Amount paid';

  @override
  String get receiptPaidOn => 'Paid on';

  @override
  String get receiptNote => 'Note for KCPL accounts';

  @override
  String get receiptNoteHint => 'Bank, reference number…';

  @override
  String get receiptFootnote =>
      'KCPL accounts match every receipt with the bank before the invoice changes.';

  @override
  String get receiptsTitle => 'Receipts you sent';

  @override
  String get receiptWithAccounts => 'With KCPL accounts';

  @override
  String get receiptAcknowledged => 'Acknowledged';

  @override
  String get receiptInvalidAmount => 'Enter the amount as a number.';

  @override
  String receiptPaidOnDate(String date) {
    return 'Paid $date';
  }

  @override
  String get teamTitle => 'Team';

  @override
  String get teamInvite => 'Invite a colleague';

  @override
  String get teamInviteBody =>
      'They\'ll see your shipments and documents. Invoices stay with account owners.';

  @override
  String get teamSendInvite => 'Send invitation';

  @override
  String get teamInvited => 'Invitation sent';

  @override
  String teamInviteSentBody(String email) {
    return '$email will get an email to set a password.';
  }

  @override
  String teamInviteLinkBody(String email) {
    return 'Email isn\'t set up for KCPL yet, so pass this link to $email yourself. It works once.';
  }

  @override
  String get teamShareLink => 'Share link';

  @override
  String get teamStateActive => 'Active';

  @override
  String get teamStateInvited => 'Invited';

  @override
  String get teamStateOff => 'Turned off';

  @override
  String get teamStateLinked => 'Linked by KCPL';

  @override
  String get teamYou => 'You';

  @override
  String teamLastSeen(String date) {
    return 'Last signed in $date';
  }

  @override
  String get teamNeverSignedIn => 'Hasn\'t signed in yet';

  @override
  String get teamTurnOff => 'Turn off login';

  @override
  String get teamTurnOn => 'Turn login back on';

  @override
  String teamTurnOffBody(String email) {
    return '$email won\'t be able to sign in until you turn it back on.';
  }

  @override
  String get cancel => 'Cancel';

  @override
  String get teamFootnote =>
      'Members see shipments and documents. Only KCPL can add another account owner.';

  @override
  String get teamLinkedFootnote =>
      'A login linked by KCPL belongs to another account. Ask KCPL to remove it.';

  @override
  String offlineAsOf(String time) {
    return 'Offline · as of $time';
  }

  @override
  String get lockSection => 'Privacy';

  @override
  String lockRequire(String method) {
    return 'Require $method';
  }

  @override
  String lockFootnote(String method) {
    return 'KCPL asks for $method when you come back to it after a minute away, and hides its content in the app switcher.';
  }

  @override
  String get lockTitle => 'KCPL is locked';

  @override
  String get lockUnlock => 'Unlock';

  @override
  String get lockReason => 'Unlock your KCPL account';

  @override
  String get lockFaceId => 'Face ID';

  @override
  String get lockTouchId => 'Touch ID';

  @override
  String get lockFingerprint => 'fingerprint';

  @override
  String get lockPasscode => 'your passcode';

  @override
  String get shareStatus => 'Share status';

  @override
  String shareExpected(String date) {
    return 'Expected $date';
  }

  @override
  String shareDeliveredOn(String date) {
    return 'Delivered $date';
  }

  @override
  String get shareFooter => 'Kapileshwor Cargo · shared from the KCPL app';

  @override
  String shareCarrierRef(String reference) {
    return 'Carrier reference $reference';
  }

  @override
  String get quotesTitle => 'Quotes';

  @override
  String get quotesNew => 'New request';

  @override
  String quoteValidUntil(String date) {
    return 'Valid until $date';
  }

  @override
  String quoteExpired(String date) {
    return 'Expired $date';
  }

  @override
  String get quoteAsked => 'You asked to proceed';

  @override
  String quoteBooked(String reference) {
    return 'Booked as $reference';
  }

  @override
  String quotePriceFor(String cargo) {
    return '$cargo';
  }

  @override
  String get quoteProceedNote => 'Anything for your account manager (optional)';

  @override
  String get quoteProceedFootnote =>
      'Your account manager confirms the booking with you. Nothing is booked or charged until they do.';

  @override
  String get quoteProceedDone => 'Request sent';

  @override
  String get quoteCargo => 'Cargo';

  @override
  String get quoteWeight => 'Weight';

  @override
  String get quoteExpiredBody =>
      'This price has expired. Ask KCPL for a fresh quote.';

  @override
  String get payOnline => 'Pay online';

  @override
  String payChoose(String amount) {
    return 'Pay $amount with';
  }

  @override
  String get payFootnote =>
      'You pay on the gateway\'s own page. KCPL checks the payment with the gateway before applying it to this invoice.';

  @override
  String get payWaiting => 'Finish paying in the browser';

  @override
  String get payWaitingBody =>
      'Come back here when you\'re done. This page checks with KCPL on its own.';

  @override
  String get payOpenAgain => 'Open the payment page again';

  @override
  String get payPaid => 'Payment received';

  @override
  String payPaidBody(String amount, String invoice) {
    return '$amount was applied to $invoice.';
  }

  @override
  String get payReview => 'Payment received';

  @override
  String payReviewBody(String invoice) {
    return 'KCPL accounts will apply it to $invoice and confirm.';
  }

  @override
  String get payFailed => 'Payment not completed';

  @override
  String get payFailedBody =>
      'Nothing was charged by KCPL. You can try again or pay another way.';

  @override
  String payOwed(String amount) {
    return '$amount owed';
  }

  @override
  String get payWhole => 'Whole balance';

  @override
  String get payPart => 'Part of it';

  @override
  String payAmount(String currency) {
    return 'Amount to pay ($currency)';
  }

  @override
  String get payTooMuch => 'That is more than is owed.';

  @override
  String payTooLittle(int minimum) {
    return 'The smallest online payment is NPR $minimum.';
  }

  @override
  String get payEnterAmount => 'Enter an amount.';

  @override
  String payInRupees(String amount) {
    return 'You pay $amount in rupees';
  }

  @override
  String payRate(String currency, String rate, String date) {
    return '1 $currency = NPR $rate, Nepal Rastra Bank\'s selling rate for $date. The rate is fixed when you start paying; KCPL accounts apply the payment to the invoice.';
  }

  @override
  String get payPartFootnote =>
      'The rest stays on the invoice, to pay later or by bank transfer.';

  @override
  String get payCouldNotOpen =>
      'The payment page could not be opened on this phone.';

  @override
  String get emailSection => 'Email me about';

  @override
  String get calendarSection => 'Dates';

  @override
  String get calendarGregorian => 'Gregorian (AD)';

  @override
  String get calendarBikramSambat => 'Bikram Sambat (BS)';

  @override
  String get calendarFootnote =>
      'How dates show in the app. Carrier and customs papers keep their own dates.';

  @override
  String get trackShareLink => 'Share a tracking link';

  @override
  String get trackShareLinkHint =>
      'Anyone with the link can follow this shipment for 30 days, without a login.';

  @override
  String trackShareMessage(String reference, String url) {
    return 'Follow $reference with Kapileshwor Cargo: $url';
  }

  @override
  String get trackStopSharing => 'Stop sharing links';

  @override
  String trackStopped(String reference) {
    return 'Links for $reference no longer work.';
  }

  @override
  String get trackStoppedNone => 'There were no links to stop.';

  @override
  String get liveFollow => 'Follow on Lock Screen';

  @override
  String get liveFollowAndroid => 'Follow in notifications';

  @override
  String get liveFollowingAndroid => 'Following in your notifications';

  @override
  String get liveUnavailableAndroid =>
      'Notifications are turned off for KCPL in Settings.';

  @override
  String get liveChannel => 'Shipment progress';

  @override
  String get liveFollowing => 'On your Lock Screen';

  @override
  String get liveStop => 'Stop following';

  @override
  String get liveUnavailable =>
      'Live Activities are turned off for KCPL in Settings.';

  @override
  String get captureScan => 'Scan document';

  @override
  String get msgRow => 'Message KCPL';

  @override
  String get msgRowHint => 'About this shipment, to the person handling it';

  @override
  String get msgTitle => 'Messages';

  @override
  String get msgPlaceholder => 'Write a message';

  @override
  String get msgSend => 'Send';

  @override
  String get msgEmpty => 'No messages yet';

  @override
  String get msgEmptyBody =>
      'Ask anything about this shipment. The person handling it replies here and on the web.';

  @override
  String get msgYou => 'You';

  @override
  String get opsMsgRow => 'Messages with the customer';

  @override
  String get opsMsgEmptyBody =>
      'When the customer asks about this shipment, it appears here and on the Job File.';

  @override
  String get opsMsgFootnote => 'The customer sees your first name on replies.';

  @override
  String get rateTitle => 'How did this delivery go?';

  @override
  String get rateHint => 'One tap. It goes to the team that handled it.';

  @override
  String rateScore(int score) {
    return '$score out of 5';
  }

  @override
  String get rateComment => 'Anything we should know? (optional)';

  @override
  String get rateSend => 'Send rating';

  @override
  String get rateThanks => 'Thank you';

  @override
  String get rateReview => 'Leave a public review';

  @override
  String rateRated(int score) {
    return 'You rated this delivery $score out of 5';
  }

  @override
  String get estStorageRow => 'What will storage cost?';

  @override
  String get estStorageTitle => 'Storage charges';

  @override
  String estDaysOver(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days days after free time',
      one: '1 day after free time',
      zero: 'Collected within free time',
    );
    return '$_temp0';
  }

  @override
  String estPerDay(String amount) {
    return '$amount a day';
  }

  @override
  String estCollect(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'Collected in $days days',
      one: 'Collected tomorrow',
      zero: 'Collected today',
    );
    return '$_temp0';
  }

  @override
  String get estCharge => 'Estimated charge';

  @override
  String get estLater => 'Later';

  @override
  String get estSooner => 'Sooner';

  @override
  String get estStorageFoot =>
      'At the daily rate KCPL recorded from the carrier. The carrier\'s own invoice decides the charge.';

  @override
  String get estNoRate =>
      'No daily rate is recorded for this shipment yet. Ask your account manager.';

  @override
  String get estDutyRow => 'Estimate customs duty';

  @override
  String get estDutyTitle => 'Customs duty';

  @override
  String get estCif => 'Value of the goods (CIF, NPR)';

  @override
  String get estDutyRate => 'Customs duty rate';

  @override
  String get estExcise => 'Excise duty';

  @override
  String get estNone => 'None';

  @override
  String get estVat => 'VAT at 13%';

  @override
  String get estLineDuty => 'Customs duty';

  @override
  String get estLineExcise => 'Excise duty';

  @override
  String get estLineVat => 'VAT';

  @override
  String get estTotal => 'Estimated total at customs';

  @override
  String get estDutyFoot =>
      'A rough guide from the rates you choose. The rate for your goods depends on their HS code; KCPL confirms it before clearance.';

  @override
  String get sheetGrabber => 'Show more or less of the list';

  @override
  String get splitShipment => 'Choose a shipment';

  @override
  String get splitShipmentBody =>
      'Its journey, documents and messages open here.';

  @override
  String get splitInvoice => 'Choose an invoice';

  @override
  String get splitInvoiceBody =>
      'Its balance, receipts and paying online open here.';

  @override
  String get opsSplitJob => 'Choose a job';

  @override
  String get opsSplitJobBody => 'Its tasks, delivery and messages open here.';

  @override
  String get splitDocument => 'Choose a document';

  @override
  String get splitDocumentBody =>
      'It opens here, with the shipment it belongs to.';

  @override
  String get splitAccount => 'Quotes and your team';

  @override
  String get splitAccountBody => 'They open here, beside your settings.';

  @override
  String get opsSplitAlert => 'Choose an alert';

  @override
  String get opsSplitAlertBody => 'The job it is about opens here.';

  @override
  String get docOpen => 'Open';

  @override
  String get docFile => 'File';

  @override
  String get docAdded => 'Added';

  @override
  String get docSize => 'Size';

  @override
  String get docState => 'Review';

  @override
  String docShipment(String reference) {
    return 'Open shipment $reference';
  }

  @override
  String get docPreviewFailed =>
      'The preview could not be loaded. Open the file instead.';

  @override
  String get qaTrack => 'Track a shipment';

  @override
  String get qaQuote => 'Request a quote';

  @override
  String get qaPay => 'Pay an invoice';

  @override
  String get opsSignInTitle => 'KCPL Operations';

  @override
  String get opsSignInSubtitle =>
      'Jobs, tasks and alerts across your branches.';

  @override
  String get opsPriorityStandard => 'Standard';

  @override
  String get opsPriorityHigh => 'High';

  @override
  String get opsPriorityUrgent => 'Urgent';

  @override
  String get opsJustNow => 'just now';

  @override
  String get opsNoDueDate => 'No due date';

  @override
  String get opsYours => 'Yours';

  @override
  String get opsUnassigned => 'Unassigned';

  @override
  String get opsAlerts => 'Alerts';

  @override
  String get opsAllCaughtUp => 'All caught up';

  @override
  String get opsAlertsEmpty => 'Alerts for your branches and jobs appear here.';

  @override
  String get opsOutForDelivery => 'Out for delivery';

  @override
  String get opsStartDelivery => 'Start delivery';

  @override
  String get opsTakenBy => 'Taken by';

  @override
  String get opsDriverHint => 'Driver or field staff';

  @override
  String get opsVehicleHint => 'Vehicle number (optional)';

  @override
  String get opsStartFootnote =>
      'Starts attempt now and shows it on the Job File and to the customer as out for delivery.';

  @override
  String get opsRelConsignee => 'Consignee';

  @override
  String get opsRelStaff => 'Their staff';

  @override
  String get opsRelSecurity => 'Security';

  @override
  String get opsRelFamily => 'Family';

  @override
  String get opsRelOther => 'Other';

  @override
  String get opsRecipient => 'Recipient';

  @override
  String get opsNeedRecipient => 'Who received it? Enter their name.';

  @override
  String get opsNeedProof => 'Add a signature or a photo as proof of delivery.';

  @override
  String get opsNeedReason => 'Say why it could not be delivered.';

  @override
  String get opsSavedOnPhone => 'Saved on this phone';

  @override
  String get opsSavedDeliveryBody =>
      'No signal. The delivery and its proof go to KCPL by themselves, with the time they happened, as soon as there is signal.';

  @override
  String get opsProofSent => 'Proof sent';

  @override
  String get opsDeliveryRecorded => 'Delivery recorded';

  @override
  String get opsAttemptRecorded => 'Attempt recorded';

  @override
  String get opsSendProof => 'Send proof of delivery';

  @override
  String get opsRecordDelivery => 'Record delivery';

  @override
  String get opsRecordAttempt => 'Record attempt';

  @override
  String get opsProofOfDelivery => 'Proof of delivery';

  @override
  String get opsDelivery => 'Delivery';

  @override
  String get opsDelivered => 'Delivered';

  @override
  String get opsNotDelivered => 'Not delivered';

  @override
  String get opsRefused => 'Refused';

  @override
  String get opsWhere => 'Where';

  @override
  String get opsProofFootnote =>
      'Evidence reaches the desk as received. Verifying it, and marking the shipment Delivered, stays with the desk.';

  @override
  String get opsExceptionFootnote =>
      'Opens an exception on the job for the desk.';

  @override
  String get opsReceivedByHeader => 'Received by';

  @override
  String get opsFullName => 'Full name';

  @override
  String get opsPhoneOptional => 'Phone (optional)';

  @override
  String get opsRelationHint => 'Relation to the consignee';

  @override
  String get opsProof => 'Proof';

  @override
  String get opsGetSignature => 'Get a signature';

  @override
  String get opsSigned => 'Signed';

  @override
  String get opsSignAgain => 'Tap to sign again';

  @override
  String get opsPhotographDelivery => 'Photograph the delivery';

  @override
  String get opsAnotherPhoto => 'Add another photo';

  @override
  String get opsPhotoHint => 'The cargo at the door, a stamped delivery note';

  @override
  String get opsWhyRefused => 'Why it was refused';

  @override
  String get opsWhyNotDelivered => 'Why it could not be delivered';

  @override
  String get opsRefusedHint => 'Damaged carton, wrong goods, not ordered…';

  @override
  String get opsFailedHint =>
      'Nobody at the address, gate closed, road blocked…';

  @override
  String get opsRemovePhoto => 'Remove photo';

  @override
  String get opsLocating => 'Finding where you are…';

  @override
  String get opsNoLocation => 'Location not available';

  @override
  String get opsLocation => 'Location';

  @override
  String get opsLocationHint =>
      'Turn on location and tap to try again. The delivery can be recorded without it.';

  @override
  String get opsTodaysDeliveries => 'Today’s deliveries';

  @override
  String get opsMapsFailed => 'Maps could not be opened on this phone.';

  @override
  String get opsDeliveryOpenFailed =>
      'The delivery could not be opened. Try again.';

  @override
  String get opsNoDeliveriesMine => 'No deliveries for you today';

  @override
  String get opsNoDeliveries => 'No deliveries today';

  @override
  String get opsDeliveriesEmpty =>
      'Deliveries under way or due out today in your branches appear here.';

  @override
  String get opsRoute => 'Route';

  @override
  String get opsRouteFootnote =>
      'Hold the handle and drag to put stops in the order you will drive them. The order is kept for today.';

  @override
  String get opsRecordedWaiting => 'Recorded · waiting for signal';

  @override
  String get opsReadyToGo => 'Ready to go';

  @override
  String get opsDirections => 'Directions';

  @override
  String get opsRecord => 'Record';

  @override
  String get opsStart => 'Start';

  @override
  String get opsNoteSavedOffline =>
      'No signal. Saved on this phone; it goes to the job by itself.';

  @override
  String get opsNeedNote => 'Write a note or add a photo.';

  @override
  String get opsAddToJob => 'Add to job';

  @override
  String get opsNoteHint => 'What did you see? Seal, damage, who you spoke to…';

  @override
  String get opsPhoto => 'Photo';

  @override
  String get opsPhotoFiled => 'Filed in the job’s Document Vault for review.';

  @override
  String get opsFileAs => 'File it as';

  @override
  String get opsNoteFootnote =>
      'Shows on the Job File timeline on the web, with your name.';

  @override
  String get opsSearchStaff => 'Search by name or branch';

  @override
  String get opsStaffFailed => 'The staff list could not be loaded.';

  @override
  String get opsNobodyFound => 'Nobody found';

  @override
  String get opsStaffEmpty =>
      'Only staff who share one of your branches are listed.';

  @override
  String get opsStaffHeader => 'Staff in your branches';

  @override
  String get opsAssignJob => 'Assign job';

  @override
  String get opsGiveJobTo => 'Give job to';

  @override
  String get opsReassignFailed => 'The job was not reassigned. Try again.';

  @override
  String get opsDone => 'Done';

  @override
  String get opsNeedTaskTitle => 'Give the task a title.';

  @override
  String get opsNewTask => 'New task';

  @override
  String get opsTitle => 'Title';

  @override
  String get opsNotesOptional => 'Notes (optional)';

  @override
  String get opsDue => 'Due';

  @override
  String get opsNoDate => 'No date';

  @override
  String get opsToday5pm => 'Today, 5 PM';

  @override
  String get opsTomorrow10am => 'Tomorrow, 10 AM';

  @override
  String get opsPick => 'Pick…';

  @override
  String get opsAssignedTo => 'Assigned to';

  @override
  String get opsAssignTask => 'Assign task';

  @override
  String get opsNobodyYet => 'Nobody yet';

  @override
  String get opsBranch => 'Branch';

  @override
  String get opsNeedOverride =>
      'Say why it is being closed anyway (at least 8 characters).';

  @override
  String get opsNotClosed => 'Not closed: something still stands in the way.';

  @override
  String get opsJobClosed => 'Job closed';

  @override
  String get opsJobClosedBody =>
      'The Job File is closed, with your name and the time.';

  @override
  String get opsCloseJob => 'Close job';

  @override
  String get opsCloseAnyway => 'Close anyway';

  @override
  String get opsReadyToClose => 'Ready to close';

  @override
  String get opsReadyToCloseBody =>
      'Tasks, customs and proof of delivery are all in order.';

  @override
  String get opsStillOpen => 'Still open';

  @override
  String get opsOverrideReason => 'Reason to close anyway';

  @override
  String get opsOverrideHint => 'Recorded on the Job File with your name';

  @override
  String get opsCloseBlockedFootnote =>
      'Clear these first, or ask Management to close it with a reason.';

  @override
  String get opsJobNotFound => 'Job not found';

  @override
  String get opsJobNotFoundBody =>
      'It may have been closed or moved outside your branches.';

  @override
  String get opsOwner => 'Owner';

  @override
  String get opsAssignSomeone => 'Assign someone';

  @override
  String get opsGiveToSomeone => 'Give to someone else';

  @override
  String get opsNoOwner => 'Nobody owns this job yet.';

  @override
  String get opsTasks => 'Tasks';

  @override
  String get opsNoTasks =>
      'No tasks yet. Tasks added here or in the Job File show on both.';

  @override
  String get opsCustoms => 'Customs';

  @override
  String get opsRequired => 'Required';

  @override
  String get opsOptional => 'Optional';

  @override
  String get opsBeforeCloseout => 'Before closeout';

  @override
  String get opsFromField => 'From the field';

  @override
  String get opsNotes => 'Notes';

  @override
  String get opsDetails => 'Details';

  @override
  String get opsCustomer => 'Customer';

  @override
  String get opsPriority => 'Priority';

  @override
  String get opsHandling => 'Handling';

  @override
  String get opsInternalRef => 'Internal ref';

  @override
  String get opsProfitability => 'Profitability';

  @override
  String get opsRevenue => 'Revenue';

  @override
  String get opsCost => 'Cost';

  @override
  String get opsProfit => 'Profit';

  @override
  String get opsMargin => 'Margin';

  @override
  String get opsJobIsClosed => 'This job is closed.';

  @override
  String get opsCloseJobEllipsis => 'Close job…';

  @override
  String get opsQueuedDeliveryBody =>
      'This delivery is on your phone and goes to KCPL, with the time it happened, as soon as there is signal.';

  @override
  String get opsDeleteDelivery => 'Delete this delivery';

  @override
  String get opsRecordHowItWent => 'Record how it went';

  @override
  String get opsAddProof => 'Add proof of delivery';

  @override
  String get opsWaitingForSignal => 'Waiting for signal';

  @override
  String get opsSignature => 'Signature';

  @override
  String get opsDocument => 'Document';

  @override
  String get opsScheduled => 'Scheduled';

  @override
  String get opsPodReceived => 'Proof received · the desk verifies it';

  @override
  String get opsPodVerified => 'Proof of delivery verified';

  @override
  String get opsPodRejected => 'Proof rejected by the desk · add new proof';

  @override
  String get opsPodNone => 'No proof of delivery yet';

  @override
  String get opsQueuedNoteBody =>
      'This note is on your phone and goes to the job as soon as KCPL can be reached.';

  @override
  String get opsDeleteNote => 'Delete note';

  @override
  String get opsAddNote => 'Add a note or photo';

  @override
  String get opsCouldNotOpen => 'That could not be opened on this device.';

  @override
  String get opsChangeNotSaved => 'That change was not saved. Try again.';

  @override
  String get opsMine => 'Mine';

  @override
  String get opsAll => 'All';

  @override
  String get opsOverdue => 'Overdue';

  @override
  String get opsExceptions => 'Exceptions';

  @override
  String get opsJobs => 'Jobs';

  @override
  String get opsScan => 'Scan';

  @override
  String get opsSearchJobs => 'Search reference, customer, route or owner…';

  @override
  String get opsNoActiveJobs => 'No active jobs';

  @override
  String get opsNothingMatches => 'Nothing matches';

  @override
  String get opsJobsEmpty => 'Jobs in your branches appear here.';

  @override
  String get opsJobsNoMatch => 'Try another filter or clear the search.';

  @override
  String get opsMe => 'Me';

  @override
  String get opsRole => 'Role';

  @override
  String get opsBranches => 'Branches';

  @override
  String get opsAllBranches => 'All branches';

  @override
  String get opsCostsAndMargins => 'Costs and margins';

  @override
  String get opsVisible => 'Visible';

  @override
  String get opsNotShared => 'Not shared with this role';

  @override
  String get opsRolesFootnote =>
      'Roles and branch access are managed by KCPL Management in the web admin.';

  @override
  String get opsNotifications => 'Notifications';

  @override
  String get opsSignOut => 'Sign out';

  @override
  String get opsToday => 'Today';

  @override
  String get opsDemoBanner => 'Demo data, not real operations';

  @override
  String get opsReadingText => 'Reading the text…';

  @override
  String get opsPointAtCode => 'Point at a barcode or QR code';

  @override
  String get opsScanHint =>
      'Or read a container number off the door, or type a reference.';

  @override
  String get opsReadText => 'Read text';

  @override
  String get opsTypeIt => 'Type it';

  @override
  String get opsNoNumber => 'No number in that photo';

  @override
  String get opsTapNumber => 'Tap the number to find';

  @override
  String get opsTryCloser => 'Try closer, straight on, in good light.';

  @override
  String get opsCheckDigitFirst =>
      'Container numbers that pass their check digit come first.';

  @override
  String get opsScanAgain => 'Scan again';

  @override
  String get opsLookupHint => 'Job, container, B/L or AWB number';

  @override
  String get opsFindJob => 'Find job';

  @override
  String get opsBackToCamera => 'Back to camera';

  @override
  String get opsNoMatchBody =>
      'Only jobs in your branches can be found. Check the number, or search Jobs.';

  @override
  String get opsCameraDenied =>
      'Allow the camera for KCPL Ops in Settings to scan. You can still type a reference below.';

  @override
  String get opsCameraUnavailable =>
      'The camera is not available. You can still type a reference below.';

  @override
  String get opsCancel => 'Cancel';

  @override
  String get opsClear => 'Clear';

  @override
  String get opsSignatureArea => 'Signature area. Sign with one finger.';

  @override
  String get opsNeedsAction => 'Needs action';

  @override
  String get opsMoving => 'Moving';

  @override
  String get opsAllJobs => 'All jobs';

  @override
  String get opsNothingWaiting => 'Nothing waiting on you';

  @override
  String get opsNothingWaitingBody =>
      'No active jobs in your branches need attention right now.';

  @override
  String opsMinutesAgo(int minutes) {
    return '$minutes min ago';
  }

  @override
  String opsHoursAgo(int hours) {
    return '$hours h ago';
  }

  @override
  String opsDaysAgo(int days) {
    return '$days d ago';
  }

  @override
  String opsOverdueDue(String when) {
    return 'Overdue · due $when';
  }

  @override
  String opsDueToday(String time) {
    return 'Due today $time';
  }

  @override
  String opsDueTomorrow(String time) {
    return 'Due tomorrow $time';
  }

  @override
  String opsDueOn(String date) {
    return 'Due $date';
  }

  @override
  String opsOverdueCount(int count) {
    return '$count overdue';
  }

  @override
  String opsCustomsOpenCount(int count) {
    return '$count customs open';
  }

  @override
  String opsPodWithDesk(String reference) {
    return 'Proof of delivery is with the desk to verify. KCPL marks $reference Delivered once it is checked.';
  }

  @override
  String opsExceptionOpened(String reference) {
    return 'The desk has an exception on $reference to follow up and arrange the next attempt.';
  }

  @override
  String opsSendTo(String reference) {
    return 'Send to $reference';
  }

  @override
  String opsAttemptN(int number) {
    return 'Attempt $number';
  }

  @override
  String opsSignedBy(String signer) {
    return '$signer · tap to sign again';
  }

  @override
  String opsWithinMetres(int metres) {
    return 'Within $metres m · recorded with the delivery';
  }

  @override
  String opsMineCount(int count) {
    return 'Mine · $count';
  }

  @override
  String opsAllCount(int count) {
    return 'All · $count';
  }

  @override
  String opsDirectionsTo(String place) {
    return 'Directions to $place';
  }

  @override
  String opsOutForDeliveryAttempt(int number) {
    return 'Out for delivery · attempt $number';
  }

  @override
  String opsReorder(String reference) {
    return 'Reorder $reference';
  }

  @override
  String opsSaveTo(String reference) {
    return 'Save to $reference';
  }

  @override
  String opsNowWith(String reference, String name) {
    return '$reference is now with $name.';
  }

  @override
  String get podTitle => 'Proof of delivery';

  @override
  String podReceivedBy(String name) {
    return 'Received by $name';
  }

  @override
  String podReceivedByAs(String name, String relation) {
    return 'Received by $name, $relation';
  }

  @override
  String podDelivered(String date) {
    return 'Delivered $date';
  }

  @override
  String get podChecked => 'Checked by KCPL';

  @override
  String get podSignature => 'Signature';

  @override
  String podPhoto(int number) {
    return 'Delivery photo $number';
  }

  @override
  String get podDocument => 'Delivery document';

  @override
  String get podNothingShared =>
      'KCPL checked this delivery. No signature or photos were shared.';

  @override
  String get podLoadFailed => 'Couldn\'t load';

  @override
  String get pickupTitle => 'Pickup';

  @override
  String get pickupAsk => 'KCPL picks up the cargo';

  @override
  String get pickupAskBody =>
      'Say when and where. The pickup desk confirms the time with you.';

  @override
  String get pickupDate => 'Date';

  @override
  String get pickupWindow => 'Time';

  @override
  String get pickupMorning => 'Morning';

  @override
  String get pickupAfternoon => 'Afternoon';

  @override
  String get pickupAnyTime => 'Any time';

  @override
  String get pickupAddress => 'Pickup address';

  @override
  String get pickupContactName => 'Contact person (optional)';

  @override
  String get pickupContactPhone => 'Contact phone (optional)';

  @override
  String get pickupNeedAddress => 'Enter where the cargo is to be picked up.';

  @override
  String get pickupFootnote =>
      'A request: the pickup desk schedules it once your booking is confirmed.';

  @override
  String pickupAsked(String date) {
    return 'Pickup asked for $date';
  }

  @override
  String get statementTitle => 'Account statement';

  @override
  String get statementSubtitle =>
      'PDF · owed, overdue and payments, last 12 months';

  @override
  String get statementFailed => 'The statement couldn\'t be downloaded.';

  @override
  String get textTitle => 'SMS and WhatsApp';

  @override
  String get textOff => 'Off';

  @override
  String get textSms => 'SMS';

  @override
  String get textWhatsapp => 'WhatsApp';

  @override
  String get textPhone => 'Mobile number';

  @override
  String get textPhoneHintSms => '98XXXXXXXX';

  @override
  String get textPhoneHintWhatsapp => '+977 98XXXXXXXX';

  @override
  String get textConsent =>
      'I agree to receive KCPL shipment and invoice messages on this number.';

  @override
  String get textNeedConsent => 'Tick the box to agree to these messages.';

  @override
  String get textFootnote =>
      'The same updates as your notifications, shortened to one message, for when the app isn\'t to hand. Turn off any time.';

  @override
  String get textSave => 'Save';

  @override
  String get textSaved => 'Saved';

  @override
  String docreqNeeded(String document) {
    return 'KCPL needs your $document';
  }

  @override
  String docreqResend(String document) {
    return 'KCPL needs your $document again';
  }

  @override
  String docreqBody(String reference) {
    return 'Scan it now: it goes straight to the team handling $reference.';
  }

  @override
  String docreqScan(String document) {
    return 'Scan $document';
  }

  @override
  String get docreqOther => 'Choose a photo or file instead';

  @override
  String opsAddTo(String reference) {
    return 'Add to $reference';
  }

  @override
  String opsTaskFootnote(String branch) {
    return 'For $branch. Shows on the Job File and the assignee’s task list.';
  }

  @override
  String opsCloseReference(String reference) {
    return 'Close $reference';
  }

  @override
  String opsReceivedBy(String name) {
    return 'Received by $name';
  }

  @override
  String opsProofCount(int count) {
    return '$count proof';
  }

  @override
  String opsAttemptLabel(int number, String label) {
    return 'Attempt $number · $label';
  }

  @override
  String opsPhotoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count photos',
      one: '1 photo',
    );
    return '$_temp0';
  }

  @override
  String opsCall(String name) {
    return 'Call $name';
  }

  @override
  String opsWhatsApp(String name) {
    return 'WhatsApp $name';
  }

  @override
  String opsDoneOf(String label, int done, int total) {
    return '$label · $done of $total done';
  }

  @override
  String opsVersion(String version) {
    return 'KCPL Ops $version';
  }

  @override
  String opsFinding(String query) {
    return 'Finding $query…';
  }

  @override
  String opsNoJobMatches(String query) {
    return 'No job matches $query';
  }

  @override
  String opsJobsMatch(int count, String query) {
    return '$count jobs match $query';
  }

  @override
  String opsDueTodaySummary(int count) {
    return '$count due today · your route, directions and proof';
  }

  @override
  String opsOverdueTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count overdue tasks',
      one: '1 overdue task',
    );
    return '$_temp0';
  }

  @override
  String opsCustomsBlocks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count customs blocks',
      one: '1 customs block',
    );
    return '$_temp0';
  }

  @override
  String opsDeliveringToday(int count) {
    return '$count delivering today';
  }

  @override
  String opsUnassignedCount(int count) {
    return '$count unassigned';
  }

  @override
  String opsUrgentCount(int count) {
    return '$count urgent';
  }

  @override
  String opsCustomsCount(int count) {
    return '$count customs';
  }

  @override
  String get opsLanguage => 'Language';

  @override
  String get opsSignAbove => 'Sign above the line';

  @override
  String get opsPushPrimerTitle => 'Get alerts as they happen';

  @override
  String get opsPushPrimerBody =>
      'Assignments, overdue tasks, customs and exceptions for your jobs, on this phone.';

  @override
  String get opsPushBlockedHelp =>
      'Allow notifications for KCPL Ops in your phone\'s Settings.';

  @override
  String get opsLanguageFootnote =>
      'Records (references, places, notes from the desk) stay as KCPL holds them.';
}
