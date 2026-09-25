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
