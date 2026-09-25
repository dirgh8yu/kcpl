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
  String get topicShipmentUpdates => 'ढुवानीका मुख्य चरण';

  @override
  String get topicDocuments => 'कागजातको माग र जारी';

  @override
  String get topicFreeTime => 'फ्री टाइम सकिँदै';

  @override
  String get topicInvoices => 'भुक्तानी गर्नुपर्ने बिल';

  @override
  String get topicShipmentUpdatesHint =>
      'ढुवानी बुक हुँदा, हिँड्दा, भन्सार पास हुँदा, डेलिभरीका लागि निस्कँदा वा डेलिभर हुँदा।';

  @override
  String get topicDocumentsHint =>
      'KCPL लाई तपाईंबाट कागजात चाहिँदा, वा तपाईंको खातामा कागजात जारी हुँदा।';

  @override
  String get topicFreeTimeHint =>
      'बन्दरगाह वा डिपोमा रहेको सामानमा भण्डारण वा डेमरेज शुल्क सुरु हुनुअघि।';

  @override
  String get topicInvoicesHint =>
      'बिल तिर्ने मितिभन्दा तीन दिनअघि, र म्याद नाघेमा।';

  @override
  String get settingsEmailTitle => 'हामी तपाईंलाई के पठाउँछौँ';

  @override
  String get settingsEmailDescription =>
      'मुख्य चरणहरू घटेकै बेला पठाइन्छ, एकमुष्ट सारांशका रूपमा होइन।';

  @override
  String get settingsSaveFailed => 'परिवर्तन सुरक्षित गर्न सकिएन।';

  @override
  String get reqQuotesTitle => 'तपाईंलाई जारी भएका कोटेशन';

  @override
  String get reqQuotesDescription =>
      'KCPL ले पुष्टि गरेका मूल्य। अघि बढ्न भन्नुहोस्, खाता प्रबन्धकले कोटेशनलाई बुकिङमा बदल्नेछन्।';

  @override
  String get reqColQuote => 'कोटेशन';

  @override
  String get reqColValid => 'मान्य रहने मिति';

  @override
  String get reqAskToProceed => 'अघि बढ्न भन्नुहोस्';

  @override
  String get reqNoQuotesTitle => 'अहिलेसम्म कुनै कोटेशन छैन';

  @override
  String get reqNoQuotesDescription =>
      'KCPL ले तपाईंको खातामा जारी गरेका कोटेशन मूल्य र मान्य अवधिसहित यहाँ देखिनेछन्।';

  @override
  String get reqProgressTitle => 'KCPL ले काम गरिरहेका अनुरोध';

  @override
  String get reqProgressDescription => 'अहिलेसम्म मूल्य नतोकिएका अनुरोध।';

  @override
  String reqBookingSent(String reference) {
    return '$reference अघि बढाउन चाहनुभएको जानकारी KCPL लाई दिइयो।';
  }

  @override
  String get reqBookingFailed => 'बुकिङ अनुरोध पठाउन सकिएन।';

  @override
  String reqRaisedOn(String date) {
    return '$date मा राखिएको';
  }

  @override
  String get reqNothingWaitingTitle => 'केही पर्खाइमा छैन';

  @override
  String get reqNothingWaitingDescription =>
      'तपाईंले राख्नुभएका सबै अनुरोधको मूल्य तोकिएको छ।';

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

  @override
  String get quotesTitle => 'कोटेशन';

  @override
  String get quotesNew => 'नयाँ अनुरोध';

  @override
  String quoteValidUntil(String date) {
    return '$date सम्म मान्य';
  }

  @override
  String quoteExpired(String date) {
    return '$date मा म्याद सकियो';
  }

  @override
  String get quoteAsked => 'तपाईंले अघि बढ्न भन्नुभयो';

  @override
  String quoteBooked(String reference) {
    return '$reference को रूपमा बुक भयो';
  }

  @override
  String quotePriceFor(String cargo) {
    return '$cargo';
  }

  @override
  String get quoteProceedNote => 'खाता प्रबन्धकलाई केही भन्नु छ भने (ऐच्छिक)';

  @override
  String get quoteProceedFootnote =>
      'खाता प्रबन्धकले तपाईंसँग बुकिङ पक्का गर्नुहुन्छ। त्यसअघि केही बुक वा शुल्क लाग्दैन।';

  @override
  String get quoteProceedDone => 'अनुरोध पठाइयो';

  @override
  String get quoteCargo => 'माल';

  @override
  String get quoteWeight => 'तौल';

  @override
  String get quoteExpiredBody =>
      'यो मूल्यको म्याद सकियो। KCPL सँग नयाँ कोटेशन माग्नुहोस्।';

  @override
  String get payOnline => 'अनलाइन भुक्तानी';

  @override
  String payChoose(String amount) {
    return '$amount यसबाट तिर्नुहोस्';
  }

  @override
  String get payFootnote =>
      'भुक्तानी गेटवेकै पेजमा हुन्छ। यो बिलमा लगाउनुअघि KCPL ले गेटवेसँग भुक्तानी जाँच गर्छ।';

  @override
  String get payWaiting => 'ब्राउजरमा भुक्तानी पूरा गर्नुहोस्';

  @override
  String get payWaitingBody =>
      'सकिएपछि यहाँ फर्कनुहोस्। यो पेजले आफैँ KCPL सँग जाँच्छ।';

  @override
  String get payOpenAgain => 'भुक्तानी पेज फेरि खोल्नुहोस्';

  @override
  String get payPaid => 'भुक्तानी प्राप्त भयो';

  @override
  String payPaidBody(String amount, String invoice) {
    return '$amount $invoice मा लगाइयो।';
  }

  @override
  String get payReview => 'भुक्तानी प्राप्त भयो';

  @override
  String payReviewBody(String invoice) {
    return 'KCPL लेखाले यसलाई $invoice मा लगाएर पुष्टि गर्नेछ।';
  }

  @override
  String get payFailed => 'भुक्तानी पूरा भएन';

  @override
  String get payFailedBody =>
      'KCPL ले कुनै शुल्क लिएको छैन। फेरि प्रयास गर्नुहोस् वा अर्को तरिकाले तिर्नुहोस्।';

  @override
  String get payCouldNotOpen => 'यो फोनमा भुक्तानी पेज खुल्न सकेन।';

  @override
  String get emailSection => 'यसबारे इमेल गर्नुहोस्';

  @override
  String get calendarSection => 'मिति';

  @override
  String get calendarGregorian => 'ईस्वी संवत् (AD)';

  @override
  String get calendarBikramSambat => 'विक्रम संवत् (BS)';

  @override
  String get calendarFootnote =>
      'एपमा मिति कसरी देखिने। ढुवानी र भन्सारका कागजातमा आफ्नै मिति रहन्छ।';

  @override
  String get trackShareLink => 'ट्र्याकिङ लिङ्क सेयर गर्नुहोस्';

  @override
  String get trackShareLinkHint =>
      'लिङ्क भएका जोकोहीले लगइनबिना ३० दिनसम्म यो ढुवानी हेर्न सक्छन्।';

  @override
  String trackShareMessage(String reference, String url) {
    return 'कपिलेश्वर कार्गोमा $reference हेर्नुहोस्: $url';
  }

  @override
  String get trackStopSharing => 'लिङ्क सेयर गर्न बन्द गर्नुहोस्';

  @override
  String trackStopped(String reference) {
    return '$reference का लिङ्क अब चल्दैनन्।';
  }

  @override
  String get trackStoppedNone => 'बन्द गर्नुपर्ने कुनै लिङ्क थिएन।';

  @override
  String get liveFollow => 'लक स्क्रिनमा हेर्नुहोस्';

  @override
  String get liveFollowAndroid => 'सूचनामा हेर्नुहोस्';

  @override
  String get liveFollowingAndroid => 'तपाईंको सूचनामा देखिँदैछ';

  @override
  String get liveUnavailableAndroid => 'सेटिङमा KCPL को सूचना बन्द छ।';

  @override
  String get liveChannel => 'ढुवानीको प्रगति';

  @override
  String get liveFollowing => 'लक स्क्रिनमा छ';

  @override
  String get liveStop => 'हेर्न बन्द गर्नुहोस्';

  @override
  String get liveUnavailable =>
      'सेटिङमा KCPL का लागि Live Activities बन्द छन्।';

  @override
  String get captureScan => 'कागजात स्क्यान गर्नुहोस्';

  @override
  String get msgRow => 'KCPL लाई सन्देश';

  @override
  String get msgRowHint => 'यो ढुवानीबारे, हेर्ने व्यक्तिलाई';

  @override
  String get msgTitle => 'सन्देश';

  @override
  String get msgPlaceholder => 'सन्देश लेख्नुहोस्';

  @override
  String get msgSend => 'पठाउनुहोस्';

  @override
  String get msgEmpty => 'अहिलेसम्म कुनै सन्देश छैन';

  @override
  String get msgEmptyBody =>
      'यो ढुवानीबारे जे पनि सोध्नुहोस्। हेर्ने व्यक्तिले यहीँ र वेबमा जवाफ दिनुहुन्छ।';

  @override
  String get msgYou => 'तपाईं';

  @override
  String get opsMsgRow => 'ग्राहकसँगका सन्देश';

  @override
  String get opsMsgEmptyBody =>
      'ग्राहकले यो ढुवानीबारे सोधेमा यहाँ र जब फाइलमा देखिन्छ।';

  @override
  String get opsMsgFootnote => 'ग्राहकले जवाफमा तपाईंको पहिलो नाम देख्नुहुन्छ।';

  @override
  String get rateTitle => 'यो डेलिभरी कस्तो रह्यो?';

  @override
  String get rateHint => 'एक ट्याप। यो काम गर्ने टोलीकहाँ पुग्छ।';

  @override
  String rateScore(int score) {
    return '५ मा $score';
  }

  @override
  String get rateComment => 'हामीले थाहा पाउनुपर्ने केही? (ऐच्छिक)';

  @override
  String get rateSend => 'मूल्याङ्कन पठाउनुहोस्';

  @override
  String get rateThanks => 'धन्यवाद';

  @override
  String get rateReview => 'सार्वजनिक समीक्षा लेख्नुहोस्';

  @override
  String rateRated(int score) {
    return 'तपाईंले यो डेलिभरीलाई ५ मा $score दिनुभयो';
  }

  @override
  String get estStorageRow => 'भण्डारण शुल्क कति लाग्छ?';

  @override
  String get estStorageTitle => 'भण्डारण र डेमरेज';

  @override
  String estDaysOver(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'फ्री टाइमपछि $days दिन',
      zero: 'फ्री टाइमभित्रै उठाइयो',
    );
    return '$_temp0';
  }

  @override
  String estPerDay(String amount) {
    return 'प्रतिदिन $amount';
  }

  @override
  String estCollect(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिनमा उठाइएमा',
      one: 'भोलि उठाइएमा',
      zero: 'आज उठाइएमा',
    );
    return '$_temp0';
  }

  @override
  String get estCharge => 'अनुमानित शुल्क';

  @override
  String get estLater => 'पछि';

  @override
  String get estSooner => 'छिटो';

  @override
  String get estStorageFoot =>
      'KCPL ले क्यारियरबाट लेखेको दैनिक दरमा। शुल्क क्यारियरकै बिलले तय गर्छ।';

  @override
  String get estNoRate =>
      'यो ढुवानीको दैनिक दर अझै लेखिएको छैन। खाता प्रबन्धकलाई सोध्नुहोस्।';

  @override
  String get estDutyRow => 'भन्सार महसुल अनुमान';

  @override
  String get estDutyTitle => 'भन्सार महसुल अनुमान';

  @override
  String get estCif => 'सामानको मूल्य (CIF, रु.)';

  @override
  String get estDutyRate => 'भन्सार महसुल दर';

  @override
  String get estExcise => 'अन्तःशुल्क';

  @override
  String get estNone => 'छैन';

  @override
  String get estVat => '१३% मूल्य अभिवृद्धि कर';

  @override
  String get estLineDuty => 'भन्सार महसुल';

  @override
  String get estLineExcise => 'अन्तःशुल्क';

  @override
  String get estLineVat => 'मूल्य अभिवृद्धि कर';

  @override
  String get estTotal => 'भन्सारमा अनुमानित जम्मा';

  @override
  String get estDutyFoot =>
      'तपाईंले छानेका दरबाट मोटामोटी अनुमान। तपाईंको सामानको दर HS कोडअनुसार हुन्छ; जाँचपासअघि KCPL ले पक्का गर्छ।';

  @override
  String get qaTrack => 'ढुवानी हेर्नुहोस्';

  @override
  String get qaQuote => 'कोटेशन माग्नुहोस्';

  @override
  String get qaPay => 'बिल तिर्नुहोस्';

  @override
  String get opsSignInTitle => 'KCPL अपरेसन';

  @override
  String get opsSignInSubtitle => 'तपाईंका शाखाका काम, कार्य र सूचना।';

  @override
  String get opsPriorityStandard => 'सामान्य';

  @override
  String get opsPriorityHigh => 'उच्च';

  @override
  String get opsPriorityUrgent => 'अत्यावश्यक';

  @override
  String get opsJustNow => 'भर्खरै';

  @override
  String get opsNoDueDate => 'म्याद छैन';

  @override
  String get opsYours => 'तपाईंको';

  @override
  String get opsUnassigned => 'कसैलाई तोकिएको छैन';

  @override
  String get opsAlerts => 'सूचना';

  @override
  String get opsAllCaughtUp => 'सबै हेरिसकियो';

  @override
  String get opsAlertsEmpty => 'तपाईंका शाखा र कामका सूचना यहाँ देखिन्छन्।';

  @override
  String get opsOutForDelivery => 'डेलिभरीमा निस्कियो';

  @override
  String get opsStartDelivery => 'डेलिभरी सुरु गर्नुहोस्';

  @override
  String get opsTakenBy => 'लैजाने';

  @override
  String get opsDriverHint => 'चालक वा फिल्ड कर्मचारी';

  @override
  String get opsVehicleHint => 'गाडी नम्बर (ऐच्छिक)';

  @override
  String get opsStartFootnote =>
      'अहिले प्रयास सुरु हुन्छ, र जब फाइल तथा ग्राहकलाई डेलिभरीमा निस्केको देखिन्छ।';

  @override
  String get opsRelConsignee => 'प्रापक';

  @override
  String get opsRelStaff => 'उहाँका कर्मचारी';

  @override
  String get opsRelSecurity => 'सुरक्षा गार्ड';

  @override
  String get opsRelFamily => 'परिवार';

  @override
  String get opsRelOther => 'अन्य';

  @override
  String get opsRecipient => 'प्रापक';

  @override
  String get opsNeedRecipient => 'कसले बुझ्नुभयो? नाम लेख्नुहोस्।';

  @override
  String get opsNeedProof =>
      'डेलिभरीको प्रमाणका लागि हस्ताक्षर वा फोटो थप्नुहोस्।';

  @override
  String get opsNeedReason => 'किन डेलिभर हुन सकेन, लेख्नुहोस्।';

  @override
  String get opsSavedOnPhone => 'यो फोनमा सुरक्षित भयो';

  @override
  String get opsSavedDeliveryBody =>
      'सिग्नल छैन। सिग्नल आउनेबित्तिकै डेलिभरी र प्रमाण भएकै समयसहित आफैँ KCPL मा जान्छन्।';

  @override
  String get opsProofSent => 'प्रमाण पठाइयो';

  @override
  String get opsDeliveryRecorded => 'डेलिभरी दर्ता भयो';

  @override
  String get opsAttemptRecorded => 'प्रयास दर्ता भयो';

  @override
  String get opsSendProof => 'डेलिभरीको प्रमाण पठाउनुहोस्';

  @override
  String get opsRecordDelivery => 'डेलिभरी दर्ता गर्नुहोस्';

  @override
  String get opsRecordAttempt => 'प्रयास दर्ता गर्नुहोस्';

  @override
  String get opsProofOfDelivery => 'डेलिभरीको प्रमाण';

  @override
  String get opsDelivery => 'डेलिभरी';

  @override
  String get opsDelivered => 'डेलिभर भयो';

  @override
  String get opsNotDelivered => 'डेलिभर भएन';

  @override
  String get opsRefused => 'अस्वीकार गरियो';

  @override
  String get opsWhere => 'कहाँ';

  @override
  String get opsProofFootnote =>
      'प्रमाण डेस्कमा \'प्राप्त\' भएर पुग्छ। त्यसको जाँच र ढुवानीलाई डेलिभर भएको मान्ने काम डेस्ककै हो।';

  @override
  String get opsExceptionFootnote => 'डेस्कका लागि काममा समस्या खुल्छ।';

  @override
  String get opsReceivedByHeader => 'बुझ्ने';

  @override
  String get opsFullName => 'पूरा नाम';

  @override
  String get opsPhoneOptional => 'फोन (ऐच्छिक)';

  @override
  String get opsRelationHint => 'प्रापकसँगको नाता';

  @override
  String get opsProof => 'प्रमाण';

  @override
  String get opsGetSignature => 'हस्ताक्षर लिनुहोस्';

  @override
  String get opsSigned => 'हस्ताक्षर भयो';

  @override
  String get opsSignAgain => 'फेरि हस्ताक्षर गर्न थिच्नुहोस्';

  @override
  String get opsPhotographDelivery => 'डेलिभरीको फोटो खिच्नुहोस्';

  @override
  String get opsAnotherPhoto => 'अर्को फोटो थप्नुहोस्';

  @override
  String get opsPhotoHint => 'ढोकामा सामान, छाप लागेको डेलिभरी नोट';

  @override
  String get opsWhyRefused => 'किन अस्वीकार गरियो';

  @override
  String get opsWhyNotDelivered => 'किन डेलिभर हुन सकेन';

  @override
  String get opsRefusedHint => 'कार्टुन बिग्रिएको, गलत सामान, अर्डर नगरेको…';

  @override
  String get opsFailedHint => 'ठेगानामा कोही छैन, गेट बन्द, बाटो अवरुद्ध…';

  @override
  String get opsRemovePhoto => 'फोटो हटाउनुहोस्';

  @override
  String get opsLocating => 'तपाईं कहाँ हुनुहुन्छ, खोज्दै…';

  @override
  String get opsNoLocation => 'स्थान उपलब्ध छैन';

  @override
  String get opsLocation => 'स्थान';

  @override
  String get opsLocationHint =>
      'लोकेसन खोलेर फेरि थिच्नुहोस्। यसबिना पनि डेलिभरी दर्ता गर्न सकिन्छ।';

  @override
  String get opsTodaysDeliveries => 'आजका डेलिभरी';

  @override
  String get opsMapsFailed => 'यो फोनमा नक्सा खुल्न सकेन।';

  @override
  String get opsDeliveryOpenFailed =>
      'डेलिभरी खुल्न सकेन। फेरि प्रयास गर्नुहोस्।';

  @override
  String get opsNoDeliveriesMine => 'आज तपाईंका डेलिभरी छैनन्';

  @override
  String get opsNoDeliveries => 'आज कुनै डेलिभरी छैन';

  @override
  String get opsDeliveriesEmpty =>
      'तपाईंका शाखामा चलिरहेका वा आज निस्कने डेलिभरी यहाँ देखिन्छन्।';

  @override
  String get opsRoute => 'रुट';

  @override
  String get opsRouteFootnote =>
      'ह्यान्डल समातेर तान्दै स्टपलाई जाने क्रममा मिलाउनुहोस्। यो क्रम आजभरि रहन्छ।';

  @override
  String get opsRecordedWaiting => 'दर्ता भयो · सिग्नल पर्खँदै';

  @override
  String get opsReadyToGo => 'जान तयार';

  @override
  String get opsDirections => 'बाटो';

  @override
  String get opsRecord => 'दर्ता';

  @override
  String get opsStart => 'सुरु';

  @override
  String get opsNoteSavedOffline =>
      'सिग्नल छैन। यो फोनमा सुरक्षित भयो; आफैँ काममा जान्छ।';

  @override
  String get opsNeedNote => 'नोट लेख्नुहोस् वा फोटो थप्नुहोस्।';

  @override
  String get opsAddToJob => 'काममा थप्नुहोस्';

  @override
  String get opsNoteHint => 'के देख्नुभयो? सिल, क्षति, कोसँग कुरा भयो…';

  @override
  String get opsPhoto => 'फोटो';

  @override
  String get opsPhotoFiled => 'जाँचका लागि कामको कागजात भण्डारमा राखिन्छ।';

  @override
  String get opsFileAs => 'यसरी राख्नुहोस्';

  @override
  String get opsNoteFootnote =>
      'वेबको जब फाइल टाइमलाइनमा तपाईंको नामसहित देखिन्छ।';

  @override
  String get opsSearchStaff => 'नाम वा शाखाले खोज्नुहोस्';

  @override
  String get opsStaffFailed => 'कर्मचारी सूची लोड हुन सकेन।';

  @override
  String get opsNobodyFound => 'कोही भेटिएन';

  @override
  String get opsStaffEmpty =>
      'तपाईंको कुनै शाखामा काम गर्ने कर्मचारी मात्र देखिन्छन्।';

  @override
  String get opsStaffHeader => 'तपाईंका शाखाका कर्मचारी';

  @override
  String get opsAssignJob => 'काम तोक्नुहोस्';

  @override
  String get opsGiveJobTo => 'काम यसलाई दिनुहोस्';

  @override
  String get opsReassignFailed =>
      'काम अरूलाई दिन सकिएन। फेरि प्रयास गर्नुहोस्।';

  @override
  String get opsDone => 'भयो';

  @override
  String get opsNeedTaskTitle => 'कार्यको शीर्षक लेख्नुहोस्।';

  @override
  String get opsNewTask => 'नयाँ कार्य';

  @override
  String get opsTitle => 'शीर्षक';

  @override
  String get opsNotesOptional => 'नोट (ऐच्छिक)';

  @override
  String get opsDue => 'म्याद';

  @override
  String get opsNoDate => 'मिति छैन';

  @override
  String get opsToday5pm => 'आज, बेलुका ५ बजे';

  @override
  String get opsTomorrow10am => 'भोलि, बिहान १० बजे';

  @override
  String get opsPick => 'छान्नुहोस्…';

  @override
  String get opsAssignedTo => 'जिम्मा';

  @override
  String get opsAssignTask => 'कार्य तोक्नुहोस्';

  @override
  String get opsNobodyYet => 'अहिलेसम्म कोही होइन';

  @override
  String get opsBranch => 'शाखा';

  @override
  String get opsNeedOverride =>
      'जे भए पनि किन बन्द गरिँदैछ, लेख्नुहोस् (कम्तीमा ८ अक्षर)।';

  @override
  String get opsNotClosed => 'बन्द भएन: अझै केही बाँकी छ।';

  @override
  String get opsJobClosed => 'काम बन्द भयो';

  @override
  String get opsJobClosedBody => 'जब फाइल तपाईंको नाम र समयसहित बन्द भयो।';

  @override
  String get opsCloseJob => 'काम बन्द गर्नुहोस्';

  @override
  String get opsCloseAnyway => 'जे भए पनि बन्द गर्नुहोस्';

  @override
  String get opsReadyToClose => 'बन्द गर्न तयार';

  @override
  String get opsReadyToCloseBody =>
      'कार्य, भन्सार र डेलिभरीको प्रमाण सबै ठीक छन्।';

  @override
  String get opsStillOpen => 'अझै बाँकी';

  @override
  String get opsOverrideReason => 'जे भए पनि बन्द गर्ने कारण';

  @override
  String get opsOverrideHint => 'तपाईंको नामसहित जब फाइलमा राखिन्छ';

  @override
  String get opsCloseBlockedFootnote =>
      'पहिले यी सक्नुहोस्, वा व्यवस्थापनलाई कारणसहित बन्द गर्न भन्नुहोस्।';

  @override
  String get opsJobNotFound => 'काम भेटिएन';

  @override
  String get opsJobNotFoundBody =>
      'यो बन्द भएको वा तपाईंका शाखाबाहिर सरेको हुन सक्छ।';

  @override
  String get opsOwner => 'जिम्मेवार';

  @override
  String get opsAssignSomeone => 'कसैलाई तोक्नुहोस्';

  @override
  String get opsGiveToSomeone => 'अरूलाई दिनुहोस्';

  @override
  String get opsNoOwner => 'यो काम अझै कसैको जिम्मामा छैन।';

  @override
  String get opsTasks => 'कार्य';

  @override
  String get opsNoTasks =>
      'अहिलेसम्म कार्य छैन। यहाँ वा जब फाइलमा थपेका कार्य दुवैतिर देखिन्छन्।';

  @override
  String get opsCustoms => 'भन्सार';

  @override
  String get opsRequired => 'अनिवार्य';

  @override
  String get opsOptional => 'ऐच्छिक';

  @override
  String get opsBeforeCloseout => 'बन्द गर्नुअघि';

  @override
  String get opsFromField => 'फिल्डबाट';

  @override
  String get opsNotes => 'नोट';

  @override
  String get opsDetails => 'विवरण';

  @override
  String get opsCustomer => 'ग्राहक';

  @override
  String get opsPriority => 'प्राथमिकता';

  @override
  String get opsHandling => 'ह्यान्डलिङ';

  @override
  String get opsInternalRef => 'आन्तरिक सन्दर्भ';

  @override
  String get opsProfitability => 'नाफा';

  @override
  String get opsRevenue => 'आम्दानी';

  @override
  String get opsCost => 'लागत';

  @override
  String get opsProfit => 'नाफा';

  @override
  String get opsMargin => 'मार्जिन';

  @override
  String get opsJobIsClosed => 'यो काम बन्द छ।';

  @override
  String get opsCloseJobEllipsis => 'काम बन्द गर्नुहोस्…';

  @override
  String get opsQueuedDeliveryBody =>
      'यो डेलिभरी तपाईंको फोनमा छ, सिग्नल आउनेबित्तिकै भएकै समयसहित KCPL मा जान्छ।';

  @override
  String get opsDeleteDelivery => 'यो डेलिभरी मेटाउनुहोस्';

  @override
  String get opsRecordHowItWent => 'कस्तो भयो, दर्ता गर्नुहोस्';

  @override
  String get opsAddProof => 'डेलिभरीको प्रमाण थप्नुहोस्';

  @override
  String get opsWaitingForSignal => 'सिग्नल पर्खँदै';

  @override
  String get opsSignature => 'हस्ताक्षर';

  @override
  String get opsDocument => 'कागजात';

  @override
  String get opsScheduled => 'तालिका बनेको';

  @override
  String get opsPodReceived => 'प्रमाण प्राप्त · डेस्कले जाँच्छ';

  @override
  String get opsPodVerified => 'डेलिभरीको प्रमाण जाँचियो';

  @override
  String get opsPodRejected =>
      'डेस्कले प्रमाण अस्वीकार गर्‍यो · नयाँ प्रमाण थप्नुहोस्';

  @override
  String get opsPodNone => 'अहिलेसम्म डेलिभरीको प्रमाण छैन';

  @override
  String get opsQueuedNoteBody =>
      'यो नोट तपाईंको फोनमा छ, KCPL सँग सम्पर्क हुनेबित्तिकै काममा जान्छ।';

  @override
  String get opsDeleteNote => 'नोट मेटाउनुहोस्';

  @override
  String get opsAddNote => 'नोट वा फोटो थप्नुहोस्';

  @override
  String get opsCouldNotOpen => 'यो उपकरणमा खुल्न सकेन।';

  @override
  String get opsChangeNotSaved =>
      'परिवर्तन सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।';

  @override
  String get opsMine => 'मेरा';

  @override
  String get opsAll => 'सबै';

  @override
  String get opsOverdue => 'म्याद नाघेका';

  @override
  String get opsExceptions => 'समस्या';

  @override
  String get opsJobs => 'काम';

  @override
  String get opsScan => 'स्क्यान';

  @override
  String get opsSearchJobs => 'सन्दर्भ, ग्राहक, रुट वा जिम्मेवार खोज्नुहोस्…';

  @override
  String get opsNoActiveJobs => 'सक्रिय काम छैन';

  @override
  String get opsNothingMatches => 'केही मिलेन';

  @override
  String get opsJobsEmpty => 'तपाईंका शाखाका काम यहाँ देखिन्छन्।';

  @override
  String get opsJobsNoMatch =>
      'अर्को फिल्टर प्रयोग गर्नुहोस् वा खोज हटाउनुहोस्।';

  @override
  String get opsMe => 'म';

  @override
  String get opsRole => 'भूमिका';

  @override
  String get opsBranches => 'शाखा';

  @override
  String get opsAllBranches => 'सबै शाखा';

  @override
  String get opsCostsAndMargins => 'लागत र मार्जिन';

  @override
  String get opsVisible => 'देखिन्छ';

  @override
  String get opsNotShared => 'यो भूमिकालाई देखाइँदैन';

  @override
  String get opsRolesFootnote =>
      'भूमिका र शाखा पहुँच KCPL व्यवस्थापनले वेब एडमिनबाट मिलाउँछ।';

  @override
  String get opsNotifications => 'सूचना';

  @override
  String get opsSignOut => 'साइन आउट';

  @override
  String get opsToday => 'आज';

  @override
  String get opsDemoBanner => 'नमुना डाटा, वास्तविक काम होइन';

  @override
  String get opsReadingText => 'अक्षर पढ्दै…';

  @override
  String get opsPointAtCode => 'बारकोड वा QR कोडतिर देखाउनुहोस्';

  @override
  String get opsScanHint =>
      'वा ढोकाबाट कन्टेनर नम्बर पढ्नुहोस्, वा सन्दर्भ टाइप गर्नुहोस्।';

  @override
  String get opsReadText => 'अक्षर पढ्नुहोस्';

  @override
  String get opsTypeIt => 'टाइप गर्नुहोस्';

  @override
  String get opsNoNumber => 'त्यो फोटोमा नम्बर छैन';

  @override
  String get opsTapNumber => 'खोज्ने नम्बर थिच्नुहोस्';

  @override
  String get opsTryCloser =>
      'नजिकबाट, सिधा, राम्रो उज्यालोमा प्रयास गर्नुहोस्।';

  @override
  String get opsCheckDigitFirst =>
      'चेक डिजिट मिलेका कन्टेनर नम्बर पहिले आउँछन्।';

  @override
  String get opsScanAgain => 'फेरि स्क्यान गर्नुहोस्';

  @override
  String get opsLookupHint => 'काम, कन्टेनर, B/L वा AWB नम्बर';

  @override
  String get opsFindJob => 'काम खोज्नुहोस्';

  @override
  String get opsBackToCamera => 'क्यामेरामा फर्कनुहोस्';

  @override
  String get opsNoMatchBody =>
      'तपाईंका शाखाका काम मात्र भेटिन्छन्। नम्बर जाँच्नुहोस्, वा कामहरूमा खोज्नुहोस्।';

  @override
  String get opsCameraDenied =>
      'स्क्यान गर्न सेटिङमा KCPL Ops लाई क्यामेरा दिनुहोस्। तल सन्दर्भ टाइप गर्न सकिन्छ।';

  @override
  String get opsCameraUnavailable =>
      'क्यामेरा उपलब्ध छैन। तल सन्दर्भ टाइप गर्न सकिन्छ।';

  @override
  String get opsCancel => 'रद्द गर्नुहोस्';

  @override
  String get opsClear => 'मेटाउनुहोस्';

  @override
  String get opsSignatureArea =>
      'हस्ताक्षर गर्ने ठाउँ। एउटा औँलाले हस्ताक्षर गर्नुहोस्।';

  @override
  String get opsNeedsAction => 'काम गर्नुपर्ने';

  @override
  String get opsMoving => 'गतिमा';

  @override
  String get opsAllJobs => 'सबै काम';

  @override
  String get opsNothingWaiting => 'तपाईंलाई पर्खिरहेको केही छैन';

  @override
  String get opsNothingWaitingBody =>
      'तपाईंका शाखाका कुनै सक्रिय काममा अहिले ध्यान चाहिँदैन।';

  @override
  String opsMinutesAgo(int minutes) {
    return '$minutes मिनेटअघि';
  }

  @override
  String opsHoursAgo(int hours) {
    return '$hours घण्टाअघि';
  }

  @override
  String opsDaysAgo(int days) {
    return '$days दिनअघि';
  }

  @override
  String opsOverdueDue(String when) {
    return 'म्याद नाघ्यो · $when';
  }

  @override
  String opsDueToday(String time) {
    return 'आज $time सम्म';
  }

  @override
  String opsDueTomorrow(String time) {
    return 'भोलि $time सम्म';
  }

  @override
  String opsDueOn(String date) {
    return '$date सम्म';
  }

  @override
  String opsOverdueCount(int count) {
    return '$count म्याद नाघेका';
  }

  @override
  String opsCustomsOpenCount(int count) {
    return '$count भन्सार बाँकी';
  }

  @override
  String opsPodWithDesk(String reference) {
    return 'डेलिभरीको प्रमाण जाँचका लागि डेस्कमा छ। जाँचपछि KCPL ले $reference लाई डेलिभर भएको मान्छ।';
  }

  @override
  String opsExceptionOpened(String reference) {
    return 'डेस्कले $reference मा समस्या हेरेर अर्को प्रयास मिलाउनेछ।';
  }

  @override
  String opsSendTo(String reference) {
    return '$reference मा पठाउनुहोस्';
  }

  @override
  String opsAttemptN(int number) {
    return 'प्रयास $number';
  }

  @override
  String opsSignedBy(String signer) {
    return '$signer · फेरि हस्ताक्षर गर्न थिच्नुहोस्';
  }

  @override
  String opsWithinMetres(int metres) {
    return '$metres मिटरभित्र · डेलिभरीसँगै दर्ता हुन्छ';
  }

  @override
  String opsMineCount(int count) {
    return 'मेरा · $count';
  }

  @override
  String opsAllCount(int count) {
    return 'सबै · $count';
  }

  @override
  String opsDirectionsTo(String place) {
    return '$place सम्मको बाटो';
  }

  @override
  String opsOutForDeliveryAttempt(int number) {
    return 'डेलिभरीमा निस्कियो · प्रयास $number';
  }

  @override
  String opsReorder(String reference) {
    return '$reference को क्रम मिलाउनुहोस्';
  }

  @override
  String opsSaveTo(String reference) {
    return '$reference मा सुरक्षित गर्नुहोस्';
  }

  @override
  String opsNowWith(String reference, String name) {
    return '$reference अब $name को जिम्मामा छ।';
  }

  @override
  String opsAddTo(String reference) {
    return '$reference मा थप्नुहोस्';
  }

  @override
  String opsTaskFootnote(String branch) {
    return '$branch का लागि। जब फाइल र जिम्मा पाउनेको कार्यसूचीमा देखिन्छ।';
  }

  @override
  String opsCloseReference(String reference) {
    return '$reference बन्द गर्नुहोस्';
  }

  @override
  String opsReceivedBy(String name) {
    return '$name ले बुझ्नुभयो';
  }

  @override
  String opsProofCount(int count) {
    return '$count प्रमाण';
  }

  @override
  String opsAttemptLabel(int number, String label) {
    return 'प्रयास $number · $label';
  }

  @override
  String opsPhotoCount(int count) {
    return '$count फोटो';
  }

  @override
  String opsCall(String name) {
    return '$name लाई फोन गर्नुहोस्';
  }

  @override
  String opsWhatsApp(String name) {
    return '$name लाई WhatsApp गर्नुहोस्';
  }

  @override
  String opsDoneOf(String label, int done, int total) {
    return '$label · $total मध्ये $done सकियो';
  }

  @override
  String opsVersion(String version) {
    return 'KCPL Ops $version';
  }

  @override
  String opsFinding(String query) {
    return '$query खोज्दै…';
  }

  @override
  String opsNoJobMatches(String query) {
    return '$query सँग कुनै काम मिलेन';
  }

  @override
  String opsJobsMatch(int count, String query) {
    return '$query सँग $count काम मिले';
  }

  @override
  String opsDueTodaySummary(int count) {
    return 'आज $count · तपाईंको रुट, बाटो र प्रमाण';
  }

  @override
  String opsOverdueTasks(int count) {
    return '$count म्याद नाघेका कार्य';
  }

  @override
  String opsCustomsBlocks(int count) {
    return '$count भन्सार अवरोध';
  }

  @override
  String opsDeliveringToday(int count) {
    return 'आज $count डेलिभरी';
  }

  @override
  String opsUnassignedCount(int count) {
    return '$count तोकिएका छैनन्';
  }

  @override
  String opsUrgentCount(int count) {
    return '$count अत्यावश्यक';
  }

  @override
  String opsCustomsCount(int count) {
    return '$count भन्सार';
  }

  @override
  String get opsLanguage => 'भाषा';

  @override
  String get opsSignAbove => 'रेखामाथि हस्ताक्षर गर्नुहोस्';

  @override
  String get opsPushPrimerTitle => 'सूचना तुरुन्तै पाउनुहोस्';

  @override
  String get opsPushPrimerBody =>
      'तपाईंका कामका जिम्मा, म्याद नाघेका कार्य, भन्सार र समस्या यो फोनमा।';

  @override
  String get opsPushBlockedHelp =>
      'फोनको सेटिङमा KCPL Ops लाई सूचना दिन अनुमति दिनुहोस्।';

  @override
  String get opsLanguageFootnote =>
      'रेकर्ड (सन्दर्भ, ठाउँ, डेस्कका नोट) KCPL मा जस्तो छ त्यस्तै रहन्छ।';
}
