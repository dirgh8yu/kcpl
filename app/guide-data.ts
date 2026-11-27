import { practicalGuides, practicalGuideSlugs } from "./guide-data-practical.ts";
import type { SiteLocale } from "./site-i18n";
import type { ToolSlug } from "./tool-data";

const routeGuideSlugs = ["importing-to-nepal", "exporting-from-nepal", "cargo-from-china-to-nepal", "cargo-from-india-to-nepal"] as const;
type RouteGuideSlug = (typeof routeGuideSlugs)[number];

/* The route guides come first: they are the overview the practical
 * guides hang off. */
export const guideSlugs = [...routeGuideSlugs, ...practicalGuideSlugs] as const;
export type GuideSlug = (typeof guideSlugs)[number];

export type Guide = {
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

const routeGuides: Record<SiteLocale, Record<RouteGuideSlug, Guide>> = {
  en: {
    "importing-to-nepal": {
      title: "Importing freight to Nepal",
      description: "Plan an import to Nepal: choose an Indian gateway, prepare freight documents, align transit and customs handovers, and arrange final delivery.",
      intro: "An ocean import into Nepal does not end when the vessel reaches India. The gateway, transit movement, border clearance and final delivery have to be planned as one shipment.",
      routeTitle: "What happens between the port and your door",
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
      title: "Exporting freight from Nepal",
      description: "Plan an export from Nepal by air or ocean: prepare cargo and trade documents, choose Kathmandu or Indian-gateway routes, and coordinate destination agents.",
      intro: "A Nepal export works best when the cargo, collection date, buyer's delivery terms and destination handover are agreed before a carrier is booked.",
      routeTitle: "How an export from Nepal is put together",
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
    "cargo-from-china-to-nepal": {
      title: "Cargo from China to Nepal",
      description: "Plan cargo from China to Nepal: road via the Kerung–Rasuwagadhi or Tatopani crossings, sea through an Indian port or air to Kathmandu, and the documents.",
      intro: "Cargo from China reaches Nepal by road over the Himalayan crossings, by sea through an Indian port, or by air into Kathmandu. Which one works depends on the goods, the delivery point and whether the crossings are open.",
      routeTitle: "Which route from China to Nepal fits the cargo",
      stages: [
        { title: "01 / Choose road, sea or air", copy: "Road over the northern border suits cargo from inland and western China. Sea through Kolkata or another Indian gateway suits full containers from China's coastal ports. Air into Kathmandu suits urgent or high-value cargo. Share the supplier's city, the cargo and the delivery point in Nepal and the route is chosen from those." },
        { title: "02 / Check the crossing before booking", copy: "Kerung–Rasuwagadhi and Tatopani are the main road crossings for trade with China. Both have closed for long periods after floods and landslides, so the crossing's current status is checked for each shipment before the supplier dispatches." },
        { title: "03 / Clear and deliver in Nepal", copy: "Road cargo is cleared at the border customs office, sea cargo usually at Birgunj or another southern point after Indian transit, and air cargo at Tribhuvan International Airport. Delivery is then arranged to the consignee's site." },
      ],
      documentsTitle: "What to prepare before booking",
      documentsIntro: "Requirements vary by commodity and route. This is a planning checklist, not a customs determination; KCPL can review the shipment record before booking.",
      documents: ["Commercial invoice and packing list from the Chinese supplier, with matching quantities and descriptions", "Importer details in Nepal, including PAN or VAT registration, and the agreed Incoterm", "Supplier's city and pickup address, cargo dimensions and gross weight", "Transport document for the chosen route: road consignment note, bill of lading or air waybill", "Certificate of origin, licences or permits where the goods require them"],
      questionsTitle: "Common planning questions",
      questions: [
        { question: "Which border crossings does KCPL use for China cargo?", answer: "KCPL moves cargo through the Kerung–Rasuwagadhi crossing and also routes China cargo through Tatopani. The crossing for a shipment is chosen after checking which one is open and suits the cargo." },
        { question: "What happens if a crossing is closed?", answer: "The shipment can wait for the crossing to reopen, or move by sea through an Indian port or by air to Kathmandu instead. Which is better depends on the deadline, the cargo and the cost, so it is decided for each shipment." },
        { question: "Does KCPL handle the China side of the movement?", answer: "KCPL plans road freight between inland China and Nepal. The scope of each leg, from pickup in China to delivery in Nepal, is confirmed in the quotation." },
      ],
      cta: "Plan a China shipment with KCPL",
      related: "Explore road freight",
    },
    "cargo-from-india-to-nepal": {
      title: "Cargo from India to Nepal",
      description: "Plan cargo from India to Nepal: pick the border point, separate Indian goods from transit cargo, prepare the documents and arrange clearance and delivery.",
      intro: "Most of Nepal's trade crosses the open border with India, by road through more than twenty customs points and by rail into Birgunj. The border point and the documents depend on where the goods come from and where they are going in Nepal.",
      routeTitle: "Which border point fits this shipment",
      stages: [
        { title: "01 / Pick the border point", copy: "Raxaul–Birgunj carries the most cargo and has the Sirsiya rail-linked dry port. Bhairahawa, Nepalgunj and Biratnagar are among the other main crossings. The right one is usually the one closest to the delivery point in Nepal." },
        { title: "02 / Indian goods or transit cargo", copy: "Goods bought in India move under the bilateral Treaty of Trade. Cargo from a third country that lands at an Indian port moves under the Treaty of Transit, in bond, with its own transit documents. The two need different paperwork, so tell KCPL which one the shipment is." },
        { title: "03 / Clear and deliver", copy: "Nepal customs clears the cargo at the border point, then it is delivered to the consignee's site. KCPL staff work on both sides of the Raxaul–Birgunj crossing." },
      ],
      documentsTitle: "What to prepare before booking",
      documentsIntro: "Requirements vary by commodity and route. This is a planning checklist, not a customs determination; KCPL can review the shipment record before booking.",
      documents: ["Tax invoice and packing list from the Indian supplier, with matching quantities and descriptions", "Importer details in Nepal, including PAN or VAT registration", "Indian export documents, such as the shipping bill and e-way bill", "Lorry consignment note or railway receipt for the move to the border", "Certificate of origin where a preferential duty rate is claimed, and any licences or permits the goods need"],
      questionsTitle: "Common planning questions",
      questions: [
        { question: "Which border point should my cargo use?", answer: "Usually the one nearest the delivery point in Nepal, as long as that customs office handles the goods. KCPL staff are in Raxaul, Birgunj and Nepalgunj, and KCPL plans the crossing for each shipment." },
        { question: "Can cargo from India move by rail?", answer: "Yes. Container trains run to the Sirsiya dry port at Birgunj, and a rail cargo service between Kolkata and Biratnagar began in 2026. Whether rail suits a shipment depends on the cargo, the origin and the delivery point." },
        { question: "Is there import duty on goods from India?", answer: "Yes, Nepal customs assesses duty at the tariff rate for the goods' HS code, including any preference available under the trade treaty. Use the duty estimate tool for a planning figure; the assessment is customs' decision." },
      ],
      cta: "Plan an India shipment with KCPL",
      related: "Explore road freight",
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
    "cargo-from-china-to-nepal": {
      title: "चीनबाट नेपालमा कार्गो",
      description: "चीनबाट नेपालमा कार्गोको योजना: केरुङ–रसुवागढी वा तातोपानी नाका हुँदै सडक, भारतीय बन्दरगाह हुँदै समुद्री, वा काठमाडौँमा हवाई ढुवानी, र तयार गर्नुपर्ने कागजात।",
      intro: "चीनबाट कार्गो हिमाली नाका हुँदै सडकबाट, भारतीय बन्दरगाह हुँदै समुद्रबाट, वा काठमाडौँसम्म हवाईमार्गबाट नेपाल आइपुग्छ। कुन मार्ग उपयुक्त हुन्छ भन्ने सामान, डेलिभरी स्थान र नाका खुला छ कि छैन भन्नेमा भर पर्छ।",
      routeTitle: "मुभमेन्ट कसरी योजना हुन्छ",
      stages: [
        { title: "०१ / सडक, समुद्री वा हवाई छान्नुहोस्", copy: "भित्री र पश्चिमी चीनबाटको कार्गोलाई उत्तरी सीमाको सडकमार्ग उपयुक्त हुन्छ। चीनका तटीय बन्दरगाहबाट पूरा कन्टेनरका लागि कोलकाता वा अर्को भारतीय गेटवे हुँदै समुद्री मार्ग उपयुक्त हुन्छ। जरुरी वा उच्च मूल्यको कार्गोलाई काठमाडौँसम्म हवाई उपयुक्त हुन्छ। आपूर्तिकर्ताको सहर, कार्गो र नेपालको डेलिभरी स्थान दिनुहोस्, त्यसैका आधारमा मार्ग छानिन्छ।" },
        { title: "०२ / बुकिङअघि नाका जाँच गर्नुहोस्", copy: "केरुङ–रसुवागढी र तातोपानी चीनसँगको व्यापारका मुख्य सडक नाका हुन्। बाढी र पहिरोपछि दुवै लामो समय बन्द भएका छन्, त्यसैले आपूर्तिकर्ताले सामान पठाउनुअघि हरेक शिपमेन्टका लागि नाकाको अहिलेको अवस्था जाँचिन्छ।" },
        { title: "०३ / नेपालमा जाँचपास र डेलिभरी", copy: "सडक कार्गो सीमाको भन्सार कार्यालयमा, समुद्री कार्गो भारतीय ट्रान्जिटपछि प्रायः वीरगन्ज वा अर्को दक्षिणी नाकामा, र हवाई कार्गो त्रिभुवन अन्तर्राष्ट्रिय विमानस्थलमा जाँचपास हुन्छ। त्यसपछि प्रापकको स्थानसम्म डेलिभरी मिलाइन्छ।" },
      ],
      documentsTitle: "बुकिङअघि तयार गर्नुपर्ने कुरा",
      documentsIntro: "आवश्यकता सामान र मार्गअनुसार फरक पर्छ। यो योजना सूची हो, भन्सार निर्णय होइन; बुकिङअघि KCPL ले शिपमेन्टको विवरण हेर्न सक्छ।",
      documents: ["चिनियाँ आपूर्तिकर्ताको कमर्सियल इनभ्वाइस र प्याकिङ लिस्ट, मिल्दो परिमाण र विवरणसहित", "नेपालका आयातकर्ताको विवरण, PAN वा VAT दर्तासहित, र सहमत Incoterm", "आपूर्तिकर्ताको सहर र पिकअप ठेगाना, कार्गोको आकार र कुल तौल", "छानिएको मार्गको ढुवानी कागजात: सडक कन्साइनमेन्ट नोट, बिल अफ लेडिङ वा एयर वेबिल", "सामानलाई आवश्यक परेमा उत्पत्तिको प्रमाणपत्र, इजाजतपत्र वा अनुमति"],
      questionsTitle: "योजनासम्बन्धी सामान्य प्रश्न",
      questions: [
        { question: "KCPL ले चीनको कार्गोका लागि कुन नाका प्रयोग गर्छ?", answer: "KCPL ले केरुङ–रसुवागढी नाका हुँदै कार्गो ल्याउँछ र तातोपानी हुँदै पनि चीनको कार्गो पठाउँछ। कुन नाका खुला छ र कार्गोलाई उपयुक्त छ भनी जाँचेर शिपमेन्टको नाका छानिन्छ।" },
        { question: "नाका बन्द भए के हुन्छ?", answer: "शिपमेन्ट नाका खुल्ने प्रतीक्षा गर्न सक्छ, वा त्यसको सट्टा भारतीय बन्दरगाह हुँदै समुद्रबाट वा काठमाडौँसम्म हवाईबाट आउन सक्छ। कुन राम्रो भन्ने समयसीमा, कार्गो र लागतमा भर पर्छ, त्यसैले हरेक शिपमेन्टमा निर्णय गरिन्छ।" },
        { question: "के KCPL ले चीनतर्फको मुभमेन्ट पनि सम्हाल्छ?", answer: "KCPL ले भित्री चीन र नेपालबीच सडक ढुवानीको योजना गर्छ। चीनमा पिकअपदेखि नेपालमा डेलिभरीसम्म हरेक खण्डको दायरा कोटेसनमा पुष्टि गरिन्छ।" },
      ],
      cta: "KCPL सँग चीनको शिपमेन्ट योजना गर्नुहोस्",
      related: "सडक ढुवानी हेर्नुहोस्",
    },
    "cargo-from-india-to-nepal": {
      title: "भारतबाट नेपालमा कार्गो",
      description: "भारतबाट नेपालमा कार्गोको योजना: सीमा नाका छान्नुहोस्, भारतीय सामान र ट्रान्जिट कार्गो छुट्याउनुहोस्, कागजात तयार गर्नुहोस् र जाँचपास मिलाउनुहोस्।",
      intro: "नेपालको धेरैजसो व्यापार भारतसँगको खुला सीमा हुँदै हुन्छ, बीसभन्दा बढी भन्सार नाकाबाट सडकमार्ग र वीरगन्जसम्म रेलमार्गबाट। सीमा नाका र कागजात सामान कहाँबाट आउँछ र नेपालमा कहाँ जान्छ भन्नेमा भर पर्छ।",
      routeTitle: "मुभमेन्ट कसरी योजना हुन्छ",
      stages: [
        { title: "०१ / सीमा नाका छान्नुहोस्", copy: "रक्सौल–वीरगन्जले सबैभन्दा धेरै कार्गो बोक्छ र यहाँ सिर्सिया रेल-जडित सुक्खा बन्दरगाह छ। भैरहवा, नेपालगन्ज र विराटनगर अन्य मुख्य नाकामध्ये पर्छन्। प्रायः नेपालको डेलिभरी स्थाननजिकको नाका नै उपयुक्त हुन्छ।" },
        { title: "०२ / भारतीय सामान वा ट्रान्जिट कार्गो", copy: "भारतमा किनिएको सामान द्विपक्षीय व्यापार सन्धिअन्तर्गत आउँछ। भारतीय बन्दरगाहमा आइपुग्ने तेस्रो मुलुकको कार्गो पारवहन सन्धिअन्तर्गत, बन्डमा, आफ्नै ट्रान्जिट कागजातसहित आउँछ। दुवैलाई फरक कागजात चाहिन्छ, त्यसैले शिपमेन्ट कुन हो KCPL लाई बताउनुहोस्।" },
        { title: "०३ / जाँचपास र डेलिभरी", copy: "नेपाल भन्सारले सीमा नाकामा कार्गो जाँचपास गर्छ, त्यसपछि प्रापकको स्थानसम्म डेलिभरी हुन्छ। KCPL का कर्मचारी रक्सौल–वीरगन्ज नाकाको दुवैतर्फ काम गर्छन्।" },
      ],
      documentsTitle: "बुकिङअघि तयार गर्नुपर्ने कुरा",
      documentsIntro: "आवश्यकता सामान र मार्गअनुसार फरक पर्छ। यो योजना सूची हो, भन्सार निर्णय होइन; बुकिङअघि KCPL ले शिपमेन्टको विवरण हेर्न सक्छ।",
      documents: ["भारतीय आपूर्तिकर्ताको ट्याक्स इनभ्वाइस र प्याकिङ लिस्ट, मिल्दो परिमाण र विवरणसहित", "नेपालका आयातकर्ताको विवरण, PAN वा VAT दर्तासहित", "भारतीय निर्यात कागजात, जस्तै शिपिङ बिल र ई-वे बिल", "सीमासम्मको ढुवानीका लागि लरी कन्साइनमेन्ट नोट वा रेलवे रसिद", "सहुलियत भन्सार दर दाबी गर्दा उत्पत्तिको प्रमाणपत्र, र सामानलाई चाहिने इजाजतपत्र वा अनुमति"],
      questionsTitle: "योजनासम्बन्धी सामान्य प्रश्न",
      questions: [
        { question: "मेरो कार्गो कुन सीमा नाकाबाट आउनुपर्छ?", answer: "प्रायः नेपालको डेलिभरी स्थाननजिकको नाका, यदि त्यो भन्सार कार्यालयले सो सामान जाँचपास गर्छ भने। KCPL का कर्मचारी रक्सौल, वीरगन्ज र नेपालगन्जमा छन्, र KCPL ले हरेक शिपमेन्टको नाका योजना गर्छ।" },
        { question: "के भारतबाट रेलमार्गबाट कार्गो आउन सक्छ?", answer: "सक्छ। कन्टेनर रेल वीरगन्जको सिर्सिया सुक्खा बन्दरगाहसम्म चल्छ, र सन् २०२६ मा कोलकाता–विराटनगर रेल कार्गो सेवा सुरु भयो। रेल उपयुक्त हुन्छ कि हुँदैन भन्ने कार्गो, मूलस्थान र डेलिभरी स्थानमा भर पर्छ।" },
        { question: "के भारतबाट आउने सामानमा भन्सार महसुल लाग्छ?", answer: "लाग्छ। नेपाल भन्सारले सामानको HS कोडको दरमा, व्यापार सन्धिअन्तर्गत पाइने सहुलियतसमेत लगाएर महसुल निर्धारण गर्छ। योजनाका लागि भन्सार अनुमान उपकरण प्रयोग गर्नुहोस्; निर्धारण भन्सारको निर्णय हो।" },
      ],
      cta: "KCPL सँग भारतको शिपमेन्ट योजना गर्नुहोस्",
      related: "सडक ढुवानी हेर्नुहोस्",
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
    "cargo-from-china-to-nepal": {
      title: "चीन से नेपाल कार्गो",
      description: "चीन से नेपाल कार्गो की योजना: केरुंग–रसुवागढ़ी या तातोपानी बॉर्डर से सड़क, भारतीय बंदरगाह से समुद्री, या काठमांडू तक हवाई माल, और तैयार रखने वाले दस्तावेज़।",
      intro: "चीन से कार्गो हिमालयी बॉर्डर से सड़क के रास्ते, भारतीय बंदरगाह से समुद्र के रास्ते, या काठमांडू तक हवाई रास्ते से नेपाल पहुँचता है। कौन-सा रास्ता सही है, यह माल, डिलीवरी की जगह और बॉर्डर खुला है या नहीं, इस पर निर्भर करता है।",
      routeTitle: "मूवमेंट की योजना कैसे बनती है",
      stages: [
        { title: "01 / सड़क, समुद्र या हवाई चुनें", copy: "भीतरी और पश्चिमी चीन के कार्गो के लिए उत्तरी बॉर्डर का सड़क मार्ग सही रहता है। चीन के तटीय बंदरगाहों से पूरे कंटेनर के लिए कोलकाता या किसी अन्य भारतीय गेटवे से समुद्री मार्ग सही रहता है। ज़रूरी या महँगे कार्गो के लिए काठमांडू तक हवाई मार्ग सही रहता है। सप्लायर का शहर, कार्गो और नेपाल में डिलीवरी की जगह बताइए, उसी से रास्ता चुना जाता है।" },
        { title: "02 / बुकिंग से पहले बॉर्डर जाँचें", copy: "केरुंग–रसुवागढ़ी और तातोपानी चीन के साथ व्यापार के मुख्य सड़क बॉर्डर हैं। बाढ़ और भूस्खलन के बाद दोनों लंबे समय तक बंद रहे हैं, इसलिए सप्लायर के माल भेजने से पहले हर शिपमेंट के लिए बॉर्डर की मौजूदा स्थिति जाँची जाती है।" },
        { title: "03 / नेपाल में क्लियरेंस और डिलीवरी", copy: "सड़क कार्गो बॉर्डर के कस्टम्स कार्यालय में, समुद्री कार्गो भारतीय ट्रांज़िट के बाद आमतौर पर बीरगंज या किसी अन्य दक्षिणी बॉर्डर पर, और हवाई कार्गो त्रिभुवन अंतरराष्ट्रीय हवाई अड्डे पर क्लियर होता है। फिर कंसाइनी की साइट तक डिलीवरी की व्यवस्था की जाती है।" },
      ],
      documentsTitle: "बुकिंग से पहले क्या तैयार रखें",
      documentsIntro: "ज़रूरतें माल और रास्ते के अनुसार बदलती हैं। यह योजना सूची है, कस्टम्स का निर्णय नहीं; बुकिंग से पहले KCPL शिपमेंट का विवरण देख सकता है।",
      documents: ["चीनी सप्लायर का कमर्शियल इनवॉइस और पैकिंग लिस्ट, मेल खाती मात्रा और विवरण के साथ", "नेपाल के आयातक का विवरण, PAN या VAT पंजीकरण सहित, और तय Incoterm", "सप्लायर का शहर और पिकअप पता, कार्गो का आकार और कुल वज़न", "चुने गए रास्ते का परिवहन दस्तावेज़: सड़क कंसाइनमेंट नोट, बिल ऑफ़ लैडिंग या एयर वेबिल", "माल के लिए ज़रूरी हो तो मूल प्रमाणपत्र, लाइसेंस या परमिट"],
      questionsTitle: "योजना से जुड़े आम सवाल",
      questions: [
        { question: "KCPL चीन के कार्गो के लिए कौन-से बॉर्डर इस्तेमाल करता है?", answer: "KCPL केरुंग–रसुवागढ़ी बॉर्डर से कार्गो लाता है और तातोपानी से भी चीन का कार्गो भेजता है। कौन-सा बॉर्डर खुला है और कार्गो के लिए सही है, यह जाँचकर शिपमेंट का बॉर्डर चुना जाता है।" },
        { question: "बॉर्डर बंद हो तो क्या होता है?", answer: "शिपमेंट बॉर्डर खुलने का इंतज़ार कर सकता है, या उसकी जगह भारतीय बंदरगाह से समुद्र के रास्ते या काठमांडू तक हवाई रास्ते से आ सकता है। कौन-सा बेहतर है, यह समय-सीमा, कार्गो और लागत पर निर्भर करता है, इसलिए हर शिपमेंट के लिए तय किया जाता है।" },
        { question: "क्या KCPL चीन की तरफ़ का मूवमेंट भी संभालता है?", answer: "KCPL भीतरी चीन और नेपाल के बीच सड़क माल ढुलाई की योजना बनाता है। चीन में पिकअप से नेपाल में डिलीवरी तक, हर हिस्से का दायरा कोटेशन में तय होता है।" },
      ],
      cta: "KCPL के साथ चीन के शिपमेंट की योजना बनाएँ",
      related: "सड़क माल ढुलाई देखें",
    },
    "cargo-from-india-to-nepal": {
      title: "भारत से नेपाल कार्गो",
      description: "भारत से नेपाल कार्गो की योजना: बॉर्डर पॉइंट चुनें, भारतीय माल और ट्रांज़िट कार्गो में फ़र्क़ समझें, दस्तावेज़ तैयार करें और क्लियरेंस की व्यवस्था करें।",
      intro: "नेपाल का ज़्यादातर व्यापार भारत के साथ खुले बॉर्डर से होता है, बीस से ज़्यादा कस्टम्स पॉइंट से सड़क के रास्ते और बीरगंज तक रेल से। बॉर्डर पॉइंट और दस्तावेज़ इस पर निर्भर करते हैं कि माल कहाँ से आ रहा है और नेपाल में कहाँ जा रहा है।",
      routeTitle: "मूवमेंट की योजना कैसे बनती है",
      stages: [
        { title: "01 / बॉर्डर पॉइंट चुनें", copy: "रक्सौल–बीरगंज से सबसे ज़्यादा कार्गो गुज़रता है और यहाँ सिरसिया रेल-जुड़ा ड्राई पोर्ट है। भैरहवा, नेपालगंज और बिराटनगर अन्य मुख्य बॉर्डर में से हैं। आमतौर पर नेपाल में डिलीवरी की जगह के सबसे नज़दीक वाला पॉइंट सही रहता है।" },
        { title: "02 / भारतीय माल या ट्रांज़िट कार्गो", copy: "भारत में खरीदा गया माल द्विपक्षीय व्यापार संधि के तहत जाता है। भारतीय बंदरगाह पर उतरने वाला तीसरे देश का कार्गो पारगमन संधि के तहत, बॉन्ड में, अपने ट्रांज़िट दस्तावेज़ों के साथ जाता है। दोनों के कागज़ात अलग होते हैं, इसलिए KCPL को बताइए कि शिपमेंट कौन-सा है।" },
        { title: "03 / क्लियरेंस और डिलीवरी", copy: "नेपाल कस्टम्स बॉर्डर पॉइंट पर कार्गो क्लियर करता है, फिर कंसाइनी की साइट तक डिलीवरी होती है। KCPL का स्टाफ़ रक्सौल–बीरगंज बॉर्डर के दोनों तरफ़ काम करता है।" },
      ],
      documentsTitle: "बुकिंग से पहले क्या तैयार रखें",
      documentsIntro: "ज़रूरतें माल और रास्ते के अनुसार बदलती हैं। यह योजना सूची है, कस्टम्स का निर्णय नहीं; बुकिंग से पहले KCPL शिपमेंट का विवरण देख सकता है।",
      documents: ["भारतीय सप्लायर का टैक्स इनवॉइस और पैकिंग लिस्ट, मेल खाती मात्रा और विवरण के साथ", "नेपाल के आयातक का विवरण, PAN या VAT पंजीकरण सहित", "भारतीय निर्यात दस्तावेज़, जैसे शिपिंग बिल और ई-वे बिल", "बॉर्डर तक के मूवमेंट के लिए लॉरी कंसाइनमेंट नोट या रेलवे रसीद", "रियायती ड्यूटी दर का दावा करने पर मूल प्रमाणपत्र, और माल के लिए ज़रूरी लाइसेंस या परमिट"],
      questionsTitle: "योजना से जुड़े आम सवाल",
      questions: [
        { question: "मेरा कार्गो किस बॉर्डर पॉइंट से जाना चाहिए?", answer: "आमतौर पर नेपाल में डिलीवरी की जगह के सबसे नज़दीक वाला, अगर वह कस्टम्स कार्यालय उस माल को क्लियर करता है। KCPL का स्टाफ़ रक्सौल, बीरगंज और नेपालगंज में है, और KCPL हर शिपमेंट के बॉर्डर की योजना बनाता है।" },
        { question: "क्या भारत से कार्गो रेल से जा सकता है?", answer: "हाँ। कंटेनर ट्रेनें बीरगंज के सिरसिया ड्राई पोर्ट तक चलती हैं, और 2026 में कोलकाता–बिराटनगर रेल कार्गो सेवा शुरू हुई। रेल किसी शिपमेंट के लिए सही है या नहीं, यह कार्गो, मूल स्थान और डिलीवरी की जगह पर निर्भर करता है।" },
        { question: "क्या भारत से आने वाले माल पर आयात ड्यूटी लगती है?", answer: "हाँ, नेपाल कस्टम्स माल के HS कोड की दर पर, व्यापार संधि के तहत मिलने वाली रियायत सहित, ड्यूटी तय करता है। योजना के लिए ड्यूटी अनुमान टूल इस्तेमाल करें; ड्यूटी तय करना कस्टम्स का निर्णय है।" },
      ],
      cta: "KCPL के साथ भारत के शिपमेंट की योजना बनाएँ",
      related: "सड़क माल ढुलाई देखें",
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
    "cargo-from-china-to-nepal": {
      title: "中国至尼泊尔货运",
      description: "规划中国至尼泊尔货运：经吉隆–拉苏瓦加迪或樟木–塔托帕尼口岸陆运、经印度港口海运或空运至加德满都，以及需准备的单证。",
      intro: "中国货物可经喜马拉雅口岸陆运、经印度港口海运或空运至加德满都进入尼泊尔。哪种方式可行，取决于货物、交付地点以及口岸是否开放。",
      routeTitle: "运输如何规划",
      stages: [
        { title: "01 / 选择陆运、海运或空运", copy: "中国内陆和西部的货物适合经北部边境陆运。中国沿海港口的整箱货物适合经加尔各答或其他印度港口海运。紧急或高价值货物适合空运至加德满都。请提供供应商所在城市、货物信息和尼泊尔交付地点，据此选择路线。" },
        { title: "02 / 订舱前确认口岸状况", copy: "吉隆–拉苏瓦加迪和樟木–塔托帕尼是中尼贸易的主要陆路口岸。两个口岸都曾因洪水和山体滑坡长期关闭，因此在供应商发货前，会逐票确认口岸的当前状况。" },
        { title: "03 / 在尼泊尔清关和交付", copy: "陆运货物在边境海关清关，海运货物经印度过境后通常在比尔甘杰或其他南部口岸清关，空运货物在特里布万国际机场清关。之后安排送至收货人地点。" },
      ],
      documentsTitle: "订舱前需准备的资料",
      documentsIntro: "具体要求因货物和路线而异。本清单仅供规划，不构成海关认定；KCPL 可在订舱前审核货物资料。",
      documents: ["中国供应商的商业发票和装箱单，数量与描述一致", "尼泊尔进口商信息，包括 PAN 或 VAT 登记号，以及约定的贸易术语", "供应商所在城市和提货地址、货物尺寸和毛重", "所选路线的运输单证：公路托运单、提单或空运单", "货物需要时的原产地证书、许可证或批文"],
      questionsTitle: "常见规划问题",
      questions: [
        { question: "KCPL 的中国货物经哪些口岸？", answer: "KCPL 经吉隆–拉苏瓦加迪口岸运输货物，也经樟木–塔托帕尼口岸安排中国货物。每票货物在确认哪个口岸开放且适合该货物后选定口岸。" },
        { question: "口岸关闭怎么办？", answer: "货物可以等待口岸重新开放，也可以改经印度港口海运或空运至加德满都。哪种更合适取决于时限、货物和成本，因此逐票决定。" },
        { question: "KCPL 负责中国段的运输吗？", answer: "KCPL 规划中国内陆与尼泊尔之间的公路货运。从中国提货到尼泊尔交付，各段的服务范围在报价中确认。" },
      ],
      cta: "与 KCPL 规划中国货运",
      related: "了解公路货运",
    },
    "cargo-from-india-to-nepal": {
      title: "印度至尼泊尔货运",
      description: "规划印度至尼泊尔货运：选择边境口岸，区分印度货物与第三国过境货物，准备单证，并安排清关和交付。",
      intro: "尼泊尔的大部分贸易经与印度的开放边境进行，经二十多个海关口岸公路运输，并经铁路进入比尔甘杰。边境口岸和单证取决于货物的来源地及其在尼泊尔的目的地。",
      routeTitle: "运输如何规划",
      stages: [
        { title: "01 / 选择边境口岸", copy: "拉克索尔–比尔甘杰的货运量最大，设有西尔西亚铁路联运陆港。拜拉哈瓦、尼泊尔根杰和比拉德讷格尔也是主要口岸。通常选择离尼泊尔交付地点最近的口岸。" },
        { title: "02 / 印度货物还是过境货物", copy: "在印度采购的货物按双边贸易条约运输。在印度港口卸下的第三国货物按过境条约以保税方式运输，并有专门的过境单证。两者所需单证不同，请告知 KCPL 货物属于哪一种。" },
        { title: "03 / 清关和交付", copy: "尼泊尔海关在边境口岸清关，之后送至收货人地点。KCPL 员工在拉克索尔–比尔甘杰口岸两侧工作。" },
      ],
      documentsTitle: "订舱前需准备的资料",
      documentsIntro: "具体要求因货物和路线而异。本清单仅供规划，不构成海关认定；KCPL 可在订舱前审核货物资料。",
      documents: ["印度供应商的税务发票和装箱单，数量与描述一致", "尼泊尔进口商信息，包括 PAN 或 VAT 登记号", "印度出口单证，如出口报关单和电子运单（e-way bill）", "运至边境的卡车托运单或铁路收据", "申请优惠税率时的原产地证书，以及货物所需的许可证或批文"],
      questionsTitle: "常见规划问题",
      questions: [
        { question: "我的货物应走哪个边境口岸？", answer: "通常是离尼泊尔交付地点最近、且该海关办理此类货物的口岸。KCPL 员工驻拉克索尔、比尔甘杰和尼泊尔根杰，并为每票货物规划口岸。" },
        { question: "印度货物可以走铁路吗？", answer: "可以。集装箱列车开往比尔甘杰的西尔西亚陆港，加尔各答至比拉德讷格尔的铁路货运服务于 2026 年开通。铁路是否适合取决于货物、起运地和交付地点。" },
        { question: "印度货物需缴纳进口关税吗？", answer: "需要。尼泊尔海关按货物 HS 编码的税率征税，并适用贸易条约下的优惠。规划时可使用关税估算工具；最终税额由海关核定。" },
      ],
      cta: "与 KCPL 规划印度货运",
      related: "了解公路货运",
    },
  },
};

export const guides: Record<SiteLocale, Record<GuideSlug, Guide>> = {
  en: { ...routeGuides.en, ...practicalGuides.en },
  ne: { ...routeGuides.ne, ...practicalGuides.ne },
  hi: { ...routeGuides.hi, ...practicalGuides.hi },
  zh: { ...routeGuides.zh, ...practicalGuides.zh },
};

/**
 * Where each guide leads: the service it belongs to, the calculator that runs
 * its sums, and the guides to read next. Kept apart from the copy so the four
 * languages cannot point different ways.
 */
export const guideLinks: Record<GuideSlug, { service: string; tool: ToolSlug; next: GuideSlug[] }> = {
  "importing-to-nepal": { service: "/services/customs-clearance", tool: "duty-estimate", next: ["customs-clearance-in-nepal", "sea-freight-through-india"] },
  "exporting-from-nepal": { service: "/services", tool: "volume-weight", next: ["importing-to-nepal", "air-freight-to-kathmandu"] },
  "customs-clearance-in-nepal": { service: "/services/customs-clearance", tool: "duty-estimate", next: ["hs-codes-and-import-duty", "free-time-and-demurrage"] },
  "sea-freight-through-india": { service: "/services/ocean-freight", tool: "storage-charges", next: ["free-time-and-demurrage", "customs-clearance-in-nepal"] },
  "air-freight-to-kathmandu": { service: "/services/air-freight", tool: "volume-weight", next: ["customs-clearance-in-nepal", "importing-to-nepal"] },
  "hs-codes-and-import-duty": { service: "/services/customs-clearance", tool: "duty-estimate", next: ["customs-clearance-in-nepal", "importing-to-nepal"] },
  "free-time-and-demurrage": { service: "/services/ocean-freight", tool: "storage-charges", next: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
  "cargo-from-china-to-nepal": { service: "/services/road-freight", tool: "volume-weight", next: ["customs-clearance-in-nepal", "sea-freight-through-india"] },
  "cargo-from-india-to-nepal": { service: "/services/road-freight", tool: "duty-estimate", next: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
};

/** The guides' own index page, and the words around every guide. */
export const guideIndex: Record<SiteLocale, { title: string; description: string; intro: string; related: string; open: string }> = {
  en: {
    title: "Freight guides",
    description: "Plan freight into and out of Nepal with practical guides to customs, Indian port gateways, air cargo, HS codes, import duty, free time and demurrage.",
    intro: "Plain answers to common questions about moving freight into and out of Nepal, written as planning checklists. Requirements depend on the goods and change over time, so confirm the details for each shipment.",
    related: "Related guides",
    open: "Read the guide",
  },
  ne: {
    title: "ढुवानी मार्गदर्शिका",
    description: "नेपालभित्र र बाहिर ढुवानीका व्यावहारिक मार्गदर्शिका: भन्सार जाँचपास, भारतीय बन्दरगाह हुँदै समुद्री ढुवानी, काठमाडौँमा हवाई ढुवानी, HS कोड र महसुल।",
    intro: "नेपालमा र नेपालबाट मालसामान ढुवानीसम्बन्धी सामान्य प्रश्नका सरल उत्तर, योजना सूचीका रूपमा। आवश्यकताहरू सामान र समयअनुसार फरक पर्छन्, त्यसैले हरेक शिपमेन्टमा विवरण पुष्टि गर्नुहोस्।",
    related: "सम्बन्धित मार्गदर्शिका",
    open: "मार्गदर्शिका पढ्नुहोस्",
  },
  hi: {
    title: "माल ढुलाई गाइड",
    description: "नेपाल में और नेपाल से माल भेजने की व्यावहारिक गाइड: कस्टम्स क्लियरेंस, भारतीय बंदरगाहों से समुद्री माल, काठमांडू में हवाई माल, HS कोड और ड्यूटी।",
    intro: "नेपाल में और नेपाल से माल ले जाने से जुड़े आम सवालों के सीधे जवाब, योजना सूची के रूप में। ज़रूरतें माल और समय के साथ बदलती हैं, इसलिए हर शिपमेंट के लिए विवरण की पुष्टि करें।",
    related: "संबंधित गाइड",
    open: "गाइड पढ़ें",
  },
  zh: {
    title: "货运指南",
    description: "进出尼泊尔货运实用指南：清关、经印度港口的海运、空运至加德满都、HS 编码与关税，以及免费期与滞期费。",
    intro: "以规划清单的形式，简明解答进出尼泊尔货运的常见问题。具体要求因货物而异并会随时间变化，请逐票确认细节。",
    related: "相关指南",
    open: "阅读指南",
  },
};
