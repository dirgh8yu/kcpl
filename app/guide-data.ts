import type { SiteLocale } from "./site-i18n";

export const guideSlugs = ["importing-to-nepal", "exporting-from-nepal"] as const;
export type GuideSlug = (typeof guideSlugs)[number];

type Guide = {
  title: string;
  description: string;
  intro: string;
  routeTitle: string;
  stages: { title: string; copy: string }[];
  documentsTitle: string;
  documentsIntro: string;
  documents: string[];
  questionsTitle: string;
  questions: { question: string; answer: string }[];
  cta: string;
  related: string;
};

export const guides: Record<SiteLocale, Record<GuideSlug, Guide>> = {
  en: {
    "importing-to-nepal": {
      title: "Importing Freight to Nepal",
      description: "A practical guide to importing freight into Nepal: choosing an Indian gateway, preparing shipment documents, planning transit and customs handovers, and arranging final delivery.",
      intro: "An ocean import into Nepal does not end when the vessel reaches India. The gateway, transit movement, border clearance and final delivery have to be planned as one shipment.",
      routeTitle: "How the movement is planned",
      stages: [
        { title: "01 / Establish the cargo and delivery point", copy: "Share the origin, destination in Nepal, cargo description, dimensions, weight and delivery terms. These determine whether ocean, air or road is suitable and whether specialist equipment is needed." },
        { title: "02 / Connect the gateway to the inland leg", copy: "For ocean freight, the Indian gateway and onward rail-linked or road movement must fit the cargo and consignee. Kolkata, Haldia and Visakhapatnam are possible gateways; the workable route is confirmed for each shipment." },
        { title: "03 / Align release, clearance and delivery", copy: "Transport documents, the delivery order, transit records and Nepal customs paperwork need to match. Delivery is then arranged against release, unloading capacity and the consignee's receiving window." },
      ],
      documentsTitle: "What to prepare before booking",
      documentsIntro: "Requirements vary by commodity, origin and import regime. KCPL can review the shipment record before the booking is finalised; this is a planning checklist, not a customs determination.",
      documents: ["Commercial invoice and packing list with consistent quantities and descriptions", "Buyer and consignee details, delivery address and agreed Incoterm", "Cargo dimensions, gross weight and any dangerous-goods or permit information", "Draft bill of lading or air waybill details and the planned Indian gateway", "Any licences, certificates or approvals relevant to the commodity"],
      questionsTitle: "Common planning questions",
      questions: [
        { question: "Can KCPL arrange the inland leg after an Indian port?", answer: "Yes. KCPL coordinates Indian-gateway handovers, road or rail-linked transit, Nepal entry and delivery arrangements through the relevant service partners. The route and responsibilities are confirmed in the quotation." },
        { question: "Can you confirm duties or a guaranteed arrival date here?", answer: "No. Duty and permit treatment depend on the goods and current official requirements. Carrier schedules, border processing and release dates must be checked for the individual shipment." },
      ],
      cta: "Plan an import with KCPL",
      related: "Explore customs and documentation",
    },
    "exporting-from-nepal": {
      title: "Exporting Freight from Nepal",
      description: "A practical guide to exporting from Nepal by air or ocean: collection, cargo and trade documents, Kathmandu and Indian-gateway routes, and coordination with destination agents.",
      intro: "A Nepal export works best when the cargo, collection date, buyer's delivery terms and destination handover are agreed before a carrier is booked.",
      routeTitle: "How the movement is planned",
      stages: [
        { title: "01 / Define the shipment", copy: "Start with the commodity, number of packages, dimensions, weight, destination, required delivery window and buyer's Incoterm. Air from Kathmandu and ocean through an Indian gateway answer different cost and timing needs." },
        { title: "02 / Prepare the export handover", copy: "Confirm packing, collection, export documentation and any commodity-specific approvals before cargo is tendered. The invoice, packing list and transport instructions should describe the same shipment." },
        { title: "03 / Coordinate the destination", copy: "KCPL works with counterpart agents for the overseas leg, pre-alert and delivery planning. The destination party should know who clears, receives and pays for each leg under the agreed terms." },
      ],
      documentsTitle: "What to prepare before booking",
      documentsIntro: "The final document set depends on the product and destination. This checklist helps expose missing information early, not replace official export advice.",
      documents: ["Commercial invoice, packing list and buyer/consignee details", "Package count, dimensions, gross weight and collection address", "Destination, delivery deadline and agreed Incoterm", "Any certificate of origin, licence or product-specific approval required for the movement", "Special handling details for fragile, dangerous, perishable or oversized cargo"],
      questionsTitle: "Common planning questions",
      questions: [
        { question: "Can KCPL coordinate both air and ocean exports?", answer: "Yes. KCPL plans Kathmandu air exports and ocean movements routed through Indian gateways, subject to cargo review, booking availability and service confirmation." },
        { question: "Does KCPL operate its own offices overseas?", answer: "No. Overseas handling and delivery are coordinated with counterpart agents. The quotation should identify the scope and handovers for the specific shipment." },
      ],
      cta: "Plan an export with KCPL",
      related: "Explore freight services",
    },
  },
  ne: {
    "importing-to-nepal": {
      title: "नेपालमा मालसामान आयात",
      description: "नेपालमा मालसामान आयात गर्ने व्यावहारिक मार्गदर्शिका: भारतीय गेटवे, कागजात, ट्रान्जिट, भन्सार ह्यान्डओभर र अन्तिम डेलिभरी।",
      intro: "समुद्री आयात भारतको बन्दरगाहमा जहाज पुगेपछि सकिँदैन। गेटवे, ट्रान्जिट, सीमा भन्सार र अन्तिम डेलिभरी एउटै मुभमेन्टका रूपमा योजना गर्नुपर्छ।",
      routeTitle: "मुभमेन्ट कसरी योजना हुन्छ",
      stages: [
        { title: "०१ / कार्गो र डेलिभरी स्थान तय", copy: "मूलस्थान, नेपालभित्रको गन्तव्य, सामानको विवरण, आकार, तौल र डेलिभरी सर्त दिनुहोस्। यसैले समुद्री, हवाई वा सडकमार्ग र विशेष उपकरणको आवश्यकता निर्धारण गर्न मद्दत गर्छ।" },
        { title: "०२ / गेटवे र भित्री चरण जोड्ने", copy: "समुद्री ढुवानीमा भारतीय गेटवे र त्यसपछिको रेल-जोडित वा सडक मुभमेन्ट कार्गो र प्राप्तकर्तासँग मिल्नुपर्छ। कोलकाता, हल्दिया र विशाखापट्टनम सम्भावित गेटवे हुन्; उपयुक्त मार्ग हरेक शिपमेन्टमा पुष्टि गरिन्छ।" },
        { title: "०३ / रिलिज, क्लियरेन्स र डेलिभरी मिलाउने", copy: "यातायात कागजात, डेलिभरी अर्डर, ट्रान्जिट रेकर्ड र नेपाल भन्सार कागजात मिल्नुपर्छ। रिलिज, अनलोडिङ क्षमता र प्राप्तकर्ताको समयअनुसार डेलिभरी मिलाइन्छ।" },
      ],
      documentsTitle: "बुकिङअघि के तयार गर्ने",
      documentsIntro: "वस्तु, मूलस्थान र आयात व्यवस्थाअनुसार आवश्यकताहरू फरक हुन्छन्। यो योजना सूची हो, भन्सार निर्णय होइन।",
      documents: ["मात्रा र विवरण मिलेको कमर्सियल इन्भोइस र प्याकिङ लिस्ट", "खरिदकर्ता र प्राप्तकर्ताको विवरण, डेलिभरी ठेगाना र सहमत Incoterm", "कार्गोको आकार, कुल तौल र डेंजरस गुड्स वा परमिटसम्बन्धी जानकारी", "ड्राफ्ट बिल अफ लेडिङ वा एयर वेबिल विवरण र प्रस्तावित भारतीय गेटवे", "वस्तुसँग सम्बन्धित लाइसेन्स, प्रमाणपत्र वा स्वीकृति"],
      questionsTitle: "योजनाका सामान्य प्रश्न",
      questions: [
        { question: "भारतीय बन्दरगाहपछि भित्री ढुवानी KCPL ले मिलाउन सक्छ?", answer: "सक्छ। KCPL ले सेवा साझेदारसँग गेटवे ह्यान्डओभर, सडक वा रेल-जोडित ट्रान्जिट, नेपाल प्रवेश र डेलिभरी समन्वय गर्छ। मार्ग र जिम्मेवारी कोटेसनमा पुष्टि गरिन्छ।" },
        { question: "यहाँबाट भन्सार शुल्क वा पक्का आगमन मिति भन्न सकिन्छ?", answer: "सकिँदैन। शुल्क र परमिट वस्तु तथा हालको आधिकारिक नियममा निर्भर हुन्छन्। क्यारियर तालिका, सीमा प्रक्रिया र रिलिज मिति प्रत्येक शिपमेन्टमा जाँच्नुपर्छ।" },
      ],
      cta: "KCPL सँग आयात योजना गर्नुहोस्",
      related: "भन्सार र कागजात सेवा हेर्नुहोस्",
    },
    "exporting-from-nepal": {
      title: "नेपालबाट मालसामान निर्यात",
      description: "नेपालबाट हवाई वा समुद्री निर्यात गर्ने व्यावहारिक मार्गदर्शिका: कार्गो सङ्कलन, व्यापार कागजात, गेटवे र गन्तव्य एजेन्टसँग समन्वय।",
      intro: "क्यारियर बुक गर्नुअघि कार्गो, उठाउने मिति, खरिदकर्ताको डेलिभरी सर्त र गन्तव्य ह्यान्डओभर तय हुँदा निर्यात सहज हुन्छ।",
      routeTitle: "मुभमेन्ट कसरी योजना हुन्छ",
      stages: [
        { title: "०१ / शिपमेन्ट परिभाषित गर्ने", copy: "वस्तु, प्याकेज संख्या, आकार, तौल, गन्तव्य, आवश्यक समय र खरिदकर्ताको Incoterm बताउनुहोस्। काठमाडौँबाट हवाई र भारतीय गेटवे हुँदै समुद्री मार्गको लागत र समय फरक हुन्छ।" },
        { title: "०२ / निर्यात ह्यान्डओभर तयार गर्ने", copy: "कार्गो पठाउनुअघि प्याकिङ, सङ्कलन, निर्यात कागजात र वस्तुसम्बन्धी स्वीकृति पुष्टि गर्नुहोस्। इन्भोइस, प्याकिङ लिस्ट र यातायात निर्देशनमा एउटै शिपमेन्टको विवरण हुनुपर्छ।" },
        { title: "०३ / गन्तव्यसँग समन्वय गर्ने", copy: "KCPL ले विदेशी चरण, प्रि-अलर्ट र डेलिभरी योजनाका लागि समकक्षी एजेन्टसँग काम गर्छ। सहमत सर्तअनुसार क्लियरेन्स, प्राप्ति र खर्च कसले बेहोर्ने भन्ने स्पष्ट हुनुपर्छ।" },
      ],
      documentsTitle: "बुकिङअघि के तयार गर्ने",
      documentsIntro: "अन्तिम कागजात वस्तु र गन्तव्यअनुसार फरक हुन्छ। यो सूची छुटेको विवरण पहिल्याउन हो, आधिकारिक निर्यात सल्लाहको विकल्प होइन।",
      documents: ["कमर्सियल इन्भोइस, प्याकिङ लिस्ट र खरिदकर्ता/प्राप्तकर्ता विवरण", "प्याकेज संख्या, आकार, कुल तौल र सङ्कलन ठेगाना", "गन्तव्य, डेलिभरी मिति र सहमत Incoterm", "आवश्यक उत्पत्तिको प्रमाणपत्र, लाइसेन्स वा वस्तुसम्बन्धी स्वीकृति", "नाजुक, खतरनाक, बिग्रने वा ठूलो कार्गोका विशेष ह्यान्डलिङ विवरण"],
      questionsTitle: "योजनाका सामान्य प्रश्न",
      questions: [
        { question: "KCPL ले हवाई र समुद्री दुवै निर्यात मिलाउँछ?", answer: "मिलाउँछ। कार्गो समीक्षा, बुकिङ उपलब्धता र सेवा पुष्टिका आधारमा काठमाडौँबाट हवाई तथा भारतीय गेटवे हुँदै समुद्री निर्यात योजना गरिन्छ।" },
        { question: "KCPL का आफ्नै विदेशी कार्यालय छन्?", answer: "छैनन्। विदेशी ह्यान्डलिङ र डेलिभरी समकक्षी एजेन्टसँग समन्वय गरिन्छ। कोटेसनमा हरेक चरणको दायरा र जिम्मेवारी स्पष्ट हुनुपर्छ।" },
      ],
      cta: "KCPL सँग निर्यात योजना गर्नुहोस्",
      related: "ढुवानी सेवाहरू हेर्नुहोस्",
    },
  },
  hi: {
    "importing-to-nepal": {
      title: "नेपाल में माल आयात करना",
      description: "नेपाल आयात की व्यावहारिक गाइड: भारतीय गेटवे, शिपमेंट दस्तावेज़, ट्रांज़िट, सीमा और कस्टम्स हैंडओवर तथा अंतिम डिलीवरी।",
      intro: "भारत के बंदरगाह पर जहाज़ पहुँचने से नेपाल का समुद्री आयात पूरा नहीं होता। गेटवे, ट्रांज़िट, सीमा निकासी और अंतिम डिलीवरी एक ही शिपमेंट की योजना में आने चाहिए।",
      routeTitle: "मूवमेंट की योजना",
      stages: [
        { title: "01 / कार्गो और डिलीवरी स्थान तय करें", copy: "मूल स्थान, नेपाल में गंतव्य, माल का विवरण, आकार, वज़न और डिलीवरी की शर्तें साझा करें। इन्हीं से समुद्र, हवाई या सड़क मार्ग और विशेष उपकरण की आवश्यकता तय होती है।" },
        { title: "02 / गेटवे को अंदरूनी चरण से जोड़ें", copy: "समुद्री माल के लिए भारतीय गेटवे और आगे की रेल-संबद्ध या सड़क यात्रा कार्गो व कंसाइनी के अनुरूप होनी चाहिए। कोलकाता, हल्दिया और विशाखापत्तनम संभावित गेटवे हैं; सही मार्ग हर शिपमेंट पर पुष्टि होता है।" },
        { title: "03 / रिलीज़, कस्टम्स और डिलीवरी मिलाएँ", copy: "परिवहन दस्तावेज़, डिलीवरी ऑर्डर, ट्रांज़िट रिकॉर्ड और नेपाल कस्टम्स कागज़ात एक-दूसरे से मेल खाने चाहिए। रिलीज़ और कंसाइनी की प्राप्ति व्यवस्था के अनुसार डिलीवरी तय होती है।" },
      ],
      documentsTitle: "बुकिंग से पहले क्या तैयार रखें",
      documentsIntro: "आवश्यकताएँ वस्तु, मूल स्थान और आयात व्यवस्था पर निर्भर हैं। यह योजना की सूची है, कस्टम्स निर्णय नहीं।",
      documents: ["मिलते-जुलते विवरण वाला कमर्शियल इनवॉइस और पैकिंग लिस्ट", "खरीदार व कंसाइनी विवरण, डिलीवरी पता और सहमत Incoterm", "कार्गो के आयाम, कुल वज़न और खतरनाक माल या परमिट की जानकारी", "ड्राफ्ट बिल ऑफ लेडिंग या एयर वेबिल और प्रस्तावित भारतीय गेटवे", "वस्तु से जुड़े लाइसेंस, प्रमाणपत्र या अनुमतियाँ"],
      questionsTitle: "योजना के सामान्य प्रश्न",
      questions: [
        { question: "क्या KCPL भारतीय बंदरगाह के बाद अंदरूनी परिवहन करा सकता है?", answer: "हाँ। KCPL संबंधित सेवा भागीदारों के साथ गेटवे हैंडओवर, सड़क या रेल-संबद्ध ट्रांज़िट, नेपाल प्रवेश और डिलीवरी समन्वित करता है। मार्ग और ज़िम्मेदारियाँ कोटेशन में तय होती हैं।" },
        { question: "क्या यहाँ शुल्क या आगमन की पक्की तारीख बताई जा सकती है?", answer: "नहीं। शुल्क और परमिट माल तथा मौजूदा आधिकारिक नियमों पर निर्भर हैं। कैरियर शेड्यूल, सीमा प्रक्रिया और रिलीज़ तारीख हर शिपमेंट के लिए जाँची जाती है।" },
      ],
      cta: "KCPL के साथ आयात की योजना बनाएँ",
      related: "कस्टम्स और दस्तावेज़ सेवा देखें",
    },
    "exporting-from-nepal": {
      title: "नेपाल से माल निर्यात करना",
      description: "नेपाल से हवाई या समुद्री निर्यात की व्यावहारिक गाइड: संग्रह, व्यापार दस्तावेज़, गेटवे मार्ग और गंतव्य एजेंटों से समन्वय।",
      intro: "कैरियर बुक करने से पहले माल, पिकअप तारीख, खरीदार की डिलीवरी शर्तें और गंतव्य हैंडओवर तय हों तो निर्यात बेहतर चलता है।",
      routeTitle: "मूवमेंट की योजना",
      stages: [
        { title: "01 / शिपमेंट तय करें", copy: "वस्तु, पैकेज संख्या, आयाम, वज़न, गंतव्य, डिलीवरी समय और खरीदार का Incoterm बताइए। काठमांडू से हवाई और भारतीय गेटवे से समुद्री मार्ग के समय व लागत अलग हैं।" },
        { title: "02 / निर्यात हैंडओवर तैयार करें", copy: "माल सौंपने से पहले पैकिंग, पिकअप, निर्यात दस्तावेज़ और वस्तु-विशेष अनुमतियाँ जाँचें। इनवॉइस, पैकिंग लिस्ट और परिवहन निर्देश एक ही शिपमेंट का विवरण दें।" },
        { title: "03 / गंतव्य से समन्वय करें", copy: "KCPL विदेशी चरण, प्री-अलर्ट और डिलीवरी योजना के लिए समकक्ष एजेंटों के साथ काम करता है। सहमत शर्तों के अनुसार निकासी, प्राप्ति और हर चरण का खर्च किसका है, यह स्पष्ट हो।" },
      ],
      documentsTitle: "बुकिंग से पहले क्या तैयार रखें",
      documentsIntro: "अंतिम दस्तावेज़ वस्तु और गंतव्य पर निर्भर हैं। यह सूची छूटी जानकारी पकड़ने में मदद करती है, आधिकारिक निर्यात सलाह का विकल्प नहीं है।",
      documents: ["कमर्शियल इनवॉइस, पैकिंग लिस्ट और खरीदार/कंसाइनी विवरण", "पैकेज संख्या, आयाम, कुल वज़न और पिकअप पता", "गंतव्य, डिलीवरी समय और सहमत Incoterm", "ज़रूरी सर्टिफिकेट ऑफ ओरिजिन, लाइसेंस या उत्पाद-विशेष अनुमति", "नाज़ुक, खतरनाक, जल्दी खराब होने वाले या बड़े माल की हैंडलिंग जानकारी"],
      questionsTitle: "योजना के सामान्य प्रश्न",
      questions: [
        { question: "क्या KCPL हवाई और समुद्री दोनों निर्यात समन्वित करता है?", answer: "हाँ। कार्गो समीक्षा, बुकिंग उपलब्धता और सेवा पुष्टि के आधार पर काठमांडू से हवाई तथा भारतीय गेटवे से समुद्री निर्यात की योजना बनती है।" },
        { question: "क्या KCPL के विदेश में अपने कार्यालय हैं?", answer: "नहीं। विदेशी हैंडलिंग और डिलीवरी समकक्ष एजेंटों के साथ समन्वित होती है। कोटेशन में शिपमेंट के हर चरण का दायरा स्पष्ट होना चाहिए।" },
      ],
      cta: "KCPL के साथ निर्यात की योजना बनाएँ",
      related: "माल ढुलाई सेवाएँ देखें",
    },
  },
  zh: {
    "importing-to-nepal": {
      title: "货物进口尼泊尔指南",
      description: "尼泊尔货运进口实用指南：选择印度中转口岸、准备运输单据、安排过境与海关衔接及最终交付。",
      intro: "海运货物抵达印度港口，并不意味着尼泊尔进口运输已经完成。中转口岸、过境运输、边境清关和最终交付应作为同一票货物统筹。",
      routeTitle: "运输如何规划",
      stages: [
        { title: "01 / 确认货物与交付地点", copy: "提供起运地、尼泊尔境内目的地、货物描述、尺寸、重量和交货条款。这些信息决定海运、空运或陆运方式，以及是否需要特殊设备。" },
        { title: "02 / 衔接口岸与内陆段", copy: "海运进口须将印度中转口岸与后续铁路衔接或公路运输配合。加尔各答、哈尔迪亚和维沙卡帕特南均可能作为口岸；实际可行路线须逐票确认。" },
        { title: "03 / 对齐放货、清关与交付", copy: "运输单据、交货单、过境记录及尼泊尔海关文件必须一致。最终交付需根据放行、卸货能力及收货时间安排。" },
      ],
      documentsTitle: "订舱前应准备什么",
      documentsIntro: "具体要求随商品、起运地和进口制度而变化。以下是运输规划清单，并非海关裁定。",
      documents: ["品名与数量一致的商业发票和装箱单", "买方及收货人信息、交付地址与约定的 Incoterm", "货物尺寸、毛重以及危险品或许可信息", "提单或空运单草稿信息及拟选印度中转口岸", "该商品适用的许可证、证书或批准文件"],
      questionsTitle: "常见规划问题",
      questions: [
        { question: "KCPL 能安排印度港口之后的内陆运输吗？", answer: "可以。KCPL 通过相关服务伙伴协调口岸交接、公路或铁路衔接过境、尼泊尔入境及交付。具体路线与责任范围在报价中确认。" },
        { question: "这里能确认税费或保证到达日期吗？", answer: "不能。税费与许可取决于货物及现行官方要求。承运人班期、边境处理和放行日期均须逐票核查。" },
      ],
      cta: "与 KCPL 规划进口运输",
      related: "了解清关与单证服务",
    },
    "exporting-from-nepal": {
      title: "从尼泊尔出口货物指南",
      description: "尼泊尔空运与海运出口实用指南：提货、贸易单据、加德满都与印度口岸路线，以及目的地代理协调。",
      intro: "在订舱之前明确货物、提货日期、买方交货条款及目的地交接方式，出口运输会更顺畅。",
      routeTitle: "运输如何规划",
      stages: [
        { title: "01 / 确定货物要求", copy: "先确认商品、件数、尺寸、重量、目的地、交付时间和买方 Incoterm。加德满都空运与经印度口岸的海运在成本和时间上各有不同。" },
        { title: "02 / 准备出口交接", copy: "交货给承运人之前，确认包装、提货、出口文件及适用的商品许可。发票、装箱单与运输指示应描述同一票货物。" },
        { title: "03 / 协调目的地", copy: "KCPL 与海外代理合作安排境外运输、预配通知和交付计划。应按约定条款明确由谁负责清关、收货及各段费用。" },
      ],
      documentsTitle: "订舱前应准备什么",
      documentsIntro: "最终文件取决于商品和目的地。此清单帮助提前发现缺漏，不能代替官方出口建议。",
      documents: ["商业发票、装箱单及买方/收货人信息", "件数、尺寸、毛重及提货地址", "目的地、交付期限及约定的 Incoterm", "适用的原产地证、许可证或商品专项批准", "易碎、危险、易腐或超限货物的特殊操作信息"],
      questionsTitle: "常见规划问题",
      questions: [
        { question: "KCPL 能协调空运和海运出口吗？", answer: "可以。在审查货物、确认舱位与服务条件后，KCPL 可规划加德满都空运及经印度口岸的海运出口。" },
        { question: "KCPL 在海外设有自有办公室吗？", answer: "没有。境外操作和交付由合作代理协调。报价应明确该票货物各段的服务范围和交接责任。" },
      ],
      cta: "与 KCPL 规划出口运输",
      related: "了解货运服务",
    },
  },
};
