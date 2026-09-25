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

  @override
  String homeOnTheWay(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ढुवानी बाटोमा',
      zero: 'बाटोमा केही छैन',
    );
    return '$_temp0';
  }

  @override
  String homeNeedsAttention(int count) {
    return '$count मा ध्यान चाहिन्छ';
  }

  @override
  String homeArriving(int count) {
    return '$count यो हप्ता आइपुग्दै';
  }

  @override
  String get homeAllClear => 'सबै योजनाअनुसार चलिरहेको छ';

  @override
  String get homeNeedsYou => 'तपाईंको काम';

  @override
  String get quoteWhereTo => 'तपाईंको कार्गो कहाँ जाँदैछ?';

  @override
  String get quoteTitle => 'कोटेसन माग्नुहोस्';

  @override
  String get quoteFrom => 'कहाँबाट';

  @override
  String get quoteFromHint => 'उठाउने सहर, बन्दरगाह वा नाका';

  @override
  String get quoteTo => 'कहाँसम्म';

  @override
  String get quoteToHint => 'कहाँ पुग्नुपर्छ';

  @override
  String get quoteYourRoutes => 'तपाईंका रुटहरू';

  @override
  String get quoteModeTitle => 'कसरी ढुवानी गर्ने?';

  @override
  String get quoteModeRoad => 'सडक';

  @override
  String get quoteModeRoadDetail => 'भारत र चीन नाका हुँदै स्थलमार्ग';

  @override
  String get quoteModeSea => 'समुद्री';

  @override
  String get quoteModeSeaDetail =>
      'कोलकाता, हल्दिया वा विशाखापत्तनम हुँदै, ठूला मालका लागि';

  @override
  String get quoteModeAir => 'हवाई';

  @override
  String get quoteModeAirDetail => 'सबैभन्दा छिटो, काठमाडौं (TIA) सम्म';

  @override
  String get quoteModeUnsure => 'KCPL लाई सल्लाह दिन दिनुहोस्';

  @override
  String get quoteModeUnsureDetail =>
      'तपाईंको कार्गोका लागि उत्तम उपाय हामी सुझाउनेछौं';

  @override
  String get quoteCargoTitle => 'कार्गो';

  @override
  String get quoteCargoHint => 'के हो? कपडा, मेसिनरी…';

  @override
  String get quoteWeightHint => 'तौल (ऐच्छिक)';

  @override
  String get quoteWhenTitle => 'कहिले';

  @override
  String get quoteWhenSoon => 'सकेसम्म छिटो';

  @override
  String get quoteWhenWeeks => '२ हप्ताभित्र';

  @override
  String get quoteWhenMonth => 'यो महिना';

  @override
  String get quoteWhenFlexible => 'लचिलो';

  @override
  String get quoteNotesTitle => 'अरू केही';

  @override
  String get quoteNotesHint => 'नाप, प्याकेजिङ, इन्कोटर्म्स, विशेष ह्यान्डलिङ';

  @override
  String get quoteSubmit => 'कोटेसन माग्नुहोस्';

  @override
  String get quoteSending => 'पठाउँदै…';

  @override
  String get quoteNeedsRoute => 'कहाँबाट र कहाँसम्म भन्ने थप्नुहोस्।';

  @override
  String get quoteSentTitle => 'कोटेसन माग गरियो';

  @override
  String quoteSentBody(String route) {
    return 'KCPL ले $route को मूल्य पठाउनेछ।';
  }

  @override
  String get quoteDone => 'सकियो';

  @override
  String get continueWithApple => 'Apple बाट जारी राख्नुहोस्';

  @override
  String get continueWithGoogle => 'Google बाट जारी राख्नुहोस्';

  @override
  String get signInWithEmail => 'इमेलबाट साइन इन गर्नुहोस्';

  @override
  String get orWithEmail => 'वा आफ्नो इमेलबाट';

  @override
  String linkProvider(String provider) {
    return 'यो इमेलमा पहिले नै KCPL पासवर्ड छ। एक पटक त्यसबाट साइन इन गर्नुहोस्, अर्को पटकका लागि $provider जोडिनेछ।';
  }

  @override
  String providerOff(String provider) {
    return 'KCPL मा $provider साइन इन अझै सुरु गरिएको छैन। आफ्नो इमेल र पासवर्ड प्रयोग गर्नुहोस्।';
  }

  @override
  String get sendDocTitle => 'कागजात पठाउनुहोस्';

  @override
  String get sendDocKind => 'यो के हो?';

  @override
  String get sendDocFile => 'कागजात';

  @override
  String sendDocFor(String reference) {
    return '$reference का लागि';
  }

  @override
  String get captureTakePhoto => 'फोटो खिच्नुहोस्';

  @override
  String get captureChoosePhoto => 'फोटो छान्नुहोस्';

  @override
  String get captureChooseFile => 'फाइल छान्नुहोस्';

  @override
  String get captureReplace => 'बदल्नुहोस्';

  @override
  String get captureCameraDenied =>
      'KCPL ले क्यामेरा प्रयोग गर्न सक्दैन। फोनको सेटिङमा अनुमति दिनुहोस्।';

  @override
  String get captureUnsupported => 'PDF, JPEG, PNG वा WEBP फाइल पठाउनुहोस्।';

  @override
  String captureTooLarge(String size) {
    return 'फाइल $size MB वा सोभन्दा सानो हुनुपर्छ।';
  }

  @override
  String get captureHint =>
      'कागज समतल राखी राम्रो उज्यालोमा चारै कुना देखिने गरी खिच्नुहोस्।';

  @override
  String get sendToKcpl => 'KCPL लाई पठाउनुहोस्';

  @override
  String get sending => 'पठाउँदै…';

  @override
  String sendingPercent(String percent) {
    return 'पठाउँदै… $percent%';
  }

  @override
  String get sendDocFootnote =>
      'KCPL ले जाँचेपछि मात्र कागजात मान्य हुन्छ। बिल अफ लेडिङ, भन्सार प्रविष्टि र डेलिभरी प्रमाण KCPL आफैँ राख्छ।';

  @override
  String get sentTitle => 'KCPL लाई पठाइयो';

  @override
  String get sendChooseKind => 'कागजात के हो छान्नुहोस्।';

  @override
  String get sendChooseFile => 'पहिले फोटो वा फाइल थप्नुहोस्।';

  @override
  String get sendAction => 'पठाउनुहोस्';

  @override
  String get confirmPrompt => 'सामान आइपुग्यो?';

  @override
  String get confirmPromptBody =>
      'सामान तपाईंकहाँ आइपुगेको KCPL लाई जानकारी दिनुहोस्।';

  @override
  String get confirmTitle => 'प्राप्ति पुष्टि गर्नुहोस्';

  @override
  String get confirmReceivedBy => 'बुझ्ने व्यक्ति';

  @override
  String get confirmReceivedByHint => 'सामान बुझ्ने व्यक्तिको नाम';

  @override
  String get confirmNote => 'KCPL लाई थाहा हुनुपर्ने कुरा';

  @override
  String get confirmNoteHint => 'अवस्था, नपुगेका टुक्रा, क्षति…';

  @override
  String get confirmPhoto => 'डेलिभरीको फोटो';

  @override
  String get confirmPhotoOptional =>
      'ऐच्छिक। यो KCPL ले हेर्न ढुवानीमा राखिन्छ।';

  @override
  String get confirmFootnote =>
      'यसले सामान आइपुगेको KCPL लाई जानकारी दिन्छ। यो डेलिभरी प्रमाण होइन; त्यो KCPL ले नै राख्छ।';

  @override
  String get confirmedTitle => 'धन्यवाद';

  @override
  String confirmedOn(String date) {
    return 'तपाईंले $date मा प्राप्ति पुष्टि गर्नुभयो';
  }

  @override
  String confirmedBy(String name) {
    return 'बुझ्ने: $name';
  }

  @override
  String get receiptSend => 'भुक्तानी रसिद पठाउनुहोस्';

  @override
  String get receiptTitle => 'भुक्तानी रसिद';

  @override
  String get receiptFile => 'बैंक रसिद वा सूचना';

  @override
  String get receiptAmount => 'तिरेको रकम';

  @override
  String get receiptPaidOn => 'तिरेको मिति';

  @override
  String get receiptNote => 'KCPL लेखाका लागि टिप्पणी';

  @override
  String get receiptNoteHint => 'बैंक, सन्दर्भ नम्बर…';

  @override
  String get receiptFootnote =>
      'बिल परिवर्तन हुनुअघि KCPL लेखाले हरेक रसिद बैंकसँग मिलाउँछ।';

  @override
  String get receiptsTitle => 'तपाईंले पठाएका रसिद';

  @override
  String get receiptWithAccounts => 'KCPL लेखामा';

  @override
  String get receiptAcknowledged => 'स्वीकार गरियो';

  @override
  String get receiptInvalidAmount => 'रकम अङ्कमा लेख्नुहोस्।';

  @override
  String receiptPaidOnDate(String date) {
    return '$date मा तिरेको';
  }

  @override
  String get teamTitle => 'टोली';

  @override
  String get teamInvite => 'सहकर्मीलाई निम्तो दिनुहोस्';

  @override
  String get teamInviteBody =>
      'उहाँले तपाईंका ढुवानी र कागजात हेर्न सक्नुहुन्छ। बिल खाता मालिकसँग मात्र रहन्छ।';

  @override
  String get teamSendInvite => 'निम्तो पठाउनुहोस्';

  @override
  String get teamInvited => 'निम्तो पठाइयो';

  @override
  String teamInviteSentBody(String email) {
    return '$email ले पासवर्ड राख्न इमेल पाउनुहुनेछ।';
  }

  @override
  String teamInviteLinkBody(String email) {
    return 'KCPL को इमेल अझै सेटअप छैन, त्यसैले यो लिङ्क $email लाई आफैँ पठाउनुहोस्। यो एक पटक मात्र चल्छ।';
  }

  @override
  String get teamShareLink => 'लिङ्क सेयर गर्नुहोस्';

  @override
  String get teamStateActive => 'सक्रिय';

  @override
  String get teamStateInvited => 'निम्तो पठाइएको';

  @override
  String get teamStateOff => 'बन्द';

  @override
  String get teamStateLinked => 'KCPL ले जोडेको';

  @override
  String get teamYou => 'तपाईं';

  @override
  String teamLastSeen(String date) {
    return 'अन्तिम साइन इन $date';
  }

  @override
  String get teamNeverSignedIn => 'अहिलेसम्म साइन इन गर्नुभएको छैन';

  @override
  String get teamTurnOff => 'लगइन बन्द गर्नुहोस्';

  @override
  String get teamTurnOn => 'लगइन फेरि खोल्नुहोस्';

  @override
  String teamTurnOffBody(String email) {
    return 'तपाईंले फेरि नखोलेसम्म $email ले साइन इन गर्न सक्नुहुने छैन।';
  }

  @override
  String get cancel => 'रद्द गर्नुहोस्';

  @override
  String get teamFootnote =>
      'सदस्यले ढुवानी र कागजात हेर्न सक्छन्। अर्को खाता मालिक KCPL ले मात्र थप्न सक्छ।';

  @override
  String get teamLinkedFootnote =>
      'KCPL ले जोडेको लगइन अर्को खाताको हो। हटाउन KCPL लाई भन्नुहोस्।';

  @override
  String offlineAsOf(String time) {
    return 'अफलाइन · $time सम्मको';
  }

  @override
  String get lockSection => 'गोपनीयता';

  @override
  String lockRequire(String method) {
    return '$method आवश्यक';
  }

  @override
  String lockFootnote(String method) {
    return 'एक मिनेटभन्दा बढी बाहिर रहेर फर्कंदा KCPL ले $method माग्छ, र एप स्विचरमा विवरण लुकाउँछ।';
  }

  @override
  String get lockTitle => 'KCPL लक छ';

  @override
  String get lockUnlock => 'खोल्नुहोस्';

  @override
  String get lockReason => 'आफ्नो KCPL खाता खोल्नुहोस्';

  @override
  String get lockFaceId => 'Face ID';

  @override
  String get lockTouchId => 'Touch ID';

  @override
  String get lockFingerprint => 'औंठाछाप';

  @override
  String get lockPasscode => 'पासकोड';

  @override
  String get shareStatus => 'स्थिति सेयर गर्नुहोस्';

  @override
  String shareExpected(String date) {
    return 'अपेक्षित मिति $date';
  }

  @override
  String shareDeliveredOn(String date) {
    return '$date मा डेलिभर भयो';
  }

  @override
  String get shareFooter => 'कपिलेश्वर कार्गो · KCPL एपबाट सेयर गरिएको';

  @override
  String shareCarrierRef(String reference) {
    return 'ढुवानी कम्पनीको सन्दर्भ $reference';
  }
}
