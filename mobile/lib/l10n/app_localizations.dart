import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ne.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ne'),
  ];

  /// No description provided for @chromeOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get chromeOverview;

  /// No description provided for @chromeShipments.
  ///
  /// In en, this message translates to:
  /// **'Shipments'**
  String get chromeShipments;

  /// No description provided for @chromeDocuments.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get chromeDocuments;

  /// No description provided for @chromeInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get chromeInvoices;

  /// No description provided for @chromeSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get chromeSettings;

  /// No description provided for @chromeAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get chromeAccount;

  /// No description provided for @chromeAccountSwitchFailed.
  ///
  /// In en, this message translates to:
  /// **'That account could not be opened.'**
  String get chromeAccountSwitchFailed;

  /// No description provided for @chromePublicSite.
  ///
  /// In en, this message translates to:
  /// **'Public website'**
  String get chromePublicSite;

  /// No description provided for @commonShipment.
  ///
  /// In en, this message translates to:
  /// **'Shipment'**
  String get commonShipment;

  /// No description provided for @commonRoute.
  ///
  /// In en, this message translates to:
  /// **'Route'**
  String get commonRoute;

  /// No description provided for @commonStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get commonStatus;

  /// No description provided for @commonDocuments.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get commonDocuments;

  /// No description provided for @commonUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated'**
  String get commonUpdated;

  /// No description provided for @commonDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get commonDownload;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get commonLoading;

  /// No description provided for @commonUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'This information is temporarily unavailable'**
  String get commonUnavailableTitle;

  /// No description provided for @commonUnavailableDetail.
  ///
  /// In en, this message translates to:
  /// **'KCPL\'s systems could not be reached. Please try again in a moment, or contact your account manager.'**
  String get commonUnavailableDetail;

  /// No description provided for @statusBookingConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Booking confirmed'**
  String get statusBookingConfirmed;

  /// No description provided for @statusPreparing.
  ///
  /// In en, this message translates to:
  /// **'Preparing'**
  String get statusPreparing;

  /// No description provided for @statusInTransit.
  ///
  /// In en, this message translates to:
  /// **'In transit'**
  String get statusInTransit;

  /// No description provided for @statusCustomsClearance.
  ///
  /// In en, this message translates to:
  /// **'Customs clearance'**
  String get statusCustomsClearance;

  /// No description provided for @statusOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get statusOutForDelivery;

  /// No description provided for @statusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get statusDelivered;

  /// No description provided for @statusException.
  ///
  /// In en, this message translates to:
  /// **'Exception'**
  String get statusException;

  /// No description provided for @statusUnknown.
  ///
  /// In en, this message translates to:
  /// **'Shipment update'**
  String get statusUnknown;

  /// No description provided for @modeAir.
  ///
  /// In en, this message translates to:
  /// **'Air freight'**
  String get modeAir;

  /// No description provided for @modeSea.
  ///
  /// In en, this message translates to:
  /// **'Sea freight'**
  String get modeSea;

  /// No description provided for @modeRoad.
  ///
  /// In en, this message translates to:
  /// **'Road freight'**
  String get modeRoad;

  /// No description provided for @modeUnsure.
  ///
  /// In en, this message translates to:
  /// **'Freight movement'**
  String get modeUnsure;

  /// No description provided for @invoiceIssued.
  ///
  /// In en, this message translates to:
  /// **'Issued'**
  String get invoiceIssued;

  /// No description provided for @invoicePartiallyPaid.
  ///
  /// In en, this message translates to:
  /// **'Part paid'**
  String get invoicePartiallyPaid;

  /// No description provided for @invoicePaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get invoicePaid;

  /// No description provided for @invoiceOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get invoiceOverdue;

  /// No description provided for @invoiceOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get invoiceOpen;

  /// No description provided for @freeTimeLabel.
  ///
  /// In en, this message translates to:
  /// **'Free time'**
  String get freeTimeLabel;

  /// No description provided for @freeTimeDeadline.
  ///
  /// In en, this message translates to:
  /// **'Last free day'**
  String get freeTimeDeadline;

  /// No description provided for @freeTimeConsequence.
  ///
  /// In en, this message translates to:
  /// **'Once free time ends, the carrier or terminal may charge storage and demurrage for each day the cargo stays.'**
  String get freeTimeConsequence;

  /// No description provided for @ftsNotSet.
  ///
  /// In en, this message translates to:
  /// **'No free-time allowance recorded.'**
  String get ftsNotSet;

  /// No description provided for @ftsExpiredYesterday.
  ///
  /// In en, this message translates to:
  /// **'Free time ended yesterday. Charges may now apply.'**
  String get ftsExpiredYesterday;

  /// No description provided for @ftsExpiredYesterdayAt.
  ///
  /// In en, this message translates to:
  /// **'Free time at {location} ended yesterday. Charges may now apply.'**
  String ftsExpiredYesterdayAt(String location);

  /// No description provided for @ftsExpiredDays.
  ///
  /// In en, this message translates to:
  /// **'Free time ended {days} days ago. Charges may now apply.'**
  String ftsExpiredDays(String days);

  /// No description provided for @ftsExpiredDaysAt.
  ///
  /// In en, this message translates to:
  /// **'Free time at {location} ended {days} days ago. Charges may now apply.'**
  String ftsExpiredDaysAt(String location, String days);

  /// No description provided for @ftsLastDay.
  ///
  /// In en, this message translates to:
  /// **'Today is the last free day.'**
  String get ftsLastDay;

  /// No description provided for @ftsLastDayAt.
  ///
  /// In en, this message translates to:
  /// **'Today is the last free day at {location}.'**
  String ftsLastDayAt(String location);

  /// No description provided for @ftsOneDay.
  ///
  /// In en, this message translates to:
  /// **'1 free day left.'**
  String get ftsOneDay;

  /// No description provided for @ftsOneDayAt.
  ///
  /// In en, this message translates to:
  /// **'1 free day left at {location}.'**
  String ftsOneDayAt(String location);

  /// No description provided for @ftsDays.
  ///
  /// In en, this message translates to:
  /// **'{days} free days left.'**
  String ftsDays(String days);

  /// No description provided for @ftsDaysAt.
  ///
  /// In en, this message translates to:
  /// **'{days} free days left at {location}.'**
  String ftsDaysAt(String days, String location);

  /// No description provided for @roleOwner.
  ///
  /// In en, this message translates to:
  /// **'Account owner'**
  String get roleOwner;

  /// No description provided for @roleMember.
  ///
  /// In en, this message translates to:
  /// **'Team member'**
  String get roleMember;

  /// No description provided for @docAirWaybill.
  ///
  /// In en, this message translates to:
  /// **'Air waybill (AWB)'**
  String get docAirWaybill;

  /// No description provided for @docBillOfLading.
  ///
  /// In en, this message translates to:
  /// **'Bill of lading (BL)'**
  String get docBillOfLading;

  /// No description provided for @docRoadConsignmentNote.
  ///
  /// In en, this message translates to:
  /// **'Road consignment note'**
  String get docRoadConsignmentNote;

  /// No description provided for @docShippingInstruction.
  ///
  /// In en, this message translates to:
  /// **'Shipping instruction'**
  String get docShippingInstruction;

  /// No description provided for @docCargoManifest.
  ///
  /// In en, this message translates to:
  /// **'Cargo manifest'**
  String get docCargoManifest;

  /// No description provided for @docPickupOrder.
  ///
  /// In en, this message translates to:
  /// **'Pickup order'**
  String get docPickupOrder;

  /// No description provided for @docCommercialInvoice.
  ///
  /// In en, this message translates to:
  /// **'Commercial invoice'**
  String get docCommercialInvoice;

  /// No description provided for @docPackingList.
  ///
  /// In en, this message translates to:
  /// **'Packing list'**
  String get docPackingList;

  /// No description provided for @docCustomsDocument.
  ///
  /// In en, this message translates to:
  /// **'Customs document'**
  String get docCustomsDocument;

  /// No description provided for @docCertificateOfOrigin.
  ///
  /// In en, this message translates to:
  /// **'Certificate of origin'**
  String get docCertificateOfOrigin;

  /// No description provided for @docImportPermit.
  ///
  /// In en, this message translates to:
  /// **'Import permit / licence'**
  String get docImportPermit;

  /// No description provided for @docExportPermit.
  ///
  /// In en, this message translates to:
  /// **'Export permit / licence'**
  String get docExportPermit;

  /// No description provided for @docDangerousGoodsDeclaration.
  ///
  /// In en, this message translates to:
  /// **'Dangerous goods declaration'**
  String get docDangerousGoodsDeclaration;

  /// No description provided for @docInsuranceCertificate.
  ///
  /// In en, this message translates to:
  /// **'Cargo insurance certificate'**
  String get docInsuranceCertificate;

  /// No description provided for @docDeliveryOrder.
  ///
  /// In en, this message translates to:
  /// **'Delivery order'**
  String get docDeliveryOrder;

  /// No description provided for @docProofOfDelivery.
  ///
  /// In en, this message translates to:
  /// **'Proof of delivery (POD)'**
  String get docProofOfDelivery;

  /// No description provided for @docOther.
  ///
  /// In en, this message translates to:
  /// **'Other document'**
  String get docOther;

  /// No description provided for @docUnknown.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get docUnknown;

  /// No description provided for @overviewDescription.
  ///
  /// In en, this message translates to:
  /// **'Your live shipments, released documents and account position with KCPL.'**
  String get overviewDescription;

  /// No description provided for @overviewKpiActive.
  ///
  /// In en, this message translates to:
  /// **'Active shipments'**
  String get overviewKpiActive;

  /// No description provided for @overviewKpiInTransit.
  ///
  /// In en, this message translates to:
  /// **'In transit'**
  String get overviewKpiInTransit;

  /// No description provided for @overviewKpiArriving.
  ///
  /// In en, this message translates to:
  /// **'Arriving in 7 days'**
  String get overviewKpiArriving;

  /// No description provided for @overviewKpiFreeTime.
  ///
  /// In en, this message translates to:
  /// **'Free time running out'**
  String get overviewKpiFreeTime;

  /// No description provided for @overviewKpiDocuments.
  ///
  /// In en, this message translates to:
  /// **'Documents needed'**
  String get overviewKpiDocuments;

  /// No description provided for @overviewKpiAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs attention'**
  String get overviewKpiAttention;

  /// No description provided for @overviewFreeTimeTitle.
  ///
  /// In en, this message translates to:
  /// **'Free time running out'**
  String get overviewFreeTimeTitle;

  /// No description provided for @overviewFreeTimeDescription.
  ///
  /// In en, this message translates to:
  /// **'Storage and demurrage start when the carrier\'s free days end. Clearing the cargo before then avoids the charge.'**
  String get overviewFreeTimeDescription;

  /// No description provided for @overviewOutstandingTitle.
  ///
  /// In en, this message translates to:
  /// **'Paperwork KCPL is waiting on'**
  String get overviewOutstandingTitle;

  /// No description provided for @overviewOutstandingDescription.
  ///
  /// In en, this message translates to:
  /// **'Send these from the shipment so KCPL can keep the cargo moving.'**
  String get overviewOutstandingDescription;

  /// No description provided for @overviewAccountTitle.
  ///
  /// In en, this message translates to:
  /// **'Outstanding with KCPL'**
  String get overviewAccountTitle;

  /// No description provided for @overviewOpenInvoicesOne.
  ///
  /// In en, this message translates to:
  /// **'1 open invoice'**
  String get overviewOpenInvoicesOne;

  /// No description provided for @overviewOpenInvoices.
  ///
  /// In en, this message translates to:
  /// **'{count} open invoices'**
  String overviewOpenInvoices(String count);

  /// No description provided for @overviewOverdueCount.
  ///
  /// In en, this message translates to:
  /// **'{count} overdue'**
  String overviewOverdueCount(String count);

  /// No description provided for @overviewCurrencyOutstanding.
  ///
  /// In en, this message translates to:
  /// **'{currency} outstanding'**
  String overviewCurrencyOutstanding(String currency);

  /// No description provided for @overviewAmountOverdue.
  ///
  /// In en, this message translates to:
  /// **'{amount} overdue'**
  String overviewAmountOverdue(String amount);

  /// No description provided for @overviewNothingOverdue.
  ///
  /// In en, this message translates to:
  /// **'Nothing overdue'**
  String get overviewNothingOverdue;

  /// No description provided for @overviewMovementsTitle.
  ///
  /// In en, this message translates to:
  /// **'Active shipments'**
  String get overviewMovementsTitle;

  /// No description provided for @overviewAllShipments.
  ///
  /// In en, this message translates to:
  /// **'All shipments'**
  String get overviewAllShipments;

  /// No description provided for @overviewNowAt.
  ///
  /// In en, this message translates to:
  /// **'Now at {location}'**
  String overviewNowAt(String location);

  /// No description provided for @overviewEmptyDeliveredTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing in transit right now'**
  String get overviewEmptyDeliveredTitle;

  /// No description provided for @overviewEmptyDeliveredDescription.
  ///
  /// In en, this message translates to:
  /// **'Every movement on your account has been delivered. Completed shipments stay available under Shipments.'**
  String get overviewEmptyDeliveredDescription;

  /// No description provided for @overviewEmptyNoneTitle.
  ///
  /// In en, this message translates to:
  /// **'No shipments yet'**
  String get overviewEmptyNoneTitle;

  /// No description provided for @overviewEmptyNoneDescription.
  ///
  /// In en, this message translates to:
  /// **'Once KCPL books your first shipment it will appear here with live milestones.'**
  String get overviewEmptyNoneDescription;

  /// No description provided for @overviewPaperworkTitle.
  ///
  /// In en, this message translates to:
  /// **'Recently released documents'**
  String get overviewPaperworkTitle;

  /// No description provided for @overviewAllDocuments.
  ///
  /// In en, this message translates to:
  /// **'All documents'**
  String get overviewAllDocuments;

  /// No description provided for @overviewNoDocumentsTitle.
  ///
  /// In en, this message translates to:
  /// **'No documents released yet'**
  String get overviewNoDocumentsTitle;

  /// No description provided for @overviewNoDocumentsDescription.
  ///
  /// In en, this message translates to:
  /// **'Bills of lading, air waybills and customs paperwork appear here once KCPL releases them to your account.'**
  String get overviewNoDocumentsDescription;

  /// No description provided for @overviewViewInvoices.
  ///
  /// In en, this message translates to:
  /// **'View invoices'**
  String get overviewViewInvoices;

  /// No description provided for @overviewOrigin.
  ///
  /// In en, this message translates to:
  /// **'Origin'**
  String get overviewOrigin;

  /// No description provided for @overviewDestination.
  ///
  /// In en, this message translates to:
  /// **'Destination'**
  String get overviewDestination;

  /// No description provided for @overviewColEta.
  ///
  /// In en, this message translates to:
  /// **'ETA'**
  String get overviewColEta;

  /// No description provided for @shipsFocusAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get shipsFocusAll;

  /// No description provided for @shipsFocusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get shipsFocusActive;

  /// No description provided for @shipsFocusInTransit.
  ///
  /// In en, this message translates to:
  /// **'In transit'**
  String get shipsFocusInTransit;

  /// No description provided for @shipsFocusAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs attention'**
  String get shipsFocusAttention;

  /// No description provided for @shipsFocusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get shipsFocusDelivered;

  /// No description provided for @shipsSearchPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Search reference, route or carrier…'**
  String get shipsSearchPlaceholder;

  /// No description provided for @shipsEmptyFilteredTitle.
  ///
  /// In en, this message translates to:
  /// **'No shipments match this view'**
  String get shipsEmptyFilteredTitle;

  /// No description provided for @shipsEmptyFilteredDescription.
  ///
  /// In en, this message translates to:
  /// **'Try a different filter or clear the search.'**
  String get shipsEmptyFilteredDescription;

  /// No description provided for @shipsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No shipments yet'**
  String get shipsEmptyTitle;

  /// No description provided for @shipsEmptyDescription.
  ///
  /// In en, this message translates to:
  /// **'Once KCPL books a shipment for your account it appears here with its milestones and documents.'**
  String get shipsEmptyDescription;

  /// No description provided for @docsCoverage.
  ///
  /// In en, this message translates to:
  /// **'Covering your {scanned} most recent shipments of {total}'**
  String docsCoverage(String scanned, String total);

  /// No description provided for @docsAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get docsAll;

  /// No description provided for @docsFromKcpl.
  ///
  /// In en, this message translates to:
  /// **'From KCPL'**
  String get docsFromKcpl;

  /// No description provided for @docsSentByYou.
  ///
  /// In en, this message translates to:
  /// **'Sent by you'**
  String get docsSentByYou;

  /// No description provided for @docsStateConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get docsStateConfirmed;

  /// No description provided for @docsStateResend.
  ///
  /// In en, this message translates to:
  /// **'Send again'**
  String get docsStateResend;

  /// No description provided for @docsStateWithKcpl.
  ///
  /// In en, this message translates to:
  /// **'With KCPL'**
  String get docsStateWithKcpl;

  /// No description provided for @docsEmptyFilteredTitle.
  ///
  /// In en, this message translates to:
  /// **'No documents match this view'**
  String get docsEmptyFilteredTitle;

  /// No description provided for @docsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No documents yet'**
  String get docsEmptyTitle;

  /// No description provided for @docsEmptyDescription.
  ///
  /// In en, this message translates to:
  /// **'Paperwork KCPL releases to you, and anything you send from a shipment, is listed here.'**
  String get docsEmptyDescription;

  /// No description provided for @docsSearchPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Search file name, type or shipment…'**
  String get docsSearchPlaceholder;

  /// No description provided for @invPositionTitle.
  ///
  /// In en, this message translates to:
  /// **'Balances'**
  String get invPositionTitle;

  /// No description provided for @invPositionDescription.
  ///
  /// In en, this message translates to:
  /// **'Totals are grouped by the currency each invoice was issued in; KCPL does not convert between them here.'**
  String get invPositionDescription;

  /// No description provided for @invInvoicedReceipted.
  ///
  /// In en, this message translates to:
  /// **'{invoiced} invoiced · {paid} receipted'**
  String invInvoicedReceipted(String invoiced, String paid);

  /// No description provided for @invBillingTitle.
  ///
  /// In en, this message translates to:
  /// **'Issued invoices'**
  String get invBillingTitle;

  /// No description provided for @invColIssued.
  ///
  /// In en, this message translates to:
  /// **'Issued'**
  String get invColIssued;

  /// No description provided for @invColDue.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get invColDue;

  /// No description provided for @invColTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get invColTotal;

  /// No description provided for @invColPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get invColPaid;

  /// No description provided for @invColBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get invColBalance;

  /// No description provided for @invOpeningBalance.
  ///
  /// In en, this message translates to:
  /// **'Opening balance'**
  String get invOpeningBalance;

  /// No description provided for @invEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No invoices issued'**
  String get invEmptyTitle;

  /// No description provided for @invEmptyDescription.
  ///
  /// In en, this message translates to:
  /// **'Invoices appear here once KCPL issues them against your account.'**
  String get invEmptyDescription;

  /// No description provided for @invFootnote.
  ///
  /// In en, this message translates to:
  /// **'Payment references, bank details and credit terms are confirmed by KCPL accounts. Contact your account manager if an invoice needs to be reissued or a payment is not yet reflected here.'**
  String get invFootnote;

  /// No description provided for @invdStatement.
  ///
  /// In en, this message translates to:
  /// **'Statement'**
  String get invdStatement;

  /// No description provided for @invdColCharge.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get invdColCharge;

  /// No description provided for @invdColQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get invdColQuantity;

  /// No description provided for @invdColUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit price'**
  String get invdColUnitPrice;

  /// No description provided for @invdNoLinesTitle.
  ///
  /// In en, this message translates to:
  /// **'No itemised charges'**
  String get invdNoLinesTitle;

  /// No description provided for @invdNoLinesDescription.
  ///
  /// In en, this message translates to:
  /// **'This invoice carries a total without a line breakdown.'**
  String get invdNoLinesDescription;

  /// No description provided for @invdSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get invdSubtotal;

  /// No description provided for @invdTax.
  ///
  /// In en, this message translates to:
  /// **'Tax'**
  String get invdTax;

  /// No description provided for @invdReceipted.
  ///
  /// In en, this message translates to:
  /// **'Receipted'**
  String get invdReceipted;

  /// No description provided for @invdBalanceDue.
  ///
  /// In en, this message translates to:
  /// **'Balance due'**
  String get invdBalanceDue;

  /// No description provided for @invdIssuedOn.
  ///
  /// In en, this message translates to:
  /// **'Issued {date}'**
  String invdIssuedOn(String date);

  /// No description provided for @invdDueOn.
  ///
  /// In en, this message translates to:
  /// **'Due {date}'**
  String invdDueOn(String date);

  /// No description provided for @invdNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Invoice not found'**
  String get invdNotFoundTitle;

  /// No description provided for @invdNotFoundDescription.
  ///
  /// In en, this message translates to:
  /// **'Open it from your invoice list instead.'**
  String get invdNotFoundDescription;

  /// No description provided for @invdNoAccessTitle.
  ///
  /// In en, this message translates to:
  /// **'Account billing is not shared with this login'**
  String get invdNoAccessTitle;

  /// No description provided for @invdNoAccessDescription.
  ///
  /// In en, this message translates to:
  /// **'Ask your account owner or KCPL account manager if you also need invoice access.'**
  String get invdNoAccessDescription;

  /// No description provided for @shipNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Shipment not found'**
  String get shipNotFoundTitle;

  /// No description provided for @shipNotFoundDescription.
  ///
  /// In en, this message translates to:
  /// **'Check the reference, or open the shipment from your list.'**
  String get shipNotFoundDescription;

  /// No description provided for @shipOpened.
  ///
  /// In en, this message translates to:
  /// **'Opened {date}'**
  String shipOpened(String date);

  /// No description provided for @shipLastUpdate.
  ///
  /// In en, this message translates to:
  /// **'Last update {when}'**
  String shipLastUpdate(String when);

  /// No description provided for @shipFreeTimeExpiredDescription.
  ///
  /// In en, this message translates to:
  /// **'Storage or demurrage charges may be accruing on this cargo.'**
  String get shipFreeTimeExpiredDescription;

  /// No description provided for @shipFreeTimeDescription.
  ///
  /// In en, this message translates to:
  /// **'Clearing the cargo before this date avoids storage and demurrage charges.'**
  String get shipFreeTimeDescription;

  /// No description provided for @shipLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get shipLocation;

  /// No description provided for @shipAsAdvised.
  ///
  /// In en, this message translates to:
  /// **'As advised'**
  String get shipAsAdvised;

  /// No description provided for @shipDaysOverdue.
  ///
  /// In en, this message translates to:
  /// **'Days overdue'**
  String get shipDaysOverdue;

  /// No description provided for @shipDaysRemaining.
  ///
  /// In en, this message translates to:
  /// **'Days remaining'**
  String get shipDaysRemaining;

  /// No description provided for @shipChargeAfterExpiry.
  ///
  /// In en, this message translates to:
  /// **'Charge after expiry'**
  String get shipChargeAfterExpiry;

  /// No description provided for @shipPerDay.
  ///
  /// In en, this message translates to:
  /// **'{currency} {amount} per day'**
  String shipPerDay(String currency, String amount);

  /// No description provided for @shipAllowance.
  ///
  /// In en, this message translates to:
  /// **'Allowance'**
  String get shipAllowance;

  /// No description provided for @shipAllowanceDays.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String shipAllowanceDays(String days);

  /// No description provided for @shipFreeTimeFootnote.
  ///
  /// In en, this message translates to:
  /// **'Free days are granted by the carrier or terminal. Contact your KCPL account manager if you need an extension.'**
  String get shipFreeTimeFootnote;

  /// No description provided for @shipMovementTitle.
  ///
  /// In en, this message translates to:
  /// **'Shipment details'**
  String get shipMovementTitle;

  /// No description provided for @shipMode.
  ///
  /// In en, this message translates to:
  /// **'Mode'**
  String get shipMode;

  /// No description provided for @shipCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Current location'**
  String get shipCurrentLocation;

  /// No description provided for @shipNotReported.
  ///
  /// In en, this message translates to:
  /// **'Not reported'**
  String get shipNotReported;

  /// No description provided for @shipEta.
  ///
  /// In en, this message translates to:
  /// **'Estimated arrival'**
  String get shipEta;

  /// No description provided for @shipCarrierReference.
  ///
  /// In en, this message translates to:
  /// **'Carrier reference'**
  String get shipCarrierReference;

  /// No description provided for @shipToBeConfirmed.
  ///
  /// In en, this message translates to:
  /// **'To be confirmed'**
  String get shipToBeConfirmed;

  /// No description provided for @shipMilestonesTitle.
  ///
  /// In en, this message translates to:
  /// **'Milestones'**
  String get shipMilestonesTitle;

  /// No description provided for @shipNoMilestonesTitle.
  ///
  /// In en, this message translates to:
  /// **'No milestones recorded yet'**
  String get shipNoMilestonesTitle;

  /// No description provided for @shipNoMilestonesDescription.
  ///
  /// In en, this message translates to:
  /// **'Updates appear here as KCPL progresses the shipment.'**
  String get shipNoMilestonesDescription;

  /// No description provided for @shipDocumentsDescription.
  ///
  /// In en, this message translates to:
  /// **'Documents KCPL has released to you, and the ones you have sent.'**
  String get shipDocumentsDescription;

  /// No description provided for @shipNoDocumentsTitle.
  ///
  /// In en, this message translates to:
  /// **'No documents yet'**
  String get shipNoDocumentsTitle;

  /// No description provided for @shipNoDocumentsDescription.
  ///
  /// In en, this message translates to:
  /// **'Documents KCPL releases to you, and anything you send, will be listed here.'**
  String get shipNoDocumentsDescription;

  /// No description provided for @shipsColCarrier.
  ///
  /// In en, this message translates to:
  /// **'Carrier'**
  String get shipsColCarrier;

  /// No description provided for @topicShipmentUpdates.
  ///
  /// In en, this message translates to:
  /// **'Shipment milestones'**
  String get topicShipmentUpdates;

  /// No description provided for @topicDocuments.
  ///
  /// In en, this message translates to:
  /// **'Document requests and releases'**
  String get topicDocuments;

  /// No description provided for @topicFreeTime.
  ///
  /// In en, this message translates to:
  /// **'Free time running out'**
  String get topicFreeTime;

  /// No description provided for @topicInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices coming due'**
  String get topicInvoices;

  /// No description provided for @topicShipmentUpdatesHint.
  ///
  /// In en, this message translates to:
  /// **'When a shipment is booked, moves, clears customs, is out for delivery or is delivered.'**
  String get topicShipmentUpdatesHint;

  /// No description provided for @topicDocumentsHint.
  ///
  /// In en, this message translates to:
  /// **'When KCPL needs paperwork from you, or releases a document to your account.'**
  String get topicDocumentsHint;

  /// No description provided for @topicFreeTimeHint.
  ///
  /// In en, this message translates to:
  /// **'Before storage or demurrage charges start on cargo at a port or depot.'**
  String get topicFreeTimeHint;

  /// No description provided for @topicInvoicesHint.
  ///
  /// In en, this message translates to:
  /// **'Three days before an invoice is due, and if it becomes overdue.'**
  String get topicInvoicesHint;

  /// No description provided for @settingsEmailTitle.
  ///
  /// In en, this message translates to:
  /// **'What we send you'**
  String get settingsEmailTitle;

  /// No description provided for @settingsEmailDescription.
  ///
  /// In en, this message translates to:
  /// **'Milestones are sent as they happen, not as a digest.'**
  String get settingsEmailDescription;

  /// No description provided for @settingsSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'The change could not be saved.'**
  String get settingsSaveFailed;

  /// No description provided for @reqQuotesTitle.
  ///
  /// In en, this message translates to:
  /// **'Quotes issued to you'**
  String get reqQuotesTitle;

  /// No description provided for @reqQuotesDescription.
  ///
  /// In en, this message translates to:
  /// **'Prices KCPL has confirmed. Ask to proceed and your account manager will convert the quote into a booking.'**
  String get reqQuotesDescription;

  /// No description provided for @reqColQuote.
  ///
  /// In en, this message translates to:
  /// **'Quote'**
  String get reqColQuote;

  /// No description provided for @reqColValid.
  ///
  /// In en, this message translates to:
  /// **'Valid until'**
  String get reqColValid;

  /// No description provided for @reqAskToProceed.
  ///
  /// In en, this message translates to:
  /// **'Ask to proceed'**
  String get reqAskToProceed;

  /// No description provided for @reqNoQuotesTitle.
  ///
  /// In en, this message translates to:
  /// **'No quotes yet'**
  String get reqNoQuotesTitle;

  /// No description provided for @reqNoQuotesDescription.
  ///
  /// In en, this message translates to:
  /// **'Quotes KCPL issues to your account appear here with their price and validity.'**
  String get reqNoQuotesDescription;

  /// No description provided for @reqProgressTitle.
  ///
  /// In en, this message translates to:
  /// **'Requests KCPL is working on'**
  String get reqProgressTitle;

  /// No description provided for @reqProgressDescription.
  ///
  /// In en, this message translates to:
  /// **'Requests that have not been priced yet.'**
  String get reqProgressDescription;

  /// No description provided for @reqBookingSent.
  ///
  /// In en, this message translates to:
  /// **'KCPL has been notified that you want to proceed with {reference}.'**
  String reqBookingSent(String reference);

  /// No description provided for @reqBookingFailed.
  ///
  /// In en, this message translates to:
  /// **'The booking request could not be sent.'**
  String get reqBookingFailed;

  /// No description provided for @reqRaisedOn.
  ///
  /// In en, this message translates to:
  /// **'Raised {date}'**
  String reqRaisedOn(String date);

  /// No description provided for @reqNothingWaitingTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing waiting'**
  String get reqNothingWaitingTitle;

  /// No description provided for @reqNothingWaitingDescription.
  ///
  /// In en, this message translates to:
  /// **'Every request you have raised has been priced.'**
  String get reqNothingWaitingDescription;

  /// No description provided for @xchgTitle.
  ///
  /// In en, this message translates to:
  /// **'What KCPL needs from you'**
  String get xchgTitle;

  /// No description provided for @xchgStateNeeded.
  ///
  /// In en, this message translates to:
  /// **'Needed'**
  String get xchgStateNeeded;

  /// No description provided for @xchgStateResend.
  ///
  /// In en, this message translates to:
  /// **'Send again'**
  String get xchgStateResend;

  /// No description provided for @xchgStateWithKcpl.
  ///
  /// In en, this message translates to:
  /// **'With KCPL'**
  String get xchgStateWithKcpl;

  /// No description provided for @xchgStateConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get xchgStateConfirmed;

  /// No description provided for @settingsLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguage;

  /// No description provided for @settingsSignedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as'**
  String get settingsSignedInAs;

  /// No description provided for @settingsAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get settingsAccount;

  /// No description provided for @settingsAccessLevel.
  ///
  /// In en, this message translates to:
  /// **'Access level'**
  String get settingsAccessLevel;

  /// No description provided for @settingsProvisioningNote.
  ///
  /// In en, this message translates to:
  /// **'Your KCPL account manager provisions and removes portal logins. Contact them to add a colleague or change what this login can see.'**
  String get settingsProvisioningNote;

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'KCPL'**
  String get appTitle;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to KCPL'**
  String get signInTitle;

  /// No description provided for @signInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your shipments, documents and invoices with Kapileshwor Cargo.'**
  String get signInSubtitle;

  /// No description provided for @emailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get emailLabel;

  /// No description provided for @passwordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordLabel;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @signingIn.
  ///
  /// In en, this message translates to:
  /// **'Signing in…'**
  String get signingIn;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgotPassword;

  /// No description provided for @resetNeedsEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address first, then choose Forgot password.'**
  String get resetNeedsEmail;

  /// No description provided for @resetSent.
  ///
  /// In en, this message translates to:
  /// **'If that address has KCPL portal access, a password reset link is on its way.'**
  String get resetSent;

  /// No description provided for @signInFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign-in failed. Check your details and try again.'**
  String get signInFailed;

  /// No description provided for @tooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Wait a few minutes and try again.'**
  String get tooManyAttempts;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'KCPL could not be reached. Check your connection and try again.'**
  String get networkError;

  /// No description provided for @sessionEnded.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Sign in again.'**
  String get sessionEnded;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @switchAccount.
  ///
  /// In en, this message translates to:
  /// **'Switch account'**
  String get switchAccount;

  /// No description provided for @downloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading…'**
  String get downloading;

  /// No description provided for @downloadFailed.
  ///
  /// In en, this message translates to:
  /// **'The document could not be downloaded.'**
  String get downloadFailed;

  /// No description provided for @documentSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved {filename}'**
  String documentSaved(String filename);

  /// No description provided for @helpContact.
  ///
  /// In en, this message translates to:
  /// **'Need help? Contact your KCPL account manager.'**
  String get helpContact;

  /// No description provided for @demoBanner.
  ///
  /// In en, this message translates to:
  /// **'Demo data, not a real account'**
  String get demoBanner;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String appVersion(String version);

  /// No description provided for @modeRail.
  ///
  /// In en, this message translates to:
  /// **'Rail freight'**
  String get modeRail;

  /// No description provided for @modeCourier.
  ///
  /// In en, this message translates to:
  /// **'Courier'**
  String get modeCourier;

  /// No description provided for @modeMultimodal.
  ///
  /// In en, this message translates to:
  /// **'Multimodal'**
  String get modeMultimodal;

  /// No description provided for @pushPrimerTitle.
  ///
  /// In en, this message translates to:
  /// **'Know the moment your cargo moves'**
  String get pushPrimerTitle;

  /// No description provided for @pushPrimerBody.
  ///
  /// In en, this message translates to:
  /// **'Get a notification when a shipment moves, a document is ready or free time is running out.'**
  String get pushPrimerBody;

  /// No description provided for @pushTurnOn.
  ///
  /// In en, this message translates to:
  /// **'Turn on'**
  String get pushTurnOn;

  /// No description provided for @pushNotNow.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get pushNotNow;

  /// No description provided for @pushSection.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get pushSection;

  /// No description provided for @pushSetting.
  ///
  /// In en, this message translates to:
  /// **'Push notifications'**
  String get pushSetting;

  /// No description provided for @pushOn.
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get pushOn;

  /// No description provided for @pushOff.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get pushOff;

  /// No description provided for @pushBlocked.
  ///
  /// In en, this message translates to:
  /// **'Blocked in your phone\'s Settings'**
  String get pushBlocked;

  /// No description provided for @pushUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Not available in this build'**
  String get pushUnavailable;

  /// No description provided for @pushBlockedHelp.
  ///
  /// In en, this message translates to:
  /// **'Allow notifications for KCPL in your phone\'s Settings.'**
  String get pushBlockedHelp;

  /// No description provided for @homeOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{Nothing on the way} =1{1 shipment on the way} other{{count} shipments on the way}}'**
  String homeOnTheWay(int count);

  /// No description provided for @homeNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 needs attention} other{{count} need attention}}'**
  String homeNeedsAttention(int count);

  /// No description provided for @homeArriving.
  ///
  /// In en, this message translates to:
  /// **'{count} arriving this week'**
  String homeArriving(int count);

  /// No description provided for @homeAllClear.
  ///
  /// In en, this message translates to:
  /// **'Everything is moving as planned'**
  String get homeAllClear;

  /// No description provided for @homeNeedsYou.
  ///
  /// In en, this message translates to:
  /// **'Needs you'**
  String get homeNeedsYou;

  /// No description provided for @quoteWhereTo.
  ///
  /// In en, this message translates to:
  /// **'Where is your cargo going?'**
  String get quoteWhereTo;

  /// No description provided for @quoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Get a quote'**
  String get quoteTitle;

  /// No description provided for @quoteFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get quoteFrom;

  /// No description provided for @quoteFromHint.
  ///
  /// In en, this message translates to:
  /// **'Pickup city, port or border'**
  String get quoteFromHint;

  /// No description provided for @quoteTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get quoteTo;

  /// No description provided for @quoteToHint.
  ///
  /// In en, this message translates to:
  /// **'Where it should arrive'**
  String get quoteToHint;

  /// No description provided for @quoteYourRoutes.
  ///
  /// In en, this message translates to:
  /// **'Your routes'**
  String get quoteYourRoutes;

  /// No description provided for @quoteModeTitle.
  ///
  /// In en, this message translates to:
  /// **'How should it travel?'**
  String get quoteModeTitle;

  /// No description provided for @quoteModeRoad.
  ///
  /// In en, this message translates to:
  /// **'Road'**
  String get quoteModeRoad;

  /// No description provided for @quoteModeRoadDetail.
  ///
  /// In en, this message translates to:
  /// **'Overland, through the India and China borders'**
  String get quoteModeRoadDetail;

  /// No description provided for @quoteModeSea.
  ///
  /// In en, this message translates to:
  /// **'Sea'**
  String get quoteModeSea;

  /// No description provided for @quoteModeSeaDetail.
  ///
  /// In en, this message translates to:
  /// **'Via Kolkata, Haldia or Vizag, for the largest loads'**
  String get quoteModeSeaDetail;

  /// No description provided for @quoteModeAir.
  ///
  /// In en, this message translates to:
  /// **'Air'**
  String get quoteModeAir;

  /// No description provided for @quoteModeAirDetail.
  ///
  /// In en, this message translates to:
  /// **'Fastest, into Kathmandu (TIA)'**
  String get quoteModeAirDetail;

  /// No description provided for @quoteModeUnsure.
  ///
  /// In en, this message translates to:
  /// **'Let KCPL advise'**
  String get quoteModeUnsure;

  /// No description provided for @quoteModeUnsureDetail.
  ///
  /// In en, this message translates to:
  /// **'We will suggest the best way for your cargo'**
  String get quoteModeUnsureDetail;

  /// No description provided for @quoteCargoTitle.
  ///
  /// In en, this message translates to:
  /// **'Cargo'**
  String get quoteCargoTitle;

  /// No description provided for @quoteCargoHint.
  ///
  /// In en, this message translates to:
  /// **'What is it? Garments, machinery…'**
  String get quoteCargoHint;

  /// No description provided for @quoteWeightHint.
  ///
  /// In en, this message translates to:
  /// **'Weight (optional)'**
  String get quoteWeightHint;

  /// No description provided for @quoteWhenTitle.
  ///
  /// In en, this message translates to:
  /// **'When'**
  String get quoteWhenTitle;

  /// No description provided for @quoteWhenSoon.
  ///
  /// In en, this message translates to:
  /// **'As soon as possible'**
  String get quoteWhenSoon;

  /// No description provided for @quoteWhenWeeks.
  ///
  /// In en, this message translates to:
  /// **'Within 2 weeks'**
  String get quoteWhenWeeks;

  /// No description provided for @quoteWhenMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get quoteWhenMonth;

  /// No description provided for @quoteWhenFlexible.
  ///
  /// In en, this message translates to:
  /// **'Flexible'**
  String get quoteWhenFlexible;

  /// No description provided for @quoteNotesTitle.
  ///
  /// In en, this message translates to:
  /// **'Anything else'**
  String get quoteNotesTitle;

  /// No description provided for @quoteNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Dimensions, packaging, Incoterms, special handling'**
  String get quoteNotesHint;

  /// No description provided for @quoteSubmit.
  ///
  /// In en, this message translates to:
  /// **'Request quote'**
  String get quoteSubmit;

  /// No description provided for @quoteSending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get quoteSending;

  /// No description provided for @quoteNeedsRoute.
  ///
  /// In en, this message translates to:
  /// **'Add where it is coming from and going to.'**
  String get quoteNeedsRoute;

  /// No description provided for @quoteSentTitle.
  ///
  /// In en, this message translates to:
  /// **'Quote requested'**
  String get quoteSentTitle;

  /// No description provided for @quoteSentBody.
  ///
  /// In en, this message translates to:
  /// **'KCPL will reply with a price for {route}.'**
  String quoteSentBody(String route);

  /// No description provided for @quoteDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get quoteDone;

  /// No description provided for @continueWithApple.
  ///
  /// In en, this message translates to:
  /// **'Continue with Apple'**
  String get continueWithApple;

  /// No description provided for @continueWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get continueWithGoogle;

  /// No description provided for @signInWithEmail.
  ///
  /// In en, this message translates to:
  /// **'Sign in with email'**
  String get signInWithEmail;

  /// No description provided for @orWithEmail.
  ///
  /// In en, this message translates to:
  /// **'or with your email'**
  String get orWithEmail;

  /// No description provided for @linkProvider.
  ///
  /// In en, this message translates to:
  /// **'This email already has a KCPL password. Sign in with it once and {provider} will be connected for next time.'**
  String linkProvider(String provider);

  /// No description provided for @providerOff.
  ///
  /// In en, this message translates to:
  /// **'{provider} sign-in is not switched on for KCPL yet. Use your email and password.'**
  String providerOff(String provider);

  /// No description provided for @sendDocTitle.
  ///
  /// In en, this message translates to:
  /// **'Send a document'**
  String get sendDocTitle;

  /// No description provided for @sendDocKind.
  ///
  /// In en, this message translates to:
  /// **'What is it?'**
  String get sendDocKind;

  /// No description provided for @sendDocFile.
  ///
  /// In en, this message translates to:
  /// **'The document'**
  String get sendDocFile;

  /// No description provided for @sendDocFor.
  ///
  /// In en, this message translates to:
  /// **'For {reference}'**
  String sendDocFor(String reference);

  /// No description provided for @captureTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get captureTakePhoto;

  /// No description provided for @captureChoosePhoto.
  ///
  /// In en, this message translates to:
  /// **'Choose photo'**
  String get captureChoosePhoto;

  /// No description provided for @captureChooseFile.
  ///
  /// In en, this message translates to:
  /// **'Choose file'**
  String get captureChooseFile;

  /// No description provided for @captureReplace.
  ///
  /// In en, this message translates to:
  /// **'Replace'**
  String get captureReplace;

  /// No description provided for @captureCameraDenied.
  ///
  /// In en, this message translates to:
  /// **'KCPL can\'t use the camera. Allow it in your phone\'s Settings.'**
  String get captureCameraDenied;

  /// No description provided for @captureUnsupported.
  ///
  /// In en, this message translates to:
  /// **'Send a PDF, JPEG, PNG or WEBP file.'**
  String get captureUnsupported;

  /// No description provided for @captureTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Files must be {size} MB or smaller.'**
  String captureTooLarge(String size);

  /// No description provided for @captureHint.
  ///
  /// In en, this message translates to:
  /// **'Lay the paper flat in good light, with all four corners in view.'**
  String get captureHint;

  /// No description provided for @sendToKcpl.
  ///
  /// In en, this message translates to:
  /// **'Send to KCPL'**
  String get sendToKcpl;

  /// No description provided for @sending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get sending;

  /// No description provided for @sendingPercent.
  ///
  /// In en, this message translates to:
  /// **'Sending… {percent}%'**
  String sendingPercent(String percent);

  /// No description provided for @sendDocFootnote.
  ///
  /// In en, this message translates to:
  /// **'KCPL checks every document before it counts. Bills of lading, customs entries and proofs of delivery are filed by KCPL.'**
  String get sendDocFootnote;

  /// No description provided for @sentTitle.
  ///
  /// In en, this message translates to:
  /// **'Sent to KCPL'**
  String get sentTitle;

  /// No description provided for @sendChooseKind.
  ///
  /// In en, this message translates to:
  /// **'Choose what the document is.'**
  String get sendChooseKind;

  /// No description provided for @sendChooseFile.
  ///
  /// In en, this message translates to:
  /// **'Add a photo or a file first.'**
  String get sendChooseFile;

  /// No description provided for @sendAction.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get sendAction;

  /// No description provided for @confirmPrompt.
  ///
  /// In en, this message translates to:
  /// **'Has it arrived?'**
  String get confirmPrompt;

  /// No description provided for @confirmPromptBody.
  ///
  /// In en, this message translates to:
  /// **'Let KCPL know the cargo reached you.'**
  String get confirmPromptBody;

  /// No description provided for @confirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm receipt'**
  String get confirmTitle;

  /// No description provided for @confirmReceivedBy.
  ///
  /// In en, this message translates to:
  /// **'Received by'**
  String get confirmReceivedBy;

  /// No description provided for @confirmReceivedByHint.
  ///
  /// In en, this message translates to:
  /// **'Who took delivery'**
  String get confirmReceivedByHint;

  /// No description provided for @confirmNote.
  ///
  /// In en, this message translates to:
  /// **'Anything KCPL should know'**
  String get confirmNote;

  /// No description provided for @confirmNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Condition, missing pieces, damage…'**
  String get confirmNoteHint;

  /// No description provided for @confirmPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo of the delivery'**
  String get confirmPhoto;

  /// No description provided for @confirmPhotoOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional. It is filed on the shipment for KCPL to see.'**
  String get confirmPhotoOptional;

  /// No description provided for @confirmFootnote.
  ///
  /// In en, this message translates to:
  /// **'This tells KCPL the cargo arrived. It isn\'t a proof of delivery: KCPL still files that.'**
  String get confirmFootnote;

  /// No description provided for @confirmedTitle.
  ///
  /// In en, this message translates to:
  /// **'Thank you'**
  String get confirmedTitle;

  /// No description provided for @confirmedOn.
  ///
  /// In en, this message translates to:
  /// **'You confirmed receipt on {date}'**
  String confirmedOn(String date);

  /// No description provided for @confirmedBy.
  ///
  /// In en, this message translates to:
  /// **'Received by {name}'**
  String confirmedBy(String name);

  /// No description provided for @receiptSend.
  ///
  /// In en, this message translates to:
  /// **'Send payment receipt'**
  String get receiptSend;

  /// No description provided for @receiptTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment receipt'**
  String get receiptTitle;

  /// No description provided for @receiptFile.
  ///
  /// In en, this message translates to:
  /// **'Bank receipt or advice'**
  String get receiptFile;

  /// No description provided for @receiptAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount paid'**
  String get receiptAmount;

  /// No description provided for @receiptPaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on'**
  String get receiptPaidOn;

  /// No description provided for @receiptNote.
  ///
  /// In en, this message translates to:
  /// **'Note for KCPL accounts'**
  String get receiptNote;

  /// No description provided for @receiptNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Bank, reference number…'**
  String get receiptNoteHint;

  /// No description provided for @receiptFootnote.
  ///
  /// In en, this message translates to:
  /// **'KCPL accounts match every receipt with the bank before the invoice changes.'**
  String get receiptFootnote;

  /// No description provided for @receiptsTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipts you sent'**
  String get receiptsTitle;

  /// No description provided for @receiptWithAccounts.
  ///
  /// In en, this message translates to:
  /// **'With KCPL accounts'**
  String get receiptWithAccounts;

  /// No description provided for @receiptAcknowledged.
  ///
  /// In en, this message translates to:
  /// **'Acknowledged'**
  String get receiptAcknowledged;

  /// No description provided for @receiptInvalidAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter the amount as a number.'**
  String get receiptInvalidAmount;

  /// No description provided for @receiptPaidOnDate.
  ///
  /// In en, this message translates to:
  /// **'Paid {date}'**
  String receiptPaidOnDate(String date);

  /// No description provided for @teamTitle.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get teamTitle;

  /// No description provided for @teamInvite.
  ///
  /// In en, this message translates to:
  /// **'Invite a colleague'**
  String get teamInvite;

  /// No description provided for @teamInviteBody.
  ///
  /// In en, this message translates to:
  /// **'They\'ll see your shipments and documents. Invoices stay with account owners.'**
  String get teamInviteBody;

  /// No description provided for @teamSendInvite.
  ///
  /// In en, this message translates to:
  /// **'Send invitation'**
  String get teamSendInvite;

  /// No description provided for @teamInvited.
  ///
  /// In en, this message translates to:
  /// **'Invitation sent'**
  String get teamInvited;

  /// No description provided for @teamInviteSentBody.
  ///
  /// In en, this message translates to:
  /// **'{email} will get an email to set a password.'**
  String teamInviteSentBody(String email);

  /// No description provided for @teamInviteLinkBody.
  ///
  /// In en, this message translates to:
  /// **'Email isn\'t set up for KCPL yet, so pass this link to {email} yourself. It works once.'**
  String teamInviteLinkBody(String email);

  /// No description provided for @teamShareLink.
  ///
  /// In en, this message translates to:
  /// **'Share link'**
  String get teamShareLink;

  /// No description provided for @teamStateActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get teamStateActive;

  /// No description provided for @teamStateInvited.
  ///
  /// In en, this message translates to:
  /// **'Invited'**
  String get teamStateInvited;

  /// No description provided for @teamStateOff.
  ///
  /// In en, this message translates to:
  /// **'Turned off'**
  String get teamStateOff;

  /// No description provided for @teamStateLinked.
  ///
  /// In en, this message translates to:
  /// **'Linked by KCPL'**
  String get teamStateLinked;

  /// No description provided for @teamYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get teamYou;

  /// No description provided for @teamLastSeen.
  ///
  /// In en, this message translates to:
  /// **'Last signed in {date}'**
  String teamLastSeen(String date);

  /// No description provided for @teamNeverSignedIn.
  ///
  /// In en, this message translates to:
  /// **'Hasn\'t signed in yet'**
  String get teamNeverSignedIn;

  /// No description provided for @teamTurnOff.
  ///
  /// In en, this message translates to:
  /// **'Turn off login'**
  String get teamTurnOff;

  /// No description provided for @teamTurnOn.
  ///
  /// In en, this message translates to:
  /// **'Turn login back on'**
  String get teamTurnOn;

  /// No description provided for @teamTurnOffBody.
  ///
  /// In en, this message translates to:
  /// **'{email} won\'t be able to sign in until you turn it back on.'**
  String teamTurnOffBody(String email);

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @teamFootnote.
  ///
  /// In en, this message translates to:
  /// **'Members see shipments and documents. Only KCPL can add another account owner.'**
  String get teamFootnote;

  /// No description provided for @teamLinkedFootnote.
  ///
  /// In en, this message translates to:
  /// **'A login linked by KCPL belongs to another account. Ask KCPL to remove it.'**
  String get teamLinkedFootnote;

  /// No description provided for @offlineAsOf.
  ///
  /// In en, this message translates to:
  /// **'Offline · as of {time}'**
  String offlineAsOf(String time);

  /// No description provided for @lockSection.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get lockSection;

  /// No description provided for @lockRequire.
  ///
  /// In en, this message translates to:
  /// **'Require {method}'**
  String lockRequire(String method);

  /// No description provided for @lockFootnote.
  ///
  /// In en, this message translates to:
  /// **'KCPL asks for {method} when you come back to it after a minute away, and hides its content in the app switcher.'**
  String lockFootnote(String method);

  /// No description provided for @lockTitle.
  ///
  /// In en, this message translates to:
  /// **'KCPL is locked'**
  String get lockTitle;

  /// No description provided for @lockUnlock.
  ///
  /// In en, this message translates to:
  /// **'Unlock'**
  String get lockUnlock;

  /// No description provided for @lockReason.
  ///
  /// In en, this message translates to:
  /// **'Unlock your KCPL account'**
  String get lockReason;

  /// No description provided for @lockFaceId.
  ///
  /// In en, this message translates to:
  /// **'Face ID'**
  String get lockFaceId;

  /// No description provided for @lockTouchId.
  ///
  /// In en, this message translates to:
  /// **'Touch ID'**
  String get lockTouchId;

  /// No description provided for @lockFingerprint.
  ///
  /// In en, this message translates to:
  /// **'fingerprint'**
  String get lockFingerprint;

  /// No description provided for @lockPasscode.
  ///
  /// In en, this message translates to:
  /// **'your passcode'**
  String get lockPasscode;

  /// No description provided for @shareStatus.
  ///
  /// In en, this message translates to:
  /// **'Share status'**
  String get shareStatus;

  /// No description provided for @shareExpected.
  ///
  /// In en, this message translates to:
  /// **'Expected {date}'**
  String shareExpected(String date);

  /// No description provided for @shareDeliveredOn.
  ///
  /// In en, this message translates to:
  /// **'Delivered {date}'**
  String shareDeliveredOn(String date);

  /// No description provided for @shareFooter.
  ///
  /// In en, this message translates to:
  /// **'Kapileshwor Cargo · shared from the KCPL app'**
  String get shareFooter;

  /// No description provided for @shareCarrierRef.
  ///
  /// In en, this message translates to:
  /// **'Carrier reference {reference}'**
  String shareCarrierRef(String reference);

  /// No description provided for @quotesTitle.
  ///
  /// In en, this message translates to:
  /// **'Quotes'**
  String get quotesTitle;

  /// No description provided for @quotesNew.
  ///
  /// In en, this message translates to:
  /// **'New request'**
  String get quotesNew;

  /// No description provided for @quoteValidUntil.
  ///
  /// In en, this message translates to:
  /// **'Valid until {date}'**
  String quoteValidUntil(String date);

  /// No description provided for @quoteExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired {date}'**
  String quoteExpired(String date);

  /// No description provided for @quoteAsked.
  ///
  /// In en, this message translates to:
  /// **'You asked to proceed'**
  String get quoteAsked;

  /// No description provided for @quoteBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked as {reference}'**
  String quoteBooked(String reference);

  /// No description provided for @quotePriceFor.
  ///
  /// In en, this message translates to:
  /// **'{cargo}'**
  String quotePriceFor(String cargo);

  /// No description provided for @quoteProceedNote.
  ///
  /// In en, this message translates to:
  /// **'Anything for your account manager (optional)'**
  String get quoteProceedNote;

  /// No description provided for @quoteProceedFootnote.
  ///
  /// In en, this message translates to:
  /// **'Your account manager confirms the booking with you. Nothing is booked or charged until they do.'**
  String get quoteProceedFootnote;

  /// No description provided for @quoteProceedDone.
  ///
  /// In en, this message translates to:
  /// **'Request sent'**
  String get quoteProceedDone;

  /// No description provided for @quoteCargo.
  ///
  /// In en, this message translates to:
  /// **'Cargo'**
  String get quoteCargo;

  /// No description provided for @quoteWeight.
  ///
  /// In en, this message translates to:
  /// **'Weight'**
  String get quoteWeight;

  /// No description provided for @quoteExpiredBody.
  ///
  /// In en, this message translates to:
  /// **'This price has expired. Ask KCPL for a fresh quote.'**
  String get quoteExpiredBody;

  /// No description provided for @payOnline.
  ///
  /// In en, this message translates to:
  /// **'Pay online'**
  String get payOnline;

  /// No description provided for @payChoose.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} with'**
  String payChoose(String amount);

  /// No description provided for @payFootnote.
  ///
  /// In en, this message translates to:
  /// **'You pay on the gateway\'s own page. KCPL checks the payment with the gateway before applying it to this invoice.'**
  String get payFootnote;

  /// No description provided for @payWaiting.
  ///
  /// In en, this message translates to:
  /// **'Finish paying in the browser'**
  String get payWaiting;

  /// No description provided for @payWaitingBody.
  ///
  /// In en, this message translates to:
  /// **'Come back here when you\'re done. This page checks with KCPL on its own.'**
  String get payWaitingBody;

  /// No description provided for @payOpenAgain.
  ///
  /// In en, this message translates to:
  /// **'Open the payment page again'**
  String get payOpenAgain;

  /// No description provided for @payPaid.
  ///
  /// In en, this message translates to:
  /// **'Payment received'**
  String get payPaid;

  /// No description provided for @payPaidBody.
  ///
  /// In en, this message translates to:
  /// **'{amount} was applied to {invoice}.'**
  String payPaidBody(String amount, String invoice);

  /// No description provided for @payReview.
  ///
  /// In en, this message translates to:
  /// **'Payment received'**
  String get payReview;

  /// No description provided for @payReviewBody.
  ///
  /// In en, this message translates to:
  /// **'KCPL accounts will apply it to {invoice} and confirm.'**
  String payReviewBody(String invoice);

  /// No description provided for @payFailed.
  ///
  /// In en, this message translates to:
  /// **'Payment not completed'**
  String get payFailed;

  /// No description provided for @payFailedBody.
  ///
  /// In en, this message translates to:
  /// **'Nothing was charged by KCPL. You can try again or pay another way.'**
  String get payFailedBody;

  /// No description provided for @payOwed.
  ///
  /// In en, this message translates to:
  /// **'{amount} owed'**
  String payOwed(String amount);

  /// No description provided for @payWhole.
  ///
  /// In en, this message translates to:
  /// **'Whole balance'**
  String get payWhole;

  /// No description provided for @payPart.
  ///
  /// In en, this message translates to:
  /// **'Part of it'**
  String get payPart;

  /// No description provided for @payAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount to pay ({currency})'**
  String payAmount(String currency);

  /// No description provided for @payTooMuch.
  ///
  /// In en, this message translates to:
  /// **'That is more than is owed.'**
  String get payTooMuch;

  /// No description provided for @payTooLittle.
  ///
  /// In en, this message translates to:
  /// **'The smallest online payment is NPR {minimum}.'**
  String payTooLittle(int minimum);

  /// No description provided for @payEnterAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter an amount.'**
  String get payEnterAmount;

  /// No description provided for @payInRupees.
  ///
  /// In en, this message translates to:
  /// **'You pay {amount} in rupees'**
  String payInRupees(String amount);

  /// No description provided for @payRate.
  ///
  /// In en, this message translates to:
  /// **'1 {currency} = NPR {rate}, Nepal Rastra Bank\'s selling rate for {date}. The rate is fixed when you start paying; KCPL accounts apply the payment to the invoice.'**
  String payRate(String currency, String rate, String date);

  /// No description provided for @payPartFootnote.
  ///
  /// In en, this message translates to:
  /// **'The rest stays on the invoice, to pay later or by bank transfer.'**
  String get payPartFootnote;

  /// No description provided for @payCouldNotOpen.
  ///
  /// In en, this message translates to:
  /// **'The payment page could not be opened on this phone.'**
  String get payCouldNotOpen;

  /// No description provided for @emailSection.
  ///
  /// In en, this message translates to:
  /// **'Email me about'**
  String get emailSection;

  /// No description provided for @calendarSection.
  ///
  /// In en, this message translates to:
  /// **'Dates'**
  String get calendarSection;

  /// No description provided for @calendarGregorian.
  ///
  /// In en, this message translates to:
  /// **'Gregorian (AD)'**
  String get calendarGregorian;

  /// No description provided for @calendarBikramSambat.
  ///
  /// In en, this message translates to:
  /// **'Bikram Sambat (BS)'**
  String get calendarBikramSambat;

  /// No description provided for @calendarFootnote.
  ///
  /// In en, this message translates to:
  /// **'How dates show in the app. Carrier and customs papers keep their own dates.'**
  String get calendarFootnote;

  /// No description provided for @trackShareLink.
  ///
  /// In en, this message translates to:
  /// **'Share a tracking link'**
  String get trackShareLink;

  /// No description provided for @trackShareLinkHint.
  ///
  /// In en, this message translates to:
  /// **'Anyone with the link can follow this shipment for 30 days, without a login.'**
  String get trackShareLinkHint;

  /// No description provided for @trackShareMessage.
  ///
  /// In en, this message translates to:
  /// **'Follow {reference} with Kapileshwor Cargo: {url}'**
  String trackShareMessage(String reference, String url);

  /// No description provided for @trackStopSharing.
  ///
  /// In en, this message translates to:
  /// **'Stop sharing links'**
  String get trackStopSharing;

  /// No description provided for @trackStopped.
  ///
  /// In en, this message translates to:
  /// **'Links for {reference} no longer work.'**
  String trackStopped(String reference);

  /// No description provided for @trackStoppedNone.
  ///
  /// In en, this message translates to:
  /// **'There were no links to stop.'**
  String get trackStoppedNone;

  /// No description provided for @liveFollow.
  ///
  /// In en, this message translates to:
  /// **'Follow on Lock Screen'**
  String get liveFollow;

  /// No description provided for @liveFollowAndroid.
  ///
  /// In en, this message translates to:
  /// **'Follow in notifications'**
  String get liveFollowAndroid;

  /// No description provided for @liveFollowingAndroid.
  ///
  /// In en, this message translates to:
  /// **'Following in your notifications'**
  String get liveFollowingAndroid;

  /// No description provided for @liveUnavailableAndroid.
  ///
  /// In en, this message translates to:
  /// **'Notifications are turned off for KCPL in Settings.'**
  String get liveUnavailableAndroid;

  /// No description provided for @liveChannel.
  ///
  /// In en, this message translates to:
  /// **'Shipment progress'**
  String get liveChannel;

  /// No description provided for @liveFollowing.
  ///
  /// In en, this message translates to:
  /// **'On your Lock Screen'**
  String get liveFollowing;

  /// No description provided for @liveStop.
  ///
  /// In en, this message translates to:
  /// **'Stop following'**
  String get liveStop;

  /// No description provided for @liveUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Live Activities are turned off for KCPL in Settings.'**
  String get liveUnavailable;

  /// No description provided for @captureScan.
  ///
  /// In en, this message translates to:
  /// **'Scan document'**
  String get captureScan;

  /// No description provided for @msgRow.
  ///
  /// In en, this message translates to:
  /// **'Message KCPL'**
  String get msgRow;

  /// No description provided for @msgRowHint.
  ///
  /// In en, this message translates to:
  /// **'About this shipment, to the person handling it'**
  String get msgRowHint;

  /// No description provided for @msgTitle.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get msgTitle;

  /// No description provided for @msgPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Write a message'**
  String get msgPlaceholder;

  /// No description provided for @msgSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get msgSend;

  /// No description provided for @msgEmpty.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get msgEmpty;

  /// No description provided for @msgEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Ask anything about this shipment. The person handling it replies here and on the web.'**
  String get msgEmptyBody;

  /// No description provided for @msgYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get msgYou;

  /// No description provided for @opsMsgRow.
  ///
  /// In en, this message translates to:
  /// **'Messages with the customer'**
  String get opsMsgRow;

  /// No description provided for @opsMsgEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'When the customer asks about this shipment, it appears here and on the Job File.'**
  String get opsMsgEmptyBody;

  /// No description provided for @opsMsgFootnote.
  ///
  /// In en, this message translates to:
  /// **'The customer sees your first name on replies.'**
  String get opsMsgFootnote;

  /// No description provided for @rateTitle.
  ///
  /// In en, this message translates to:
  /// **'How did this delivery go?'**
  String get rateTitle;

  /// No description provided for @rateHint.
  ///
  /// In en, this message translates to:
  /// **'One tap. It goes to the team that handled it.'**
  String get rateHint;

  /// No description provided for @rateScore.
  ///
  /// In en, this message translates to:
  /// **'{score} out of 5'**
  String rateScore(int score);

  /// No description provided for @rateComment.
  ///
  /// In en, this message translates to:
  /// **'Anything we should know? (optional)'**
  String get rateComment;

  /// No description provided for @rateSend.
  ///
  /// In en, this message translates to:
  /// **'Send rating'**
  String get rateSend;

  /// No description provided for @rateThanks.
  ///
  /// In en, this message translates to:
  /// **'Thank you'**
  String get rateThanks;

  /// No description provided for @rateReview.
  ///
  /// In en, this message translates to:
  /// **'Leave a public review'**
  String get rateReview;

  /// No description provided for @rateRated.
  ///
  /// In en, this message translates to:
  /// **'You rated this delivery {score} out of 5'**
  String rateRated(int score);

  /// No description provided for @estStorageRow.
  ///
  /// In en, this message translates to:
  /// **'What will storage cost?'**
  String get estStorageRow;

  /// No description provided for @estStorageTitle.
  ///
  /// In en, this message translates to:
  /// **'Storage charges'**
  String get estStorageTitle;

  /// No description provided for @estDaysOver.
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =0{Collected within free time} =1{1 day after free time} other{{days} days after free time}}'**
  String estDaysOver(int days);

  /// No description provided for @estPerDay.
  ///
  /// In en, this message translates to:
  /// **'{amount} a day'**
  String estPerDay(String amount);

  /// No description provided for @estCollect.
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =0{Collected today} =1{Collected tomorrow} other{Collected in {days} days}}'**
  String estCollect(int days);

  /// No description provided for @estCharge.
  ///
  /// In en, this message translates to:
  /// **'Estimated charge'**
  String get estCharge;

  /// No description provided for @estLater.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get estLater;

  /// No description provided for @estSooner.
  ///
  /// In en, this message translates to:
  /// **'Sooner'**
  String get estSooner;

  /// No description provided for @estStorageFoot.
  ///
  /// In en, this message translates to:
  /// **'At the daily rate KCPL recorded from the carrier. The carrier\'s own invoice decides the charge.'**
  String get estStorageFoot;

  /// No description provided for @estNoRate.
  ///
  /// In en, this message translates to:
  /// **'No daily rate is recorded for this shipment yet. Ask your account manager.'**
  String get estNoRate;

  /// No description provided for @estDutyRow.
  ///
  /// In en, this message translates to:
  /// **'Estimate customs duty'**
  String get estDutyRow;

  /// No description provided for @estDutyTitle.
  ///
  /// In en, this message translates to:
  /// **'Customs duty'**
  String get estDutyTitle;

  /// No description provided for @estCif.
  ///
  /// In en, this message translates to:
  /// **'Value of the goods (CIF, NPR)'**
  String get estCif;

  /// No description provided for @estDutyRate.
  ///
  /// In en, this message translates to:
  /// **'Customs duty rate'**
  String get estDutyRate;

  /// No description provided for @estExcise.
  ///
  /// In en, this message translates to:
  /// **'Excise duty'**
  String get estExcise;

  /// No description provided for @estNone.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get estNone;

  /// No description provided for @estVat.
  ///
  /// In en, this message translates to:
  /// **'VAT at 13%'**
  String get estVat;

  /// No description provided for @estLineDuty.
  ///
  /// In en, this message translates to:
  /// **'Customs duty'**
  String get estLineDuty;

  /// No description provided for @estLineExcise.
  ///
  /// In en, this message translates to:
  /// **'Excise duty'**
  String get estLineExcise;

  /// No description provided for @estLineVat.
  ///
  /// In en, this message translates to:
  /// **'VAT'**
  String get estLineVat;

  /// No description provided for @estTotal.
  ///
  /// In en, this message translates to:
  /// **'Estimated total at customs'**
  String get estTotal;

  /// No description provided for @estDutyFoot.
  ///
  /// In en, this message translates to:
  /// **'A rough guide from the rates you choose. The rate for your goods depends on their HS code; KCPL confirms it before clearance.'**
  String get estDutyFoot;

  /// No description provided for @sheetGrabber.
  ///
  /// In en, this message translates to:
  /// **'Show more or less of the list'**
  String get sheetGrabber;

  /// No description provided for @splitShipment.
  ///
  /// In en, this message translates to:
  /// **'Choose a shipment'**
  String get splitShipment;

  /// No description provided for @splitShipmentBody.
  ///
  /// In en, this message translates to:
  /// **'Its journey, documents and messages open here.'**
  String get splitShipmentBody;

  /// No description provided for @splitInvoice.
  ///
  /// In en, this message translates to:
  /// **'Choose an invoice'**
  String get splitInvoice;

  /// No description provided for @splitInvoiceBody.
  ///
  /// In en, this message translates to:
  /// **'Its balance, receipts and paying online open here.'**
  String get splitInvoiceBody;

  /// No description provided for @opsSplitJob.
  ///
  /// In en, this message translates to:
  /// **'Choose a job'**
  String get opsSplitJob;

  /// No description provided for @opsSplitJobBody.
  ///
  /// In en, this message translates to:
  /// **'Its tasks, delivery and messages open here.'**
  String get opsSplitJobBody;

  /// No description provided for @splitDocument.
  ///
  /// In en, this message translates to:
  /// **'Choose a document'**
  String get splitDocument;

  /// No description provided for @splitDocumentBody.
  ///
  /// In en, this message translates to:
  /// **'It opens here, with the shipment it belongs to.'**
  String get splitDocumentBody;

  /// No description provided for @splitAccount.
  ///
  /// In en, this message translates to:
  /// **'Quotes and your team'**
  String get splitAccount;

  /// No description provided for @splitAccountBody.
  ///
  /// In en, this message translates to:
  /// **'They open here, beside your settings.'**
  String get splitAccountBody;

  /// No description provided for @opsSplitAlert.
  ///
  /// In en, this message translates to:
  /// **'Choose an alert'**
  String get opsSplitAlert;

  /// No description provided for @opsSplitAlertBody.
  ///
  /// In en, this message translates to:
  /// **'The job it is about opens here.'**
  String get opsSplitAlertBody;

  /// No description provided for @docOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get docOpen;

  /// No description provided for @docFile.
  ///
  /// In en, this message translates to:
  /// **'File'**
  String get docFile;

  /// No description provided for @docAdded.
  ///
  /// In en, this message translates to:
  /// **'Added'**
  String get docAdded;

  /// No description provided for @docSize.
  ///
  /// In en, this message translates to:
  /// **'Size'**
  String get docSize;

  /// No description provided for @docState.
  ///
  /// In en, this message translates to:
  /// **'Review'**
  String get docState;

  /// No description provided for @docShipment.
  ///
  /// In en, this message translates to:
  /// **'Open shipment {reference}'**
  String docShipment(String reference);

  /// No description provided for @docPreviewFailed.
  ///
  /// In en, this message translates to:
  /// **'The preview could not be loaded. Open the file instead.'**
  String get docPreviewFailed;

  /// No description provided for @qaTrack.
  ///
  /// In en, this message translates to:
  /// **'Track a shipment'**
  String get qaTrack;

  /// No description provided for @qaQuote.
  ///
  /// In en, this message translates to:
  /// **'Request a quote'**
  String get qaQuote;

  /// No description provided for @qaPay.
  ///
  /// In en, this message translates to:
  /// **'Pay an invoice'**
  String get qaPay;

  /// No description provided for @opsSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'KCPL Operations'**
  String get opsSignInTitle;

  /// No description provided for @opsSignInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Jobs, tasks and alerts across your branches.'**
  String get opsSignInSubtitle;

  /// No description provided for @opsPriorityStandard.
  ///
  /// In en, this message translates to:
  /// **'Standard'**
  String get opsPriorityStandard;

  /// No description provided for @opsPriorityHigh.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get opsPriorityHigh;

  /// No description provided for @opsPriorityUrgent.
  ///
  /// In en, this message translates to:
  /// **'Urgent'**
  String get opsPriorityUrgent;

  /// No description provided for @opsJustNow.
  ///
  /// In en, this message translates to:
  /// **'just now'**
  String get opsJustNow;

  /// No description provided for @opsNoDueDate.
  ///
  /// In en, this message translates to:
  /// **'No due date'**
  String get opsNoDueDate;

  /// No description provided for @opsYours.
  ///
  /// In en, this message translates to:
  /// **'Yours'**
  String get opsYours;

  /// No description provided for @opsUnassigned.
  ///
  /// In en, this message translates to:
  /// **'Unassigned'**
  String get opsUnassigned;

  /// No description provided for @opsAlerts.
  ///
  /// In en, this message translates to:
  /// **'Alerts'**
  String get opsAlerts;

  /// No description provided for @opsAllCaughtUp.
  ///
  /// In en, this message translates to:
  /// **'All caught up'**
  String get opsAllCaughtUp;

  /// No description provided for @opsAlertsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Alerts for your branches and jobs appear here.'**
  String get opsAlertsEmpty;

  /// No description provided for @opsOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get opsOutForDelivery;

  /// No description provided for @opsStartDelivery.
  ///
  /// In en, this message translates to:
  /// **'Start delivery'**
  String get opsStartDelivery;

  /// No description provided for @opsTakenBy.
  ///
  /// In en, this message translates to:
  /// **'Taken by'**
  String get opsTakenBy;

  /// No description provided for @opsDriverHint.
  ///
  /// In en, this message translates to:
  /// **'Driver or field staff'**
  String get opsDriverHint;

  /// No description provided for @opsVehicleHint.
  ///
  /// In en, this message translates to:
  /// **'Vehicle number (optional)'**
  String get opsVehicleHint;

  /// No description provided for @opsStartFootnote.
  ///
  /// In en, this message translates to:
  /// **'Starts attempt now and shows it on the Job File and to the customer as out for delivery.'**
  String get opsStartFootnote;

  /// No description provided for @opsRelConsignee.
  ///
  /// In en, this message translates to:
  /// **'Consignee'**
  String get opsRelConsignee;

  /// No description provided for @opsRelStaff.
  ///
  /// In en, this message translates to:
  /// **'Their staff'**
  String get opsRelStaff;

  /// No description provided for @opsRelSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get opsRelSecurity;

  /// No description provided for @opsRelFamily.
  ///
  /// In en, this message translates to:
  /// **'Family'**
  String get opsRelFamily;

  /// No description provided for @opsRelOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get opsRelOther;

  /// No description provided for @opsRecipient.
  ///
  /// In en, this message translates to:
  /// **'Recipient'**
  String get opsRecipient;

  /// No description provided for @opsNeedRecipient.
  ///
  /// In en, this message translates to:
  /// **'Who received it? Enter their name.'**
  String get opsNeedRecipient;

  /// No description provided for @opsNeedProof.
  ///
  /// In en, this message translates to:
  /// **'Add a signature or a photo as proof of delivery.'**
  String get opsNeedProof;

  /// No description provided for @opsNeedReason.
  ///
  /// In en, this message translates to:
  /// **'Say why it could not be delivered.'**
  String get opsNeedReason;

  /// No description provided for @opsSavedOnPhone.
  ///
  /// In en, this message translates to:
  /// **'Saved on this phone'**
  String get opsSavedOnPhone;

  /// No description provided for @opsSavedDeliveryBody.
  ///
  /// In en, this message translates to:
  /// **'No signal. The delivery and its proof go to KCPL by themselves, with the time they happened, as soon as there is signal.'**
  String get opsSavedDeliveryBody;

  /// No description provided for @opsProofSent.
  ///
  /// In en, this message translates to:
  /// **'Proof sent'**
  String get opsProofSent;

  /// No description provided for @opsDeliveryRecorded.
  ///
  /// In en, this message translates to:
  /// **'Delivery recorded'**
  String get opsDeliveryRecorded;

  /// No description provided for @opsAttemptRecorded.
  ///
  /// In en, this message translates to:
  /// **'Attempt recorded'**
  String get opsAttemptRecorded;

  /// No description provided for @opsSendProof.
  ///
  /// In en, this message translates to:
  /// **'Send proof of delivery'**
  String get opsSendProof;

  /// No description provided for @opsRecordDelivery.
  ///
  /// In en, this message translates to:
  /// **'Record delivery'**
  String get opsRecordDelivery;

  /// No description provided for @opsRecordAttempt.
  ///
  /// In en, this message translates to:
  /// **'Record attempt'**
  String get opsRecordAttempt;

  /// No description provided for @opsProofOfDelivery.
  ///
  /// In en, this message translates to:
  /// **'Proof of delivery'**
  String get opsProofOfDelivery;

  /// No description provided for @opsDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get opsDelivery;

  /// No description provided for @opsDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get opsDelivered;

  /// No description provided for @opsNotDelivered.
  ///
  /// In en, this message translates to:
  /// **'Not delivered'**
  String get opsNotDelivered;

  /// No description provided for @opsRefused.
  ///
  /// In en, this message translates to:
  /// **'Refused'**
  String get opsRefused;

  /// No description provided for @opsWhere.
  ///
  /// In en, this message translates to:
  /// **'Where'**
  String get opsWhere;

  /// No description provided for @opsProofFootnote.
  ///
  /// In en, this message translates to:
  /// **'Evidence reaches the desk as received. Verifying it, and marking the shipment Delivered, stays with the desk.'**
  String get opsProofFootnote;

  /// No description provided for @opsExceptionFootnote.
  ///
  /// In en, this message translates to:
  /// **'Opens an exception on the job for the desk.'**
  String get opsExceptionFootnote;

  /// No description provided for @opsReceivedByHeader.
  ///
  /// In en, this message translates to:
  /// **'Received by'**
  String get opsReceivedByHeader;

  /// No description provided for @opsFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get opsFullName;

  /// No description provided for @opsPhoneOptional.
  ///
  /// In en, this message translates to:
  /// **'Phone (optional)'**
  String get opsPhoneOptional;

  /// No description provided for @opsRelationHint.
  ///
  /// In en, this message translates to:
  /// **'Relation to the consignee'**
  String get opsRelationHint;

  /// No description provided for @opsProof.
  ///
  /// In en, this message translates to:
  /// **'Proof'**
  String get opsProof;

  /// No description provided for @opsGetSignature.
  ///
  /// In en, this message translates to:
  /// **'Get a signature'**
  String get opsGetSignature;

  /// No description provided for @opsSigned.
  ///
  /// In en, this message translates to:
  /// **'Signed'**
  String get opsSigned;

  /// No description provided for @opsSignAgain.
  ///
  /// In en, this message translates to:
  /// **'Tap to sign again'**
  String get opsSignAgain;

  /// No description provided for @opsPhotographDelivery.
  ///
  /// In en, this message translates to:
  /// **'Photograph the delivery'**
  String get opsPhotographDelivery;

  /// No description provided for @opsAnotherPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add another photo'**
  String get opsAnotherPhoto;

  /// No description provided for @opsPhotoHint.
  ///
  /// In en, this message translates to:
  /// **'The cargo at the door, a stamped delivery note'**
  String get opsPhotoHint;

  /// No description provided for @opsWhyRefused.
  ///
  /// In en, this message translates to:
  /// **'Why it was refused'**
  String get opsWhyRefused;

  /// No description provided for @opsWhyNotDelivered.
  ///
  /// In en, this message translates to:
  /// **'Why it could not be delivered'**
  String get opsWhyNotDelivered;

  /// No description provided for @opsRefusedHint.
  ///
  /// In en, this message translates to:
  /// **'Damaged carton, wrong goods, not ordered…'**
  String get opsRefusedHint;

  /// No description provided for @opsFailedHint.
  ///
  /// In en, this message translates to:
  /// **'Nobody at the address, gate closed, road blocked…'**
  String get opsFailedHint;

  /// No description provided for @opsRemovePhoto.
  ///
  /// In en, this message translates to:
  /// **'Remove photo'**
  String get opsRemovePhoto;

  /// No description provided for @opsLocating.
  ///
  /// In en, this message translates to:
  /// **'Finding where you are…'**
  String get opsLocating;

  /// No description provided for @opsNoLocation.
  ///
  /// In en, this message translates to:
  /// **'Location not available'**
  String get opsNoLocation;

  /// No description provided for @opsLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get opsLocation;

  /// No description provided for @opsLocationHint.
  ///
  /// In en, this message translates to:
  /// **'Turn on location and tap to try again. The delivery can be recorded without it.'**
  String get opsLocationHint;

  /// No description provided for @opsTodaysDeliveries.
  ///
  /// In en, this message translates to:
  /// **'Today’s deliveries'**
  String get opsTodaysDeliveries;

  /// No description provided for @opsMapsFailed.
  ///
  /// In en, this message translates to:
  /// **'Maps could not be opened on this phone.'**
  String get opsMapsFailed;

  /// No description provided for @opsDeliveryOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'The delivery could not be opened. Try again.'**
  String get opsDeliveryOpenFailed;

  /// No description provided for @opsNoDeliveriesMine.
  ///
  /// In en, this message translates to:
  /// **'No deliveries for you today'**
  String get opsNoDeliveriesMine;

  /// No description provided for @opsNoDeliveries.
  ///
  /// In en, this message translates to:
  /// **'No deliveries today'**
  String get opsNoDeliveries;

  /// No description provided for @opsDeliveriesEmpty.
  ///
  /// In en, this message translates to:
  /// **'Deliveries under way or due out today in your branches appear here.'**
  String get opsDeliveriesEmpty;

  /// No description provided for @opsRoute.
  ///
  /// In en, this message translates to:
  /// **'Route'**
  String get opsRoute;

  /// No description provided for @opsRouteFootnote.
  ///
  /// In en, this message translates to:
  /// **'Hold the handle and drag to put stops in the order you will drive them. The order is kept for today.'**
  String get opsRouteFootnote;

  /// No description provided for @opsRecordedWaiting.
  ///
  /// In en, this message translates to:
  /// **'Recorded · waiting for signal'**
  String get opsRecordedWaiting;

  /// No description provided for @opsReadyToGo.
  ///
  /// In en, this message translates to:
  /// **'Ready to go'**
  String get opsReadyToGo;

  /// No description provided for @opsDirections.
  ///
  /// In en, this message translates to:
  /// **'Directions'**
  String get opsDirections;

  /// No description provided for @opsRecord.
  ///
  /// In en, this message translates to:
  /// **'Record'**
  String get opsRecord;

  /// No description provided for @opsStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get opsStart;

  /// No description provided for @opsNoteSavedOffline.
  ///
  /// In en, this message translates to:
  /// **'No signal. Saved on this phone; it goes to the job by itself.'**
  String get opsNoteSavedOffline;

  /// No description provided for @opsNeedNote.
  ///
  /// In en, this message translates to:
  /// **'Write a note or add a photo.'**
  String get opsNeedNote;

  /// No description provided for @opsAddToJob.
  ///
  /// In en, this message translates to:
  /// **'Add to job'**
  String get opsAddToJob;

  /// No description provided for @opsNoteHint.
  ///
  /// In en, this message translates to:
  /// **'What did you see? Seal, damage, who you spoke to…'**
  String get opsNoteHint;

  /// No description provided for @opsPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get opsPhoto;

  /// No description provided for @opsPhotoFiled.
  ///
  /// In en, this message translates to:
  /// **'Filed in the job’s Document Vault for review.'**
  String get opsPhotoFiled;

  /// No description provided for @opsFileAs.
  ///
  /// In en, this message translates to:
  /// **'File it as'**
  String get opsFileAs;

  /// No description provided for @opsNoteFootnote.
  ///
  /// In en, this message translates to:
  /// **'Shows on the Job File timeline on the web, with your name.'**
  String get opsNoteFootnote;

  /// No description provided for @opsSearchStaff.
  ///
  /// In en, this message translates to:
  /// **'Search by name or branch'**
  String get opsSearchStaff;

  /// No description provided for @opsStaffFailed.
  ///
  /// In en, this message translates to:
  /// **'The staff list could not be loaded.'**
  String get opsStaffFailed;

  /// No description provided for @opsNobodyFound.
  ///
  /// In en, this message translates to:
  /// **'Nobody found'**
  String get opsNobodyFound;

  /// No description provided for @opsStaffEmpty.
  ///
  /// In en, this message translates to:
  /// **'Only staff who share one of your branches are listed.'**
  String get opsStaffEmpty;

  /// No description provided for @opsStaffHeader.
  ///
  /// In en, this message translates to:
  /// **'Staff in your branches'**
  String get opsStaffHeader;

  /// No description provided for @opsAssignJob.
  ///
  /// In en, this message translates to:
  /// **'Assign job'**
  String get opsAssignJob;

  /// No description provided for @opsGiveJobTo.
  ///
  /// In en, this message translates to:
  /// **'Give job to'**
  String get opsGiveJobTo;

  /// No description provided for @opsReassignFailed.
  ///
  /// In en, this message translates to:
  /// **'The job was not reassigned. Try again.'**
  String get opsReassignFailed;

  /// No description provided for @opsDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get opsDone;

  /// No description provided for @opsNeedTaskTitle.
  ///
  /// In en, this message translates to:
  /// **'Give the task a title.'**
  String get opsNeedTaskTitle;

  /// No description provided for @opsNewTask.
  ///
  /// In en, this message translates to:
  /// **'New task'**
  String get opsNewTask;

  /// No description provided for @opsTitle.
  ///
  /// In en, this message translates to:
  /// **'Title'**
  String get opsTitle;

  /// No description provided for @opsNotesOptional.
  ///
  /// In en, this message translates to:
  /// **'Notes (optional)'**
  String get opsNotesOptional;

  /// No description provided for @opsDue.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get opsDue;

  /// No description provided for @opsNoDate.
  ///
  /// In en, this message translates to:
  /// **'No date'**
  String get opsNoDate;

  /// No description provided for @opsToday5pm.
  ///
  /// In en, this message translates to:
  /// **'Today, 5 PM'**
  String get opsToday5pm;

  /// No description provided for @opsTomorrow10am.
  ///
  /// In en, this message translates to:
  /// **'Tomorrow, 10 AM'**
  String get opsTomorrow10am;

  /// No description provided for @opsPick.
  ///
  /// In en, this message translates to:
  /// **'Pick…'**
  String get opsPick;

  /// No description provided for @opsAssignedTo.
  ///
  /// In en, this message translates to:
  /// **'Assigned to'**
  String get opsAssignedTo;

  /// No description provided for @opsAssignTask.
  ///
  /// In en, this message translates to:
  /// **'Assign task'**
  String get opsAssignTask;

  /// No description provided for @opsNobodyYet.
  ///
  /// In en, this message translates to:
  /// **'Nobody yet'**
  String get opsNobodyYet;

  /// No description provided for @opsBranch.
  ///
  /// In en, this message translates to:
  /// **'Branch'**
  String get opsBranch;

  /// No description provided for @opsNeedOverride.
  ///
  /// In en, this message translates to:
  /// **'Say why it is being closed anyway (at least 8 characters).'**
  String get opsNeedOverride;

  /// No description provided for @opsNotClosed.
  ///
  /// In en, this message translates to:
  /// **'Not closed: something still stands in the way.'**
  String get opsNotClosed;

  /// No description provided for @opsJobClosed.
  ///
  /// In en, this message translates to:
  /// **'Job closed'**
  String get opsJobClosed;

  /// No description provided for @opsJobClosedBody.
  ///
  /// In en, this message translates to:
  /// **'The Job File is closed, with your name and the time.'**
  String get opsJobClosedBody;

  /// No description provided for @opsCloseJob.
  ///
  /// In en, this message translates to:
  /// **'Close job'**
  String get opsCloseJob;

  /// No description provided for @opsCloseAnyway.
  ///
  /// In en, this message translates to:
  /// **'Close anyway'**
  String get opsCloseAnyway;

  /// No description provided for @opsReadyToClose.
  ///
  /// In en, this message translates to:
  /// **'Ready to close'**
  String get opsReadyToClose;

  /// No description provided for @opsReadyToCloseBody.
  ///
  /// In en, this message translates to:
  /// **'Tasks, customs and proof of delivery are all in order.'**
  String get opsReadyToCloseBody;

  /// No description provided for @opsStillOpen.
  ///
  /// In en, this message translates to:
  /// **'Still open'**
  String get opsStillOpen;

  /// No description provided for @opsOverrideReason.
  ///
  /// In en, this message translates to:
  /// **'Reason to close anyway'**
  String get opsOverrideReason;

  /// No description provided for @opsOverrideHint.
  ///
  /// In en, this message translates to:
  /// **'Recorded on the Job File with your name'**
  String get opsOverrideHint;

  /// No description provided for @opsCloseBlockedFootnote.
  ///
  /// In en, this message translates to:
  /// **'Clear these first, or ask Management to close it with a reason.'**
  String get opsCloseBlockedFootnote;

  /// No description provided for @opsJobNotFound.
  ///
  /// In en, this message translates to:
  /// **'Job not found'**
  String get opsJobNotFound;

  /// No description provided for @opsJobNotFoundBody.
  ///
  /// In en, this message translates to:
  /// **'It may have been closed or moved outside your branches.'**
  String get opsJobNotFoundBody;

  /// No description provided for @opsOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get opsOwner;

  /// No description provided for @opsAssignSomeone.
  ///
  /// In en, this message translates to:
  /// **'Assign someone'**
  String get opsAssignSomeone;

  /// No description provided for @opsGiveToSomeone.
  ///
  /// In en, this message translates to:
  /// **'Give to someone else'**
  String get opsGiveToSomeone;

  /// No description provided for @opsNoOwner.
  ///
  /// In en, this message translates to:
  /// **'Nobody owns this job yet.'**
  String get opsNoOwner;

  /// No description provided for @opsTasks.
  ///
  /// In en, this message translates to:
  /// **'Tasks'**
  String get opsTasks;

  /// No description provided for @opsNoTasks.
  ///
  /// In en, this message translates to:
  /// **'No tasks yet. Tasks added here or in the Job File show on both.'**
  String get opsNoTasks;

  /// No description provided for @opsCustoms.
  ///
  /// In en, this message translates to:
  /// **'Customs'**
  String get opsCustoms;

  /// No description provided for @opsRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get opsRequired;

  /// No description provided for @opsOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get opsOptional;

  /// No description provided for @opsBeforeCloseout.
  ///
  /// In en, this message translates to:
  /// **'Before closeout'**
  String get opsBeforeCloseout;

  /// No description provided for @opsFromField.
  ///
  /// In en, this message translates to:
  /// **'From the field'**
  String get opsFromField;

  /// No description provided for @opsNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get opsNotes;

  /// No description provided for @opsDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get opsDetails;

  /// No description provided for @opsCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get opsCustomer;

  /// No description provided for @opsPriority.
  ///
  /// In en, this message translates to:
  /// **'Priority'**
  String get opsPriority;

  /// No description provided for @opsHandling.
  ///
  /// In en, this message translates to:
  /// **'Handling'**
  String get opsHandling;

  /// No description provided for @opsInternalRef.
  ///
  /// In en, this message translates to:
  /// **'Internal ref'**
  String get opsInternalRef;

  /// No description provided for @opsProfitability.
  ///
  /// In en, this message translates to:
  /// **'Profitability'**
  String get opsProfitability;

  /// No description provided for @opsRevenue.
  ///
  /// In en, this message translates to:
  /// **'Revenue'**
  String get opsRevenue;

  /// No description provided for @opsCost.
  ///
  /// In en, this message translates to:
  /// **'Cost'**
  String get opsCost;

  /// No description provided for @opsProfit.
  ///
  /// In en, this message translates to:
  /// **'Profit'**
  String get opsProfit;

  /// No description provided for @opsMargin.
  ///
  /// In en, this message translates to:
  /// **'Margin'**
  String get opsMargin;

  /// No description provided for @opsJobIsClosed.
  ///
  /// In en, this message translates to:
  /// **'This job is closed.'**
  String get opsJobIsClosed;

  /// No description provided for @opsCloseJobEllipsis.
  ///
  /// In en, this message translates to:
  /// **'Close job…'**
  String get opsCloseJobEllipsis;

  /// No description provided for @opsQueuedDeliveryBody.
  ///
  /// In en, this message translates to:
  /// **'This delivery is on your phone and goes to KCPL, with the time it happened, as soon as there is signal.'**
  String get opsQueuedDeliveryBody;

  /// No description provided for @opsDeleteDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delete this delivery'**
  String get opsDeleteDelivery;

  /// No description provided for @opsRecordHowItWent.
  ///
  /// In en, this message translates to:
  /// **'Record how it went'**
  String get opsRecordHowItWent;

  /// No description provided for @opsAddProof.
  ///
  /// In en, this message translates to:
  /// **'Add proof of delivery'**
  String get opsAddProof;

  /// No description provided for @opsWaitingForSignal.
  ///
  /// In en, this message translates to:
  /// **'Waiting for signal'**
  String get opsWaitingForSignal;

  /// No description provided for @opsSignature.
  ///
  /// In en, this message translates to:
  /// **'Signature'**
  String get opsSignature;

  /// No description provided for @opsDocument.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get opsDocument;

  /// No description provided for @opsScheduled.
  ///
  /// In en, this message translates to:
  /// **'Scheduled'**
  String get opsScheduled;

  /// No description provided for @opsPodReceived.
  ///
  /// In en, this message translates to:
  /// **'Proof received · the desk verifies it'**
  String get opsPodReceived;

  /// No description provided for @opsPodVerified.
  ///
  /// In en, this message translates to:
  /// **'Proof of delivery verified'**
  String get opsPodVerified;

  /// No description provided for @opsPodRejected.
  ///
  /// In en, this message translates to:
  /// **'Proof rejected by the desk · add new proof'**
  String get opsPodRejected;

  /// No description provided for @opsPodNone.
  ///
  /// In en, this message translates to:
  /// **'No proof of delivery yet'**
  String get opsPodNone;

  /// No description provided for @opsQueuedNoteBody.
  ///
  /// In en, this message translates to:
  /// **'This note is on your phone and goes to the job as soon as KCPL can be reached.'**
  String get opsQueuedNoteBody;

  /// No description provided for @opsDeleteNote.
  ///
  /// In en, this message translates to:
  /// **'Delete note'**
  String get opsDeleteNote;

  /// No description provided for @opsAddNote.
  ///
  /// In en, this message translates to:
  /// **'Add a note or photo'**
  String get opsAddNote;

  /// No description provided for @opsCouldNotOpen.
  ///
  /// In en, this message translates to:
  /// **'That could not be opened on this device.'**
  String get opsCouldNotOpen;

  /// No description provided for @opsChangeNotSaved.
  ///
  /// In en, this message translates to:
  /// **'That change was not saved. Try again.'**
  String get opsChangeNotSaved;

  /// No description provided for @opsMine.
  ///
  /// In en, this message translates to:
  /// **'Mine'**
  String get opsMine;

  /// No description provided for @opsAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get opsAll;

  /// No description provided for @opsOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get opsOverdue;

  /// No description provided for @opsExceptions.
  ///
  /// In en, this message translates to:
  /// **'Exceptions'**
  String get opsExceptions;

  /// No description provided for @opsJobs.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get opsJobs;

  /// No description provided for @opsScan.
  ///
  /// In en, this message translates to:
  /// **'Scan'**
  String get opsScan;

  /// No description provided for @opsSearchJobs.
  ///
  /// In en, this message translates to:
  /// **'Search reference, customer, route or owner…'**
  String get opsSearchJobs;

  /// No description provided for @opsNoActiveJobs.
  ///
  /// In en, this message translates to:
  /// **'No active jobs'**
  String get opsNoActiveJobs;

  /// No description provided for @opsNothingMatches.
  ///
  /// In en, this message translates to:
  /// **'Nothing matches'**
  String get opsNothingMatches;

  /// No description provided for @opsJobsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Jobs in your branches appear here.'**
  String get opsJobsEmpty;

  /// No description provided for @opsJobsNoMatch.
  ///
  /// In en, this message translates to:
  /// **'Try another filter or clear the search.'**
  String get opsJobsNoMatch;

  /// No description provided for @opsMe.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get opsMe;

  /// No description provided for @opsRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get opsRole;

  /// No description provided for @opsBranches.
  ///
  /// In en, this message translates to:
  /// **'Branches'**
  String get opsBranches;

  /// No description provided for @opsAllBranches.
  ///
  /// In en, this message translates to:
  /// **'All branches'**
  String get opsAllBranches;

  /// No description provided for @opsCostsAndMargins.
  ///
  /// In en, this message translates to:
  /// **'Costs and margins'**
  String get opsCostsAndMargins;

  /// No description provided for @opsVisible.
  ///
  /// In en, this message translates to:
  /// **'Visible'**
  String get opsVisible;

  /// No description provided for @opsNotShared.
  ///
  /// In en, this message translates to:
  /// **'Not shared with this role'**
  String get opsNotShared;

  /// No description provided for @opsRolesFootnote.
  ///
  /// In en, this message translates to:
  /// **'Roles and branch access are managed by KCPL Management in the web admin.'**
  String get opsRolesFootnote;

  /// No description provided for @opsNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get opsNotifications;

  /// No description provided for @opsSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get opsSignOut;

  /// No description provided for @opsToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get opsToday;

  /// No description provided for @opsDemoBanner.
  ///
  /// In en, this message translates to:
  /// **'Demo data, not real operations'**
  String get opsDemoBanner;

  /// No description provided for @opsReadingText.
  ///
  /// In en, this message translates to:
  /// **'Reading the text…'**
  String get opsReadingText;

  /// No description provided for @opsPointAtCode.
  ///
  /// In en, this message translates to:
  /// **'Point at a barcode or QR code'**
  String get opsPointAtCode;

  /// No description provided for @opsScanHint.
  ///
  /// In en, this message translates to:
  /// **'Or read a container number off the door, or type a reference.'**
  String get opsScanHint;

  /// No description provided for @opsReadText.
  ///
  /// In en, this message translates to:
  /// **'Read text'**
  String get opsReadText;

  /// No description provided for @opsTypeIt.
  ///
  /// In en, this message translates to:
  /// **'Type it'**
  String get opsTypeIt;

  /// No description provided for @opsNoNumber.
  ///
  /// In en, this message translates to:
  /// **'No number in that photo'**
  String get opsNoNumber;

  /// No description provided for @opsTapNumber.
  ///
  /// In en, this message translates to:
  /// **'Tap the number to find'**
  String get opsTapNumber;

  /// No description provided for @opsTryCloser.
  ///
  /// In en, this message translates to:
  /// **'Try closer, straight on, in good light.'**
  String get opsTryCloser;

  /// No description provided for @opsCheckDigitFirst.
  ///
  /// In en, this message translates to:
  /// **'Container numbers that pass their check digit come first.'**
  String get opsCheckDigitFirst;

  /// No description provided for @opsScanAgain.
  ///
  /// In en, this message translates to:
  /// **'Scan again'**
  String get opsScanAgain;

  /// No description provided for @opsLookupHint.
  ///
  /// In en, this message translates to:
  /// **'Job, container, B/L or AWB number'**
  String get opsLookupHint;

  /// No description provided for @opsFindJob.
  ///
  /// In en, this message translates to:
  /// **'Find job'**
  String get opsFindJob;

  /// No description provided for @opsBackToCamera.
  ///
  /// In en, this message translates to:
  /// **'Back to camera'**
  String get opsBackToCamera;

  /// No description provided for @opsNoMatchBody.
  ///
  /// In en, this message translates to:
  /// **'Only jobs in your branches can be found. Check the number, or search Jobs.'**
  String get opsNoMatchBody;

  /// No description provided for @opsCameraDenied.
  ///
  /// In en, this message translates to:
  /// **'Allow the camera for KCPL Ops in Settings to scan. You can still type a reference below.'**
  String get opsCameraDenied;

  /// No description provided for @opsCameraUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The camera is not available. You can still type a reference below.'**
  String get opsCameraUnavailable;

  /// No description provided for @opsCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get opsCancel;

  /// No description provided for @opsClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get opsClear;

  /// No description provided for @opsSignatureArea.
  ///
  /// In en, this message translates to:
  /// **'Signature area. Sign with one finger.'**
  String get opsSignatureArea;

  /// No description provided for @opsNeedsAction.
  ///
  /// In en, this message translates to:
  /// **'Needs action'**
  String get opsNeedsAction;

  /// No description provided for @opsMoving.
  ///
  /// In en, this message translates to:
  /// **'Moving'**
  String get opsMoving;

  /// No description provided for @opsAllJobs.
  ///
  /// In en, this message translates to:
  /// **'All jobs'**
  String get opsAllJobs;

  /// No description provided for @opsNothingWaiting.
  ///
  /// In en, this message translates to:
  /// **'Nothing waiting on you'**
  String get opsNothingWaiting;

  /// No description provided for @opsNothingWaitingBody.
  ///
  /// In en, this message translates to:
  /// **'No active jobs in your branches need attention right now.'**
  String get opsNothingWaitingBody;

  /// No description provided for @opsMinutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min ago'**
  String opsMinutesAgo(int minutes);

  /// No description provided for @opsHoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{hours} h ago'**
  String opsHoursAgo(int hours);

  /// No description provided for @opsDaysAgo.
  ///
  /// In en, this message translates to:
  /// **'{days} d ago'**
  String opsDaysAgo(int days);

  /// No description provided for @opsOverdueDue.
  ///
  /// In en, this message translates to:
  /// **'Overdue · due {when}'**
  String opsOverdueDue(String when);

  /// No description provided for @opsDueToday.
  ///
  /// In en, this message translates to:
  /// **'Due today {time}'**
  String opsDueToday(String time);

  /// No description provided for @opsDueTomorrow.
  ///
  /// In en, this message translates to:
  /// **'Due tomorrow {time}'**
  String opsDueTomorrow(String time);

  /// No description provided for @opsDueOn.
  ///
  /// In en, this message translates to:
  /// **'Due {date}'**
  String opsDueOn(String date);

  /// No description provided for @opsOverdueCount.
  ///
  /// In en, this message translates to:
  /// **'{count} overdue'**
  String opsOverdueCount(int count);

  /// No description provided for @opsCustomsOpenCount.
  ///
  /// In en, this message translates to:
  /// **'{count} customs open'**
  String opsCustomsOpenCount(int count);

  /// No description provided for @opsPodWithDesk.
  ///
  /// In en, this message translates to:
  /// **'Proof of delivery is with the desk to verify. KCPL marks {reference} Delivered once it is checked.'**
  String opsPodWithDesk(String reference);

  /// No description provided for @opsExceptionOpened.
  ///
  /// In en, this message translates to:
  /// **'The desk has an exception on {reference} to follow up and arrange the next attempt.'**
  String opsExceptionOpened(String reference);

  /// No description provided for @opsSendTo.
  ///
  /// In en, this message translates to:
  /// **'Send to {reference}'**
  String opsSendTo(String reference);

  /// No description provided for @opsAttemptN.
  ///
  /// In en, this message translates to:
  /// **'Attempt {number}'**
  String opsAttemptN(int number);

  /// No description provided for @opsSignedBy.
  ///
  /// In en, this message translates to:
  /// **'{signer} · tap to sign again'**
  String opsSignedBy(String signer);

  /// No description provided for @opsWithinMetres.
  ///
  /// In en, this message translates to:
  /// **'Within {metres} m · recorded with the delivery'**
  String opsWithinMetres(int metres);

  /// No description provided for @opsMineCount.
  ///
  /// In en, this message translates to:
  /// **'Mine · {count}'**
  String opsMineCount(int count);

  /// No description provided for @opsAllCount.
  ///
  /// In en, this message translates to:
  /// **'All · {count}'**
  String opsAllCount(int count);

  /// No description provided for @opsDirectionsTo.
  ///
  /// In en, this message translates to:
  /// **'Directions to {place}'**
  String opsDirectionsTo(String place);

  /// No description provided for @opsOutForDeliveryAttempt.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery · attempt {number}'**
  String opsOutForDeliveryAttempt(int number);

  /// No description provided for @opsReorder.
  ///
  /// In en, this message translates to:
  /// **'Reorder {reference}'**
  String opsReorder(String reference);

  /// No description provided for @opsSaveTo.
  ///
  /// In en, this message translates to:
  /// **'Save to {reference}'**
  String opsSaveTo(String reference);

  /// No description provided for @opsNowWith.
  ///
  /// In en, this message translates to:
  /// **'{reference} is now with {name}.'**
  String opsNowWith(String reference, String name);

  /// No description provided for @podTitle.
  ///
  /// In en, this message translates to:
  /// **'Proof of delivery'**
  String get podTitle;

  /// No description provided for @podReceivedBy.
  ///
  /// In en, this message translates to:
  /// **'Received by {name}'**
  String podReceivedBy(String name);

  /// No description provided for @podReceivedByAs.
  ///
  /// In en, this message translates to:
  /// **'Received by {name}, {relation}'**
  String podReceivedByAs(String name, String relation);

  /// No description provided for @podDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered {date}'**
  String podDelivered(String date);

  /// No description provided for @podChecked.
  ///
  /// In en, this message translates to:
  /// **'Checked by KCPL'**
  String get podChecked;

  /// No description provided for @podSignature.
  ///
  /// In en, this message translates to:
  /// **'Signature'**
  String get podSignature;

  /// No description provided for @podPhoto.
  ///
  /// In en, this message translates to:
  /// **'Delivery photo {number}'**
  String podPhoto(int number);

  /// No description provided for @podDocument.
  ///
  /// In en, this message translates to:
  /// **'Delivery document'**
  String get podDocument;

  /// No description provided for @podNothingShared.
  ///
  /// In en, this message translates to:
  /// **'KCPL checked this delivery. No signature or photos were shared.'**
  String get podNothingShared;

  /// No description provided for @podLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load'**
  String get podLoadFailed;

  /// No description provided for @pickupTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get pickupTitle;

  /// No description provided for @pickupAsk.
  ///
  /// In en, this message translates to:
  /// **'KCPL picks up the cargo'**
  String get pickupAsk;

  /// No description provided for @pickupAskBody.
  ///
  /// In en, this message translates to:
  /// **'Say when and where. The pickup desk confirms the time with you.'**
  String get pickupAskBody;

  /// No description provided for @pickupDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get pickupDate;

  /// No description provided for @pickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get pickupWindow;

  /// No description provided for @pickupMorning.
  ///
  /// In en, this message translates to:
  /// **'Morning'**
  String get pickupMorning;

  /// No description provided for @pickupAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Afternoon'**
  String get pickupAfternoon;

  /// No description provided for @pickupAnyTime.
  ///
  /// In en, this message translates to:
  /// **'Any time'**
  String get pickupAnyTime;

  /// No description provided for @pickupAddress.
  ///
  /// In en, this message translates to:
  /// **'Pickup address'**
  String get pickupAddress;

  /// No description provided for @pickupContactName.
  ///
  /// In en, this message translates to:
  /// **'Contact person (optional)'**
  String get pickupContactName;

  /// No description provided for @pickupContactPhone.
  ///
  /// In en, this message translates to:
  /// **'Contact phone (optional)'**
  String get pickupContactPhone;

  /// No description provided for @pickupNeedAddress.
  ///
  /// In en, this message translates to:
  /// **'Enter where the cargo is to be picked up.'**
  String get pickupNeedAddress;

  /// No description provided for @pickupFootnote.
  ///
  /// In en, this message translates to:
  /// **'A request: the pickup desk schedules it once your booking is confirmed.'**
  String get pickupFootnote;

  /// No description provided for @pickupAsked.
  ///
  /// In en, this message translates to:
  /// **'Pickup asked for {date}'**
  String pickupAsked(String date);

  /// No description provided for @statementTitle.
  ///
  /// In en, this message translates to:
  /// **'Account statement'**
  String get statementTitle;

  /// No description provided for @statementSubtitle.
  ///
  /// In en, this message translates to:
  /// **'PDF · owed, overdue and payments, last 12 months'**
  String get statementSubtitle;

  /// No description provided for @statementFailed.
  ///
  /// In en, this message translates to:
  /// **'The statement couldn\'t be downloaded.'**
  String get statementFailed;

  /// No description provided for @textTitle.
  ///
  /// In en, this message translates to:
  /// **'SMS and WhatsApp'**
  String get textTitle;

  /// No description provided for @textOff.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get textOff;

  /// No description provided for @textSms.
  ///
  /// In en, this message translates to:
  /// **'SMS'**
  String get textSms;

  /// No description provided for @textWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get textWhatsapp;

  /// No description provided for @textPhone.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get textPhone;

  /// No description provided for @textPhoneHintSms.
  ///
  /// In en, this message translates to:
  /// **'98XXXXXXXX'**
  String get textPhoneHintSms;

  /// No description provided for @textPhoneHintWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'+977 98XXXXXXXX'**
  String get textPhoneHintWhatsapp;

  /// No description provided for @textConsent.
  ///
  /// In en, this message translates to:
  /// **'I agree to receive KCPL shipment and invoice messages on this number.'**
  String get textConsent;

  /// No description provided for @textNeedConsent.
  ///
  /// In en, this message translates to:
  /// **'Tick the box to agree to these messages.'**
  String get textNeedConsent;

  /// No description provided for @textFootnote.
  ///
  /// In en, this message translates to:
  /// **'The same updates as your notifications, shortened to one message, for when the app isn\'t to hand. Turn off any time.'**
  String get textFootnote;

  /// No description provided for @textSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get textSave;

  /// No description provided for @textSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get textSaved;

  /// No description provided for @docreqNeeded.
  ///
  /// In en, this message translates to:
  /// **'KCPL needs your {document}'**
  String docreqNeeded(String document);

  /// No description provided for @docreqResend.
  ///
  /// In en, this message translates to:
  /// **'KCPL needs your {document} again'**
  String docreqResend(String document);

  /// No description provided for @docreqBody.
  ///
  /// In en, this message translates to:
  /// **'Scan it now: it goes straight to the team handling {reference}.'**
  String docreqBody(String reference);

  /// No description provided for @docreqScan.
  ///
  /// In en, this message translates to:
  /// **'Scan {document}'**
  String docreqScan(String document);

  /// No description provided for @docreqOther.
  ///
  /// In en, this message translates to:
  /// **'Choose a photo or file instead'**
  String get docreqOther;

  /// No description provided for @opsAddTo.
  ///
  /// In en, this message translates to:
  /// **'Add to {reference}'**
  String opsAddTo(String reference);

  /// No description provided for @opsTaskFootnote.
  ///
  /// In en, this message translates to:
  /// **'For {branch}. Shows on the Job File and the assignee’s task list.'**
  String opsTaskFootnote(String branch);

  /// No description provided for @opsCloseReference.
  ///
  /// In en, this message translates to:
  /// **'Close {reference}'**
  String opsCloseReference(String reference);

  /// No description provided for @opsReceivedBy.
  ///
  /// In en, this message translates to:
  /// **'Received by {name}'**
  String opsReceivedBy(String name);

  /// No description provided for @opsProofCount.
  ///
  /// In en, this message translates to:
  /// **'{count} proof'**
  String opsProofCount(int count);

  /// No description provided for @opsAttemptLabel.
  ///
  /// In en, this message translates to:
  /// **'Attempt {number} · {label}'**
  String opsAttemptLabel(int number, String label);

  /// No description provided for @opsPhotoCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 photo} other{{count} photos}}'**
  String opsPhotoCount(int count);

  /// No description provided for @opsCall.
  ///
  /// In en, this message translates to:
  /// **'Call {name}'**
  String opsCall(String name);

  /// No description provided for @opsWhatsApp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp {name}'**
  String opsWhatsApp(String name);

  /// No description provided for @opsDoneOf.
  ///
  /// In en, this message translates to:
  /// **'{label} · {done} of {total} done'**
  String opsDoneOf(String label, int done, int total);

  /// No description provided for @opsVersion.
  ///
  /// In en, this message translates to:
  /// **'KCPL Ops {version}'**
  String opsVersion(String version);

  /// No description provided for @opsFinding.
  ///
  /// In en, this message translates to:
  /// **'Finding {query}…'**
  String opsFinding(String query);

  /// No description provided for @opsNoJobMatches.
  ///
  /// In en, this message translates to:
  /// **'No job matches {query}'**
  String opsNoJobMatches(String query);

  /// No description provided for @opsJobsMatch.
  ///
  /// In en, this message translates to:
  /// **'{count} jobs match {query}'**
  String opsJobsMatch(int count, String query);

  /// No description provided for @opsDueTodaySummary.
  ///
  /// In en, this message translates to:
  /// **'{count} due today · your route, directions and proof'**
  String opsDueTodaySummary(int count);

  /// No description provided for @opsOverdueTasks.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 overdue task} other{{count} overdue tasks}}'**
  String opsOverdueTasks(int count);

  /// No description provided for @opsCustomsBlocks.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 customs block} other{{count} customs blocks}}'**
  String opsCustomsBlocks(int count);

  /// No description provided for @opsDeliveringToday.
  ///
  /// In en, this message translates to:
  /// **'{count} delivering today'**
  String opsDeliveringToday(int count);

  /// No description provided for @opsUnassignedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} unassigned'**
  String opsUnassignedCount(int count);

  /// No description provided for @opsUrgentCount.
  ///
  /// In en, this message translates to:
  /// **'{count} urgent'**
  String opsUrgentCount(int count);

  /// No description provided for @opsCustomsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} customs'**
  String opsCustomsCount(int count);

  /// No description provided for @opsLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get opsLanguage;

  /// No description provided for @opsSignAbove.
  ///
  /// In en, this message translates to:
  /// **'Sign above the line'**
  String get opsSignAbove;

  /// No description provided for @opsPushPrimerTitle.
  ///
  /// In en, this message translates to:
  /// **'Get alerts as they happen'**
  String get opsPushPrimerTitle;

  /// No description provided for @opsPushPrimerBody.
  ///
  /// In en, this message translates to:
  /// **'Assignments, overdue tasks, customs and exceptions for your jobs, on this phone.'**
  String get opsPushPrimerBody;

  /// No description provided for @opsPushBlockedHelp.
  ///
  /// In en, this message translates to:
  /// **'Allow notifications for KCPL Ops in your phone\'s Settings.'**
  String get opsPushBlockedHelp;

  /// No description provided for @opsLanguageFootnote.
  ///
  /// In en, this message translates to:
  /// **'Records (references, places, notes from the desk) stay as KCPL holds them.'**
  String get opsLanguageFootnote;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ne'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ne':
      return AppLocalizationsNe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
