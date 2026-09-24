// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Nepali (`ne`).
class AppLocalizationsNe extends AppLocalizations {
  AppLocalizationsNe([String locale = 'ne']) : super(locale);

  @override
  String get chromeOverview => 'सारांश';

  @override
  String get chromeShipments => 'ढुवानी';

  @override
  String get chromeDocuments => 'कागजात';

  @override
  String get chromeInvoices => 'बिल';

  @override
  String get chromeSettings => 'सेटिङ';

  @override
  String get chromeAccount => 'खाता';

  @override
  String get chromeAccountSwitchFailed => 'त्यो खाता खोल्न सकिएन।';

  @override
  String get chromePublicSite => 'सार्वजनिक वेबसाइट';

  @override
  String get commonShipment => 'ढुवानी';

  @override
  String get commonRoute => 'मार्ग';

  @override
  String get commonStatus => 'अवस्था';

  @override
  String get commonDocuments => 'कागजात';

  @override
  String get commonUpdated => 'अद्यावधिक';

  @override
  String get commonDownload => 'डाउनलोड';

  @override
  String get commonLoading => 'लोड हुँदै…';

  @override
  String get commonUnavailableTitle => 'यो जानकारी अहिले उपलब्ध छैन';

  @override
  String get commonUnavailableDetail =>
      'KCPL को प्रणालीमा पुग्न सकिएन। केही बेरमा पुनः प्रयास गर्नुहोस्, वा आफ्नो खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।';

  @override
  String get statusBookingConfirmed => 'बुकिङ पुष्टि भयो';

  @override
  String get statusPreparing => 'तयारी हुँदै';

  @override
  String get statusInTransit => 'बाटोमा';

  @override
  String get statusCustomsClearance => 'भन्सार क्लियरेन्स';

  @override
  String get statusOutForDelivery => 'डेलिभरीका लागि निस्कियो';

  @override
  String get statusDelivered => 'डेलिभर भयो';

  @override
  String get statusException => 'समस्या';

  @override
  String get statusUnknown => 'ढुवानी अद्यावधिक';

  @override
  String get modeAir => 'हवाई ढुवानी';

  @override
  String get modeSea => 'समुद्री ढुवानी';

  @override
  String get modeRoad => 'सडक ढुवानी';

  @override
  String get modeUnsure => 'ढुवानी';

  @override
  String get invoiceIssued => 'जारी भयो';

  @override
  String get invoicePartiallyPaid => 'आंशिक भुक्तानी';

  @override
  String get invoicePaid => 'भुक्तानी भयो';

  @override
  String get invoiceOverdue => 'म्याद नाघेको';

  @override
  String get invoiceOpen => 'बाँकी';

  @override
  String get freeTimeLabel => 'फ्री टाइम';

  @override
  String get freeTimeDeadline => 'अन्तिम फ्री दिन';

  @override
  String get freeTimeConsequence =>
      'फ्री टाइम सकिएपछि क्यारियर वा टर्मिनलले सामान रहेको प्रत्येक दिनको भण्डारण र डेमरेज शुल्क लगाउन सक्छ।';

  @override
  String get ftsNotSet => 'फ्री टाइम अवधि तोकिएको छैन।';

  @override
  String get ftsExpiredYesterday =>
      'फ्री टाइम हिजो सकियो। अब शुल्क लाग्न सक्छ।';

  @override
  String ftsExpiredYesterdayAt(String location) {
    return '$location मा फ्री टाइम हिजो सकियो। अब शुल्क लाग्न सक्छ।';
  }

  @override
  String ftsExpiredDays(String days) {
    return 'फ्री टाइम $days दिनअघि सकियो। अब शुल्क लाग्न सक्छ।';
  }

  @override
  String ftsExpiredDaysAt(String location, String days) {
    return '$location मा फ्री टाइम $days दिनअघि सकियो। अब शुल्क लाग्न सक्छ।';
  }

  @override
  String get ftsLastDay => 'आज अन्तिम फ्री दिन हो।';

  @override
  String ftsLastDayAt(String location) {
    return '$location मा आज अन्तिम फ्री दिन हो।';
  }

  @override
  String get ftsOneDay => '१ दिन फ्री टाइम बाँकी छ।';

  @override
  String ftsOneDayAt(String location) {
    return '$location मा १ दिन फ्री टाइम बाँकी छ।';
  }

  @override
  String ftsDays(String days) {
    return '$days दिन फ्री टाइम बाँकी छ।';
  }

  @override
  String ftsDaysAt(String days, String location) {
    return '$location मा $days दिन फ्री टाइम बाँकी छ।';
  }

  @override
  String get roleOwner => 'खाता स्वामी';

  @override
  String get roleMember => 'टोली सदस्य';

  @override
  String get docAirWaybill => 'एयर वेबिल (AWB)';

  @override
  String get docBillOfLading => 'बिल अफ लेडिङ (BL)';

  @override
  String get docRoadConsignmentNote => 'सडक कन्साइनमेन्ट नोट';

  @override
  String get docShippingInstruction => 'शिपिङ इन्स्ट्रक्सन';

  @override
  String get docCargoManifest => 'कार्गो म्यानिफेस्ट';

  @override
  String get docPickupOrder => 'पिकअप अर्डर';

  @override
  String get docCommercialInvoice => 'कमर्सियल इन्भ्वाइस';

  @override
  String get docPackingList => 'प्याकिङ लिस्ट';

  @override
  String get docCustomsDocument => 'भन्सार कागजात';

  @override
  String get docCertificateOfOrigin => 'उत्पत्तिको प्रमाणपत्र';

  @override
  String get docImportPermit => 'आयात अनुमति / इजाजतपत्र';

  @override
  String get docExportPermit => 'निर्यात अनुमति / इजाजतपत्र';

  @override
  String get docDangerousGoodsDeclaration => 'जोखिमयुक्त सामान घोषणा';

  @override
  String get docInsuranceCertificate => 'कार्गो बिमा प्रमाणपत्र';

  @override
  String get docDeliveryOrder => 'डेलिभरी अर्डर';

  @override
  String get docProofOfDelivery => 'डेलिभरीको प्रमाण (POD)';

  @override
  String get docOther => 'अन्य कागजात';

  @override
  String get docUnknown => 'कागजात';

  @override
  String get overviewDescription =>
      'तपाईंका चालू ढुवानी, जारी भएका कागजात र KCPL सँगको खाताको अवस्था।';

  @override
  String get overviewKpiActive => 'चालू ढुवानी';

  @override
  String get overviewKpiInTransit => 'बाटोमा';

  @override
  String get overviewKpiArriving => '७ दिनभित्र आइपुग्ने';

  @override
  String get overviewKpiFreeTime => 'फ्री टाइम सकिँदै';

  @override
  String get overviewKpiDocuments => 'चाहिएका कागजात';

  @override
  String get overviewKpiAttention => 'ध्यान चाहिने';

  @override
  String get overviewFreeTimeTitle => 'फ्री टाइम सकिँदै';

  @override
  String get overviewFreeTimeDescription =>
      'क्यारियरको फ्री दिन सकिएपछि भण्डारण र डेमरेज सुरु हुन्छ। त्यसअघि सामान छुटाए शुल्क लाग्दैन।';

  @override
  String get overviewOutstandingTitle => 'KCPL ले पर्खिरहेको कागजात';

  @override
  String get overviewOutstandingDescription =>
      'सामान अघि बढाइराख्न यी कागजात ढुवानीबाट पठाउनुहोस्।';

  @override
  String get overviewAccountTitle => 'KCPL सँग बाँकी';

  @override
  String get overviewOpenInvoicesOne => '१ बिल बाँकी';

  @override
  String overviewOpenInvoices(String count) {
    return '$count बिल बाँकी';
  }

  @override
  String overviewOverdueCount(String count) {
    return '$count को म्याद नाघेको';
  }

  @override
  String overviewCurrencyOutstanding(String currency) {
    return '$currency बाँकी';
  }

  @override
  String overviewAmountOverdue(String amount) {
    return '$amount म्याद नाघेको';
  }

  @override
  String get overviewNothingOverdue => 'म्याद नाघेको छैन';

  @override
  String get overviewMovementsTitle => 'चालू ढुवानी';

  @override
  String get overviewAllShipments => 'सबै ढुवानी';

  @override
  String overviewNowAt(String location) {
    return 'अहिले $location मा';
  }

  @override
  String get overviewEmptyDeliveredTitle => 'अहिले बाटोमा केही छैन';

  @override
  String get overviewEmptyDeliveredDescription =>
      'तपाईंको खाताका सबै ढुवानी डेलिभर भइसके। सम्पन्न ढुवानी “ढुवानी” अन्तर्गत उपलब्ध रहन्छन्।';

  @override
  String get overviewEmptyNoneTitle => 'अहिलेसम्म कुनै ढुवानी छैन';

  @override
  String get overviewEmptyNoneDescription =>
      'KCPL ले तपाईंको पहिलो ढुवानी बुक गरेपछि यहाँ प्रत्यक्ष अद्यावधिकसहित देखिनेछ।';

  @override
  String get overviewPaperworkTitle => 'हालै जारी भएका कागजात';

  @override
  String get overviewAllDocuments => 'सबै कागजात';

  @override
  String get overviewNoDocumentsTitle => 'अहिलेसम्म कुनै कागजात जारी भएको छैन';

  @override
  String get overviewNoDocumentsDescription =>
      'KCPL ले तपाईंको खातामा जारी गरेपछि बिल अफ लेडिङ, एयर वेबिल र भन्सार कागजात यहाँ देखिनेछन्।';

  @override
  String get overviewViewInvoices => 'बिल हेर्नुहोस्';

  @override
  String get overviewOrigin => 'प्रस्थान';

  @override
  String get overviewDestination => 'गन्तव्य';

  @override
  String get overviewColEta => 'अनुमानित आगमन';

  @override
  String get shipsFocusAll => 'सबै';

  @override
  String get shipsFocusActive => 'चालू';

  @override
  String get shipsFocusInTransit => 'बाटोमा';

  @override
  String get shipsFocusAttention => 'ध्यान चाहिने';

  @override
  String get shipsFocusDelivered => 'डेलिभर भएको';

  @override
  String get shipsSearchPlaceholder => 'सन्दर्भ, मार्ग वा क्यारियर खोज्नुहोस्…';

  @override
  String get shipsEmptyFilteredTitle => 'यो दृश्यमा कुनै ढुवानी मिलेन';

  @override
  String get shipsEmptyFilteredDescription =>
      'अर्को फिल्टर प्रयोग गर्नुहोस् वा खोज हटाउनुहोस्।';

  @override
  String get shipsEmptyTitle => 'अहिलेसम्म कुनै ढुवानी छैन';

  @override
  String get shipsEmptyDescription =>
      'KCPL ले तपाईंको खाताका लागि ढुवानी बुक गरेपछि यहाँ चरण र कागजातसहित देखिनेछ।';

  @override
  String docsCoverage(String scanned, String total) {
    return 'तपाईंका $total मध्ये हालैका $scanned ढुवानी समेटिएको';
  }

  @override
  String get docsAll => 'सबै';

  @override
  String get docsFromKcpl => 'KCPL बाट';

  @override
  String get docsSentByYou => 'तपाईंले पठाएको';

  @override
  String get docsStateConfirmed => 'पुष्टि भयो';

  @override
  String get docsStateResend => 'फेरि पठाउनुहोस्';

  @override
  String get docsStateWithKcpl => 'KCPL सँग';

  @override
  String get docsEmptyFilteredTitle => 'यो दृश्यमा कुनै कागजात मिलेन';

  @override
  String get docsEmptyTitle => 'अहिलेसम्म कुनै कागजात छैन';

  @override
  String get docsEmptyDescription =>
      'KCPL ले तपाईंलाई जारी गर्ने कागजात र तपाईंले ढुवानीबाट पठाउने जुनसुकै कागजात यहाँ सूचीबद्ध हुन्छ।';

  @override
  String get docsSearchPlaceholder =>
      'फाइलको नाम, प्रकार वा ढुवानी खोज्नुहोस्…';

  @override
  String get invPositionTitle => 'मौज्दात';

  @override
  String get invPositionDescription =>
      'बिल जारी भएको मुद्रा अनुसार जोड गरिएको हो; KCPL ले यहाँ मुद्रा साटफेर गर्दैन।';

  @override
  String invInvoicedReceipted(String invoiced, String paid) {
    return '$invoiced बिल जारी · $paid प्राप्त';
  }

  @override
  String get invBillingTitle => 'जारी भएका बिल';

  @override
  String get invColIssued => 'जारी मिति';

  @override
  String get invColDue => 'भुक्तानी मिति';

  @override
  String get invColTotal => 'जम्मा';

  @override
  String get invColPaid => 'भुक्तानी';

  @override
  String get invColBalance => 'बाँकी';

  @override
  String get invOpeningBalance => 'प्रारम्भिक मौज्दात';

  @override
  String get invEmptyTitle => 'कुनै बिल जारी भएको छैन';

  @override
  String get invEmptyDescription =>
      'KCPL ले तपाईंको खातामा बिल जारी गरेपछि यहाँ देखिनेछ।';

  @override
  String get invFootnote =>
      'भुक्तानी सन्दर्भ, बैंक विवरण र क्रेडिट सर्त KCPL लेखा विभागले पुष्टि गर्छ। बिल पुनः जारी गर्नुपरे वा भुक्तानी यहाँ नदेखिए आफ्नो खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।';

  @override
  String get invdStatement => 'विवरण';

  @override
  String get invdColCharge => 'शुल्क';

  @override
  String get invdColQuantity => 'परिमाण';

  @override
  String get invdColUnitPrice => 'प्रति एकाइ मूल्य';

  @override
  String get invdNoLinesTitle => 'छुट्टाछुट्टै शुल्क विवरण छैन';

  @override
  String get invdNoLinesDescription =>
      'यो बिलमा लाइनवार विवरणविनै जम्मा रकम मात्र छ।';

  @override
  String get invdSubtotal => 'उप-जम्मा';

  @override
  String get invdTax => 'कर';

  @override
  String get invdReceipted => 'प्राप्त';

  @override
  String get invdBalanceDue => 'तिर्न बाँकी';

  @override
  String invdIssuedOn(String date) {
    return '$date मा जारी';
  }

  @override
  String invdDueOn(String date) {
    return 'भुक्तानी मिति $date';
  }

  @override
  String get invdNotFoundTitle => 'बिल भेटिएन';

  @override
  String get invdNotFoundDescription => 'आफ्नो बिल सूचीबाट खोल्नुहोस्।';

  @override
  String get invdNoAccessTitle => 'यो लगइनसँग खाताको बिलिङ साझा गरिएको छैन';

  @override
  String get invdNoAccessDescription =>
      'बिलमा पहुँच चाहिएमा आफ्नो खाता स्वामी वा KCPL खाता प्रबन्धकलाई सोध्नुहोस्।';

  @override
  String get shipNotFoundTitle => 'ढुवानी भेटिएन';

  @override
  String get shipNotFoundDescription =>
      'सन्दर्भ जाँच्नुहोस्, वा आफ्नो सूचीबाट ढुवानी खोल्नुहोस्।';

  @override
  String shipOpened(String date) {
    return '$date मा खोलिएको';
  }

  @override
  String shipLastUpdate(String when) {
    return 'अन्तिम अद्यावधिक $when';
  }

  @override
  String get shipFreeTimeExpiredDescription =>
      'यो सामानमा भण्डारण वा डेमरेज शुल्क लागिरहेको हुन सक्छ।';

  @override
  String get shipFreeTimeDescription =>
      'यो मितिअघि सामान छुटाए भण्डारण र डेमरेज शुल्क लाग्दैन।';

  @override
  String get shipLocation => 'स्थान';

  @override
  String get shipAsAdvised => 'सूचना अनुसार';

  @override
  String get shipDaysOverdue => 'नाघेका दिन';

  @override
  String get shipDaysRemaining => 'बाँकी दिन';

  @override
  String get shipChargeAfterExpiry => 'म्यादपछिको शुल्क';

  @override
  String shipPerDay(String currency, String amount) {
    return 'दैनिक $currency $amount';
  }

  @override
  String get shipAllowance => 'अवधि';

  @override
  String shipAllowanceDays(String days) {
    return '$days दिन';
  }

  @override
  String get shipFreeTimeFootnote =>
      'फ्री दिन क्यारियर वा टर्मिनलले दिने हो। थप समय चाहिए आफ्नो KCPL खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।';

  @override
  String get shipMovementTitle => 'ढुवानीको विवरण';

  @override
  String get shipMode => 'माध्यम';

  @override
  String get shipCurrentLocation => 'हालको स्थान';

  @override
  String get shipNotReported => 'जानकारी आएको छैन';

  @override
  String get shipEta => 'अनुमानित आगमन';

  @override
  String get shipCarrierReference => 'क्यारियर सन्दर्भ';

  @override
  String get shipToBeConfirmed => 'पछि पुष्टि हुने';

  @override
  String get shipMilestonesTitle => 'मुख्य चरण';

  @override
  String get shipNoMilestonesTitle => 'अहिलेसम्म कुनै चरण दर्ता भएको छैन';

  @override
  String get shipNoMilestonesDescription =>
      'KCPL ले ढुवानी अघि बढाउँदै जाँदा अद्यावधिक यहाँ देखिनेछ।';

  @override
  String get shipDocumentsDescription =>
      'KCPL ले तपाईंलाई जारी गरेका र तपाईंले पठाएका कागजात।';

  @override
  String get shipNoDocumentsTitle => 'अहिलेसम्म कुनै कागजात छैन';

  @override
  String get shipNoDocumentsDescription =>
      'KCPL ले तपाईंलाई जारी गर्ने र तपाईंले पठाउने कागजात यहाँ सूचीबद्ध हुनेछ।';

  @override
  String get shipsColCarrier => 'क्यारियर';

  @override
  String get xchgTitle => 'KCPL लाई तपाईंबाट के चाहिन्छ';

  @override
  String get xchgStateNeeded => 'चाहिएको';

  @override
  String get xchgStateResend => 'फेरि पठाउनुहोस्';

  @override
  String get xchgStateWithKcpl => 'KCPL सँग';

  @override
  String get xchgStateConfirmed => 'पुष्टि भयो';

  @override
  String get settingsLanguage => 'भाषा';

  @override
  String get settingsSignedInAs => 'साइन इन';

  @override
  String get settingsAccount => 'खाता';

  @override
  String get settingsAccessLevel => 'पहुँच तह';

  @override
  String get settingsProvisioningNote =>
      'तपाईंको KCPL खाता प्रबन्धकले पोर्टल लगइन थप्ने र हटाउने गर्छन्। सहकर्मी थप्न वा यो लगइनले के हेर्न पाउने भन्ने बदल्न उहाँलाई सम्पर्क गर्नुहोस्।';

  @override
  String get appTitle => 'KCPL';

  @override
  String get signInTitle => 'KCPL मा साइन इन गर्नुहोस्';

  @override
  String get signInSubtitle =>
      'कपिलेश्वर कार्गोसँगका तपाईंका ढुवानी, कागजात र बिल।';

  @override
  String get emailLabel => 'इमेल ठेगाना';

  @override
  String get passwordLabel => 'पासवर्ड';

  @override
  String get showPassword => 'पासवर्ड देखाउनुहोस्';

  @override
  String get hidePassword => 'पासवर्ड लुकाउनुहोस्';

  @override
  String get signIn => 'साइन इन';

  @override
  String get signingIn => 'साइन इन हुँदैछ…';

  @override
  String get forgotPassword => 'पासवर्ड बिर्सनुभयो?';

  @override
  String get resetNeedsEmail =>
      'पहिले इमेल ठेगाना लेख्नुहोस्, त्यसपछि पासवर्ड बिर्सनुभयो? छान्नुहोस्।';

  @override
  String get resetSent =>
      'त्यो ठेगानामा KCPL पोर्टल पहुँच छ भने पासवर्ड रिसेट लिङ्क पठाइँदैछ।';

  @override
  String get signInFailed =>
      'साइन इन हुन सकेन। विवरण जाँचेर फेरि प्रयास गर्नुहोस्।';

  @override
  String get tooManyAttempts =>
      'धेरै पटक प्रयास भयो। केही मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।';

  @override
  String get networkError =>
      'KCPL सम्म पुग्न सकिएन। इन्टरनेट जडान जाँचेर फेरि प्रयास गर्नुहोस्।';

  @override
  String get sessionEnded => 'तपाईंको सत्र सकियो। फेरि साइन इन गर्नुहोस्।';

  @override
  String get signOut => 'साइन आउट';

  @override
  String get retry => 'फेरि प्रयास गर्नुहोस्';

  @override
  String get switchAccount => 'खाता बदल्नुहोस्';

  @override
  String get downloading => 'डाउनलोड हुँदैछ…';

  @override
  String get downloadFailed => 'कागजात डाउनलोड हुन सकेन।';

  @override
  String documentSaved(String filename) {
    return '$filename सुरक्षित भयो';
  }

  @override
  String get helpContact =>
      'सहयोग चाहियो? आफ्नो KCPL खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।';

  @override
  String get demoBanner => 'नमुना विवरण, वास्तविक खाता होइन';

  @override
  String appVersion(String version) {
    return 'संस्करण $version';
  }

  @override
  String get modeRail => 'रेल ढुवानी';

  @override
  String get modeCourier => 'कुरियर';

  @override
  String get modeMultimodal => 'बहुमाध्यम ढुवानी';

  @override
  String get pushPrimerTitle => 'सामान सर्ने बित्तिकै थाहा पाउनुहोस्';

  @override
  String get pushPrimerBody =>
      'ढुवानी अघि बढ्दा, कागजात तयार हुँदा वा फ्री टाइम सकिन लाग्दा सूचना पाउनुहोस्।';

  @override
  String get pushTurnOn => 'खोल्नुहोस्';

  @override
  String get pushNotNow => 'अहिले होइन';

  @override
  String get pushSection => 'सूचना';

  @override
  String get pushSetting => 'पुस सूचना';

  @override
  String get pushOn => 'खुला';

  @override
  String get pushOff => 'बन्द';

  @override
  String get pushBlocked => 'फोनको सेटिङमा रोकिएको';

  @override
  String get pushUnavailable => 'यो संस्करणमा उपलब्ध छैन';

  @override
  String get pushBlockedHelp =>
      'फोनको सेटिङमा KCPL का लागि सूचना अनुमति दिनुहोस्।';
}
