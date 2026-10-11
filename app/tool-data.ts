import type { DutyToolError, StorageToolError } from "./importer-tools";
import type { SiteLocale } from "./site-i18n";

/*
 * The words on the free tools, in each language the site speaks. A page hands
 * its calculator only its own language's copy, so a reader downloads one
 * language, not four. Every tool says what it is: an estimate to plan with,
 * not a quotation and not a customs assessment.
 *
 * In templates, {currency}, {days}, {rate}, {n}, {percent} and {box} are filled
 * in by the page.
 */

export const toolSlugs = ["duty-estimate", "storage-charges", "volume-weight"] as const;
export type ToolSlug = (typeof toolSlugs)[number];

type ToolPage = {
  title: string;
  description: string;
  intro: string;
  how: string[];
  caveat: string;
};

export type DutyToolCopy = ToolPage & {
  value: string;
  currency: string;
  basis: string;
  basisFob: string;
  basisCif: string;
  freight: string;
  insurance: string;
  inCurrency: string;
  exchange: string;
  exchangeHint: string;
  duty: string;
  dutyHint: string;
  excise: string;
  exciseHint: string;
  vat: string;
  vatHint: string;
  cif: string;
  dutyLine: string;
  exciseLine: string;
  vatLine: string;
  total: string;
  empty: string;
  errors: Record<DutyToolError, string>;
};

export type StorageToolCopy = ToolPage & {
  started: string;
  startedHint: string;
  freeDays: string;
  freeDaysHint: string;
  collect: string;
  collectHint: string;
  rate: string;
  currency: string;
  laterRate: string;
  laterAfter: string;
  laterHint: string;
  lastFree: string;
  noFree: string;
  chargeable: string;
  band: string;
  total: string;
  inside: string;
  noRate: string;
  empty: string;
  errors: Record<StorageToolError, string>;
};

export type VolumeToolCopy = ToolPage & {
  lengthUnit: string;
  weightUnit: string;
  piece: string;
  length: string;
  width: string;
  height: string;
  quantity: string;
  weight: string;
  add: string;
  remove: string;
  pieces: string;
  volume: string;
  gross: string;
  volumetric: string;
  airChargeable: string;
  sea: string;
  seaUnit: string;
  containers: string;
  containerShare: string;
  boxes: Record<"20ft" | "40ft" | "40ft_hc", string>;
  quoteWith: string;
  empty: string;
  errors: Record<"pieces" | "dimensions", string>;
};

export type ToolsCopy = {
  index: { title: string; description: string; intro: string; open: string };
  eyebrow: string;
  result: string;
  optional: string;
  howTitle: string;
  privacy: string;
  quote: string;
  guide: string;
  others: string;
  "duty-estimate": DutyToolCopy;
  "storage-charges": StorageToolCopy;
  "volume-weight": VolumeToolCopy;
};

export const tools: Record<SiteLocale, ToolsCopy> = {
  en: {
    index: {
      title: "Free tools for importers",
      description: "Free calculators for shipping into Nepal: estimate customs duty and VAT, storage and demurrage past free time, and the volume and chargeable weight of a consignment.",
      intro: "Three sums importers into Nepal work out before a shipment moves. Each runs in your browser, keeps nothing you enter, and gives an estimate to plan with, not a quotation or a customs assessment.",
      open: "Open the calculator",
    },
    eyebrow: "Free tools",
    result: "Estimate",
    optional: "optional",
    howTitle: "How it is worked out",
    privacy: "Nothing you enter leaves this page.",
    quote: "Get a quote",
    guide: "Read the import guide",
    others: "Other tools",
    "duty-estimate": {
      title: "Import duty and VAT estimate",
      description: "Estimate Nepal customs duty, excise and VAT on an import from the invoice value, freight, exchange rate and the tariff rates for your goods.",
      intro: "Enter the invoice value and the rates for your goods to see roughly what customs will charge at the border, so the money is ready before the cargo arrives.",
      value: "Invoice value",
      currency: "Currency",
      basis: "The invoice value is",
      basisFob: "FOB: freight and insurance are added",
      basisCif: "CIF: freight and insurance are included",
      freight: "Freight to Nepal",
      insurance: "Insurance",
      inCurrency: "In {currency}.",
      exchange: "Exchange rate",
      exchangeHint: "Rupees for one {currency}. Customs converts at its own rate on the day of assessment; Nepal Rastra Bank publishes the reference rates.",
      duty: "Customs duty",
      dutyHint: "The rate in Nepal's customs tariff for the goods' HS code.",
      excise: "Excise",
      exciseHint: "Only for goods that carry excise.",
      vat: "VAT",
      vatHint: "Nepal's standard rate is 13%. Some goods are exempt.",
      cif: "Customs value (CIF) in rupees",
      dutyLine: "Customs duty",
      exciseLine: "Excise",
      vatLine: "VAT",
      total: "Duty and taxes, estimated",
      empty: "Enter the invoice value, the exchange rate and the duty rate to see the estimate.",
      errors: {
        value: "Enter the invoice value.",
        exchange: "Enter the exchange rate: rupees for one unit of the invoice currency.",
        costs: "Freight and insurance must be zero or more.",
        rate: "Duty and excise must be between 0 and 300%, and VAT between 0 and 100%.",
      },
      how: [
        "Customs assesses on the CIF value: the goods plus freight and insurance to the border, converted to rupees.",
        "Customs duty is the tariff rate on that value. Excise, where it applies, is charged on the value plus duty.",
        "VAT is charged on the value plus duty plus excise.",
      ],
      caveat: "An estimate to plan with, not a customs assessment. Customs decides the value, the HS classification and the exchange rate, and some goods carry other levies or need permits. KCPL's and the carriers' charges are separate.",
    },
    "storage-charges": {
      title: "Storage and demurrage calculator",
      description: "Work out how many days past free time a container or consignment will be charged, and roughly what storage, demurrage or detention will cost.",
      intro: "Free time runs out sooner than people expect. Enter when the clock started, the free days and the day you expect to collect, and see the chargeable days and the cost.",
      started: "Free time started on",
      startedHint: "Discharge or gate-in at the port or ICD, or the date on the arrival notice.",
      freeDays: "Free days",
      freeDaysHint: "As the line or terminal granted them.",
      collect: "Collected on",
      collectHint: "The day the cargo leaves, or the empty container is returned.",
      rate: "Charge per day",
      currency: "Currency",
      laterRate: "Charge per day after that",
      laterAfter: "Higher charge starts after",
      laterHint: "Chargeable days. Many lines raise the rate in steps.",
      lastFree: "Last free day",
      noFree: "No free days",
      chargeable: "Chargeable days",
      band: "{days} days at {rate}",
      total: "Charge, estimated",
      inside: "Collected inside free time: nothing to pay.",
      noRate: "Enter the charge per day to see the cost.",
      empty: "Enter the start date, the free days and the collection date.",
      errors: {
        dates: "Enter both dates; collection can't be before the start.",
        days: "Free days must be a whole number from 0 to 365.",
        rate: "Charges must be zero or more, and the step a whole number of days.",
      },
      how: [
        "The first free day is the day the clock starts, so 7 free days from the 1st run to the end of the 7th.",
        "Every day after the last free day is charged, including the day of collection.",
        "Where the rate rises in steps, the first rate covers the days up to the step and the second every day after it.",
      ],
      caveat: "Lines and terminals set their own free time, rates and counting rules, and port storage is charged separately from container demurrage and detention. Check the figures against the arrival notice or the line's tariff.",
    },
    "volume-weight": {
      title: "Volume and chargeable weight calculator",
      description: "Work out a consignment's volume in cubic metres, its air-freight chargeable weight, its sea-freight weight or measure, and how much of a container it fills.",
      intro: "Enter each size of package once, with how many there are. The calculator adds up the volume and weight and shows what air and sea freight would charge on.",
      lengthUnit: "Dimensions in",
      weightUnit: "Weight in",
      piece: "Package {n}",
      length: "Length",
      width: "Width",
      height: "Height",
      quantity: "Pieces",
      weight: "Weight each",
      add: "Add another size",
      remove: "Remove package {n}",
      pieces: "Pieces",
      volume: "Volume",
      gross: "Gross weight",
      volumetric: "Volumetric weight (air)",
      airChargeable: "Air chargeable weight",
      sea: "Sea part load, weight or measure",
      seaUnit: "revenue tonnes",
      containers: "Share of a container",
      containerShare: "{percent} of a {box}",
      boxes: { "20ft": "20ft", "40ft": "40ft", "40ft_hc": "40ft high cube" },
      quoteWith: "Get a quote with these figures",
      empty: "Enter the length, width and height of at least one package.",
      errors: {
        pieces: "Enter the length, width and height of at least one package.",
        dimensions: "Each package needs a length, width and height above zero, and a whole number of pieces.",
      },
      how: [
        "Volume is length × width × height for each package, times the number of pieces.",
        "Air freight charges on the greater of the actual weight and the volumetric weight: cubic centimetres divided by 6,000. Express couriers often divide by 5,000.",
        "Sea freight for a part load charges on the greater of the cubic metres and the weight in tonnes.",
      ],
      caveat: "Cargo never fills a container's full internal volume: packing, pallets and the way the load stacks leave space. KCPL checks the load plan against the actual dimensions.",
    },
  },
  ne: {
    index: {
      title: "आयातकर्ताका लागि निःशुल्क उपकरण",
      description: "नेपालमा ढुवानीका लागि निःशुल्क क्याल्कुलेटर: भन्सार महसुल र भ्याट, फ्री टाइमपछिको भण्डारण र डेमरेज, र कन्साइनमेन्टको आयतन तथा चार्ज हुने तौल।",
      intro: "शिपमेन्ट चल्नुअघि आयातकर्ताले गर्ने तीन हिसाब। सबै तपाईंकै ब्राउजरमा चल्छन्, तपाईंले भरेको केही पनि राखिँदैन, र योजनाका लागि अनुमान दिन्छन्; यो कोटेसन वा भन्सार निर्धारण होइन।",
      open: "क्याल्कुलेटर खोल्नुहोस्",
    },
    eyebrow: "निःशुल्क उपकरण",
    result: "अनुमान",
    optional: "ऐच्छिक",
    howTitle: "हिसाब कसरी हुन्छ",
    privacy: "तपाईंले भरेको केही पनि यो पेजबाट बाहिर जाँदैन।",
    quote: "कोटेसन माग्नुहोस्",
    guide: "आयात मार्गदर्शिका पढ्नुहोस्",
    others: "अन्य उपकरण",
    "duty-estimate": {
      title: "आयात महसुल र भ्याट अनुमान",
      description: "इन्भोइस मूल्य, भाडा, विनिमय दर र सामानको महसुल दरबाट नेपालको भन्सार महसुल, अन्तःशुल्क र भ्याटको अनुमान गर्नुहोस्।",
      intro: "सीमामा भन्सारले लगभग कति लिन्छ भनेर हेर्न इन्भोइस मूल्य र सामानका दरहरू भर्नुहोस्, ताकि कार्गो आउनुअघि रकम तयार रहोस्।",
      value: "इन्भोइस मूल्य",
      currency: "मुद्रा",
      basis: "इन्भोइस मूल्य",
      basisFob: "FOB: भाडा र बीमा थपिन्छ",
      basisCif: "CIF: भाडा र बीमा समावेश छ",
      freight: "नेपालसम्मको भाडा",
      insurance: "बीमा",
      inCurrency: "{currency} मा।",
      exchange: "विनिमय दर",
      exchangeHint: "एक {currency} बराबर रुपैयाँ। भन्सारले निर्धारणको दिनको आफ्नै दरमा रूपान्तरण गर्छ; नेपाल राष्ट्र बैंकले सन्दर्भ दर प्रकाशित गर्छ।",
      duty: "भन्सार महसुल",
      dutyHint: "सामानको HS कोडका लागि नेपालको भन्सार महसुल दरबन्दीमा भएको दर।",
      excise: "अन्तःशुल्क",
      exciseHint: "अन्तःशुल्क लाग्ने सामानमा मात्र।",
      vat: "भ्याट",
      vatHint: "नेपालको सामान्य दर १३% हो। केही सामानमा छुट हुन्छ।",
      cif: "भन्सार मूल्य (CIF) रुपैयाँमा",
      dutyLine: "भन्सार महसुल",
      exciseLine: "अन्तःशुल्क",
      vatLine: "भ्याट",
      total: "महसुल र कर, अनुमानित",
      empty: "अनुमान हेर्न इन्भोइस मूल्य, विनिमय दर र महसुल दर भर्नुहोस्।",
      errors: {
        value: "इन्भोइस मूल्य भर्नुहोस्।",
        exchange: "विनिमय दर भर्नुहोस्: इन्भोइस मुद्राको एक एकाइ बराबर रुपैयाँ।",
        costs: "भाडा र बीमा शून्य वा बढी हुनुपर्छ।",
        rate: "महसुल र अन्तःशुल्क ० देखि ३००% र भ्याट ० देखि १००% बीच हुनुपर्छ।",
      },
      how: [
        "भन्सारले CIF मूल्यमा निर्धारण गर्छ: सामान, सीमासम्मको भाडा र बीमा, रुपैयाँमा रूपान्तरित।",
        "भन्सार महसुल त्यो मूल्यमा दरबन्दीको दर हो। अन्तःशुल्क लाग्ने भए मूल्य र महसुलमा लाग्छ।",
        "भ्याट मूल्य, महसुल र अन्तःशुल्कको जोडमा लाग्छ।",
      ],
      caveat: "योजनाका लागि अनुमान हो, भन्सार निर्धारण होइन। मूल्य, HS वर्गीकरण र विनिमय दर भन्सारले तय गर्छ, र केही सामानमा अरू शुल्क वा अनुमति लाग्छ। KCPL र ढुवानीकर्ताका शुल्क छुट्टै हुन्छन्।",
    },
    "storage-charges": {
      title: "भण्डारण र डेमरेज क्याल्कुलेटर",
      description: "कन्टेनर वा कन्साइनमेन्टमा फ्री टाइमपछि कति दिनको शुल्क लाग्छ र भण्डारण, डेमरेज वा डिटेन्सन लगभग कति हुन्छ भनेर हिसाब गर्नुहोस्।",
      intro: "फ्री टाइम सोचेभन्दा छिटो सकिन्छ। घडी सुरु भएको दिन, फ्री दिन र उठाउने दिन भर्नुहोस्, अनि शुल्क लाग्ने दिन र रकम हेर्नुहोस्।",
      started: "फ्री टाइम सुरु मिति",
      startedHint: "बन्दरगाह वा ICD मा डिस्चार्ज वा गेट-इन, वा अराइभल नोटिसको मिति।",
      freeDays: "फ्री दिन",
      freeDaysHint: "लाइन वा टर्मिनलले दिएजति।",
      collect: "उठाउने मिति",
      collectHint: "कार्गो निस्कने वा खाली कन्टेनर फिर्ता हुने दिन।",
      rate: "प्रतिदिन शुल्क",
      currency: "मुद्रा",
      laterRate: "त्यसपछि प्रतिदिन शुल्क",
      laterAfter: "बढी शुल्क सुरु हुने",
      laterHint: "शुल्क लाग्ने दिनपछि। धेरै लाइनले चरणबद्ध रूपमा दर बढाउँछन्।",
      lastFree: "अन्तिम फ्री दिन",
      noFree: "फ्री दिन छैन",
      chargeable: "शुल्क लाग्ने दिन",
      band: "{days} दिन × {rate}",
      total: "शुल्क, अनुमानित",
      inside: "फ्री टाइमभित्रै उठाइयो: तिर्नुपर्दैन।",
      noRate: "रकम हेर्न प्रतिदिन शुल्क भर्नुहोस्।",
      empty: "सुरु मिति, फ्री दिन र उठाउने मिति भर्नुहोस्।",
      errors: {
        dates: "दुवै मिति भर्नुहोस्; उठाउने मिति सुरु मितिभन्दा अघि हुन सक्दैन।",
        days: "फ्री दिन ० देखि ३६५ सम्मको पूर्ण संख्या हुनुपर्छ।",
        rate: "शुल्क शून्य वा बढी, र चरण पूर्ण दिनमा हुनुपर्छ।",
      },
      how: [
        "घडी सुरु भएको दिन नै पहिलो फ्री दिन हो, त्यसैले १ गतेदेखि ७ फ्री दिन ७ गतेको अन्त्यसम्म हुन्छ।",
        "अन्तिम फ्री दिनपछिको हरेक दिनमा शुल्क लाग्छ, उठाउने दिन पनि।",
        "दर चरणमा बढ्ने भए पहिलो दर चरणसम्मका दिनमा र दोस्रो दर त्यसपछिका हरेक दिनमा लाग्छ।",
      ],
      caveat: "लाइन र टर्मिनलले आफ्नै फ्री टाइम, दर र गन्ने नियम राख्छन्, र बन्दरगाह भण्डारण कन्टेनर डेमरेज र डिटेन्सनभन्दा छुट्टै लाग्छ। अराइभल नोटिस वा लाइनको दरसँग मिलाएर हेर्नुहोस्।",
    },
    "volume-weight": {
      title: "आयतन र चार्ज हुने तौल क्याल्कुलेटर",
      description: "कन्साइनमेन्टको आयतन घन मिटरमा, हवाई ढुवानीको चार्ज हुने तौल, समुद्री ढुवानीको तौल वा नाप, र कन्टेनरको कति भाग भरिन्छ भनेर हिसाब गर्नुहोस्।",
      intro: "प्याकेजको हरेक साइज एक पटक र कति थान छन् भर्नुहोस्। क्याल्कुलेटरले आयतन र तौल जोडेर हवाई र समुद्री ढुवानीले केमा शुल्क लिन्छ देखाउँछ।",
      lengthUnit: "नाप",
      weightUnit: "तौल",
      piece: "प्याकेज {n}",
      length: "लम्बाइ",
      width: "चौडाइ",
      height: "उचाइ",
      quantity: "थान",
      weight: "प्रति थान तौल",
      add: "अर्को साइज थप्नुहोस्",
      remove: "प्याकेज {n} हटाउनुहोस्",
      pieces: "थान",
      volume: "आयतन",
      gross: "कुल तौल",
      volumetric: "भोल्युमेट्रिक तौल (हवाई)",
      airChargeable: "हवाई चार्ज हुने तौल",
      sea: "समुद्री आंशिक लोड, तौल वा नाप",
      seaUnit: "रेभेन्यु टन",
      containers: "कन्टेनरको भाग",
      containerShare: "{box} को {percent}",
      boxes: { "20ft": "२० फिट", "40ft": "४० फिट", "40ft_hc": "४० फिट हाई क्युब" },
      quoteWith: "यी आँकडासहित कोटेसन माग्नुहोस्",
      empty: "कम्तीमा एउटा प्याकेजको लम्बाइ, चौडाइ र उचाइ भर्नुहोस्।",
      errors: {
        pieces: "कम्तीमा एउटा प्याकेजको लम्बाइ, चौडाइ र उचाइ भर्नुहोस्।",
        dimensions: "हरेक प्याकेजको लम्बाइ, चौडाइ र उचाइ शून्यभन्दा बढी र थान पूर्ण संख्या हुनुपर्छ।",
      },
      how: [
        "आयतन हरेक प्याकेजको लम्बाइ × चौडाइ × उचाइ, गुणा थान संख्या हो।",
        "हवाई ढुवानीले वास्तविक तौल र भोल्युमेट्रिक तौलमध्ये ठूलोमा शुल्क लिन्छ: घन सेन्टिमिटरलाई ६,००० ले भाग। एक्सप्रेस कुरियरले प्रायः ५,००० ले भाग गर्छन्।",
        "आंशिक लोडको समुद्री ढुवानीले घन मिटर र टनमा तौलमध्ये ठूलोमा शुल्क लिन्छ।",
      ],
      caveat: "कार्गोले कन्टेनरको पूरा भित्री आयतन कहिल्यै भर्दैन: प्याकिङ, प्यालेट र लोड मिलाउने तरिकाले ठाउँ छोड्छ। KCPL ले वास्तविक नापसँग लोड प्लान जाँच गर्छ।",
    },
  },
  hi: {
    index: {
      title: "आयातकों के लिए मुफ़्त टूल",
      description: "नेपाल में शिपमेंट के लिए मुफ़्त कैलकुलेटर: कस्टम ड्यूटी और वैट, फ़्री टाइम के बाद स्टोरेज और डेमरेज, और कंसाइनमेंट का वॉल्यूम व चार्जेबल वज़न।",
      intro: "शिपमेंट चलने से पहले नेपाल के आयातक जो तीन हिसाब लगाते हैं। हर टूल आपके ब्राउज़र में चलता है, आपकी भरी कोई जानकारी नहीं रखता, और योजना के लिए अनुमान देता है; यह कोटेशन या कस्टम आकलन नहीं है।",
      open: "कैलकुलेटर खोलें",
    },
    eyebrow: "मुफ़्त टूल",
    result: "अनुमान",
    optional: "वैकल्पिक",
    howTitle: "हिसाब कैसे होता है",
    privacy: "आपकी भरी कोई जानकारी इस पेज से बाहर नहीं जाती।",
    quote: "कोटेशन लें",
    guide: "आयात गाइड पढ़ें",
    others: "अन्य टूल",
    "duty-estimate": {
      title: "आयात ड्यूटी और वैट अनुमान",
      description: "इनवॉइस मूल्य, भाड़ा, विनिमय दर और सामान की टैरिफ़ दरों से नेपाल की कस्टम ड्यूटी, एक्साइज़ और वैट का अनुमान लगाएँ।",
      intro: "सीमा पर कस्टम लगभग कितना लेगा यह देखने के लिए इनवॉइस मूल्य और सामान की दरें भरें, ताकि माल पहुँचने से पहले रकम तैयार रहे।",
      value: "इनवॉइस मूल्य",
      currency: "मुद्रा",
      basis: "इनवॉइस मूल्य",
      basisFob: "FOB: भाड़ा और बीमा जोड़ा जाता है",
      basisCif: "CIF: भाड़ा और बीमा शामिल है",
      freight: "नेपाल तक भाड़ा",
      insurance: "बीमा",
      inCurrency: "{currency} में।",
      exchange: "विनिमय दर",
      exchangeHint: "एक {currency} के बदले रुपये। कस्टम आकलन के दिन अपनी दर से बदलता है; नेपाल राष्ट्र बैंक संदर्भ दरें प्रकाशित करता है।",
      duty: "कस्टम ड्यूटी",
      dutyHint: "सामान के HS कोड के लिए नेपाल के कस्टम टैरिफ़ में दी गई दर।",
      excise: "एक्साइज़",
      exciseHint: "केवल उन सामानों पर जिन पर एक्साइज़ लगता है।",
      vat: "वैट",
      vatHint: "नेपाल की सामान्य दर 13% है। कुछ सामान छूट में हैं।",
      cif: "कस्टम मूल्य (CIF) रुपये में",
      dutyLine: "कस्टम ड्यूटी",
      exciseLine: "एक्साइज़",
      vatLine: "वैट",
      total: "ड्यूटी और कर, अनुमानित",
      empty: "अनुमान देखने के लिए इनवॉइस मूल्य, विनिमय दर और ड्यूटी दर भरें।",
      errors: {
        value: "इनवॉइस मूल्य भरें।",
        exchange: "विनिमय दर भरें: इनवॉइस मुद्रा की एक इकाई के बदले रुपये।",
        costs: "भाड़ा और बीमा शून्य या उससे अधिक होना चाहिए।",
        rate: "ड्यूटी और एक्साइज़ 0 से 300% और वैट 0 से 100% के बीच होना चाहिए।",
      },
      how: [
        "कस्टम CIF मूल्य पर आकलन करता है: सामान, सीमा तक का भाड़ा और बीमा, रुपये में बदला हुआ।",
        "कस्टम ड्यूटी उस मूल्य पर टैरिफ़ दर है। एक्साइज़, जहाँ लागू हो, मूल्य और ड्यूटी पर लगता है।",
        "वैट मूल्य, ड्यूटी और एक्साइज़ के जोड़ पर लगता है।",
      ],
      caveat: "यह योजना के लिए अनुमान है, कस्टम आकलन नहीं। मूल्य, HS वर्गीकरण और विनिमय दर कस्टम तय करता है, और कुछ सामानों पर अन्य शुल्क या परमिट लगते हैं। KCPL और कैरियर के शुल्क अलग हैं।",
    },
    "storage-charges": {
      title: "स्टोरेज और डेमरेज कैलकुलेटर",
      description: "हिसाब लगाएँ कि कंटेनर या कंसाइनमेंट पर फ़्री टाइम के बाद कितने दिन का शुल्क लगेगा और स्टोरेज, डेमरेज या डिटेंशन लगभग कितना होगा।",
      intro: "फ़्री टाइम उम्मीद से जल्दी ख़त्म होता है। घड़ी शुरू होने की तारीख़, फ़्री दिन और उठाने का दिन भरें, और शुल्क वाले दिन व लागत देखें।",
      started: "फ़्री टाइम शुरू होने की तारीख़",
      startedHint: "पोर्ट या ICD पर डिस्चार्ज या गेट-इन, या अराइवल नोटिस की तारीख़।",
      freeDays: "फ़्री दिन",
      freeDaysHint: "जितने लाइन या टर्मिनल ने दिए।",
      collect: "उठाने की तारीख़",
      collectHint: "जिस दिन माल निकलता है या ख़ाली कंटेनर लौटता है।",
      rate: "प्रतिदिन शुल्क",
      currency: "मुद्रा",
      laterRate: "उसके बाद प्रतिदिन शुल्क",
      laterAfter: "ऊँचा शुल्क शुरू होता है",
      laterHint: "शुल्क वाले दिनों के बाद। कई लाइनें दर चरणों में बढ़ाती हैं।",
      lastFree: "आख़िरी फ़्री दिन",
      noFree: "कोई फ़्री दिन नहीं",
      chargeable: "शुल्क वाले दिन",
      band: "{days} दिन × {rate}",
      total: "शुल्क, अनुमानित",
      inside: "फ़्री टाइम में ही उठाया: कुछ नहीं देना।",
      noRate: "लागत देखने के लिए प्रतिदिन शुल्क भरें।",
      empty: "शुरू की तारीख़, फ़्री दिन और उठाने की तारीख़ भरें।",
      errors: {
        dates: "दोनों तारीख़ें भरें; उठाने की तारीख़ शुरू से पहले नहीं हो सकती।",
        days: "फ़्री दिन 0 से 365 तक की पूर्ण संख्या होनी चाहिए।",
        rate: "शुल्क शून्य या अधिक, और चरण पूरे दिनों में होना चाहिए।",
      },
      how: [
        "घड़ी शुरू होने का दिन ही पहला फ़्री दिन है, इसलिए 1 तारीख़ से 7 फ़्री दिन 7 तारीख़ के अंत तक चलते हैं।",
        "आख़िरी फ़्री दिन के बाद हर दिन का शुल्क लगता है, उठाने का दिन भी।",
        "जहाँ दर चरणों में बढ़ती है, पहली दर चरण तक के दिनों पर और दूसरी उसके बाद के हर दिन पर लगती है।",
      ],
      caveat: "लाइनें और टर्मिनल अपना फ़्री टाइम, दरें और गिनने के नियम ख़ुद तय करते हैं, और पोर्ट स्टोरेज कंटेनर डेमरेज और डिटेंशन से अलग लगता है। आँकड़े अराइवल नोटिस या लाइन के टैरिफ़ से मिलाएँ।",
    },
    "volume-weight": {
      title: "वॉल्यूम और चार्जेबल वज़न कैलकुलेटर",
      description: "कंसाइनमेंट का वॉल्यूम घन मीटर में, एयर फ़्रेट का चार्जेबल वज़न, सी फ़्रेट का वज़न या माप, और कंटेनर का कितना हिस्सा भरता है, यह निकालें।",
      intro: "पैकेज का हर साइज़ एक बार भरें, कितने नग हैं उसके साथ। कैलकुलेटर वॉल्यूम और वज़न जोड़कर दिखाता है कि एयर और सी फ़्रेट किस पर शुल्क लेंगे।",
      lengthUnit: "माप",
      weightUnit: "वज़न",
      piece: "पैकेज {n}",
      length: "लंबाई",
      width: "चौड़ाई",
      height: "ऊँचाई",
      quantity: "नग",
      weight: "प्रति नग वज़न",
      add: "एक और साइज़ जोड़ें",
      remove: "पैकेज {n} हटाएँ",
      pieces: "नग",
      volume: "वॉल्यूम",
      gross: "कुल वज़न",
      volumetric: "वॉल्यूमेट्रिक वज़न (एयर)",
      airChargeable: "एयर चार्जेबल वज़न",
      sea: "सी पार्ट लोड, वज़न या माप",
      seaUnit: "रेवेन्यू टन",
      containers: "कंटेनर का हिस्सा",
      containerShare: "{box} का {percent}",
      boxes: { "20ft": "20 फ़ुट", "40ft": "40 फ़ुट", "40ft_hc": "40 फ़ुट हाई क्यूब" },
      quoteWith: "इन आँकड़ों के साथ कोटेशन लें",
      empty: "कम से कम एक पैकेज की लंबाई, चौड़ाई और ऊँचाई भरें।",
      errors: {
        pieces: "कम से कम एक पैकेज की लंबाई, चौड़ाई और ऊँचाई भरें।",
        dimensions: "हर पैकेज की लंबाई, चौड़ाई और ऊँचाई शून्य से अधिक, और नग पूर्ण संख्या होनी चाहिए।",
      },
      how: [
        "वॉल्यूम हर पैकेज की लंबाई × चौड़ाई × ऊँचाई, गुणा नगों की संख्या है।",
        "एयर फ़्रेट असली वज़न और वॉल्यूमेट्रिक वज़न में से बड़े पर शुल्क लेता है: घन सेंटीमीटर को 6,000 से भाग। एक्सप्रेस कूरियर अक्सर 5,000 से भाग देते हैं।",
        "पार्ट लोड का सी फ़्रेट घन मीटर और टन में वज़न में से बड़े पर शुल्क लेता है।",
      ],
      caveat: "माल कभी भी कंटेनर का पूरा भीतरी वॉल्यूम नहीं भरता: पैकिंग, पैलेट और लोड जमाने का तरीक़ा जगह छोड़ते हैं। KCPL असली माप से लोड प्लान जाँचता है।",
    },
  },
  zh: {
    index: {
      title: "进口商免费工具",
      description: "运往尼泊尔的免费计算器：估算关税和增值税、免费期后的堆存费和滞期费，以及货物的体积和计费重量。",
      intro: "货物发运前，进口商要算的三笔账。所有计算都在您的浏览器中完成，不保存您输入的任何内容，结果仅供规划参考，不是报价，也不是海关核定。",
      open: "打开计算器",
    },
    eyebrow: "免费工具",
    result: "估算",
    optional: "选填",
    howTitle: "计算方法",
    privacy: "您输入的内容不会离开本页面。",
    quote: "获取报价",
    guide: "阅读进口指南",
    others: "其他工具",
    "duty-estimate": {
      title: "进口关税和增值税估算",
      description: "根据发票金额、运费、汇率和货物的税则税率，估算尼泊尔进口关税、消费税和增值税。",
      intro: "填写发票金额和货物适用的税率，大致了解边境海关将收取多少，以便在货物到达前备好资金。",
      value: "发票金额",
      currency: "币种",
      basis: "发票金额为",
      basisFob: "FOB：需另加运费和保险费",
      basisCif: "CIF：已含运费和保险费",
      freight: "至尼泊尔的运费",
      insurance: "保险费",
      inCurrency: "以 {currency} 计。",
      exchange: "汇率",
      exchangeHint: "1 {currency} 兑换的卢比数。海关按核定当日自己的汇率折算；尼泊尔国家银行公布参考汇率。",
      duty: "关税",
      dutyHint: "尼泊尔海关税则中该货物 HS 编码对应的税率。",
      excise: "消费税",
      exciseHint: "仅适用于需缴纳消费税的货物。",
      vat: "增值税",
      vatHint: "尼泊尔的标准税率为 13%，部分货物免税。",
      cif: "完税价格（CIF，卢比）",
      dutyLine: "关税",
      exciseLine: "消费税",
      vatLine: "增值税",
      total: "税费合计（估算）",
      empty: "填写发票金额、汇率和关税税率即可查看估算。",
      errors: {
        value: "请填写发票金额。",
        exchange: "请填写汇率：1 单位发票币种兑换的卢比数。",
        costs: "运费和保险费不能为负数。",
        rate: "关税和消费税须在 0 至 300% 之间，增值税须在 0 至 100% 之间。",
      },
      how: [
        "海关按 CIF 价格核定：货值加上运至边境的运费和保险费，折算为卢比。",
        "关税为该价格乘以税则税率。如适用消费税，则按价格加关税计征。",
        "增值税按价格、关税和消费税之和计征。",
      ],
      caveat: "此结果仅供规划参考，并非海关核定。完税价格、HS 归类和汇率均由海关确定，部分货物还需缴纳其他费用或取得许可证。KCPL 和承运人的费用另计。",
    },
    "storage-charges": {
      title: "堆存费和滞期费计算器",
      description: "计算集装箱或货物在免费期后需计费的天数，以及堆存费、滞期费或滞箱费的大致金额。",
      intro: "免费期往往比预想的结束得更快。填写起算日期、免费天数和预计提货日期，即可查看计费天数和费用。",
      started: "免费期起算日",
      startedHint: "在港口或 ICD 卸货或进闸之日，或到货通知上的日期。",
      freeDays: "免费天数",
      freeDaysHint: "以船公司或码头给予的为准。",
      collect: "提货日期",
      collectHint: "货物离场或空箱归还之日。",
      rate: "每日费用",
      currency: "币种",
      laterRate: "此后每日费用",
      laterAfter: "提高费率的起点",
      laterHint: "计费天数之后。许多船公司分阶段提高费率。",
      lastFree: "最后免费日",
      noFree: "无免费天数",
      chargeable: "计费天数",
      band: "{days} 天 × {rate}",
      total: "费用（估算）",
      inside: "在免费期内提货：无需付费。",
      noRate: "填写每日费用即可查看金额。",
      empty: "请填写起算日期、免费天数和提货日期。",
      errors: {
        dates: "请填写两个日期；提货日期不能早于起算日期。",
        days: "免费天数须为 0 至 365 之间的整数。",
        rate: "费用不能为负数，阶段须为整天数。",
      },
      how: [
        "起算当天即为第一个免费日，因此从 1 日起的 7 个免费日到 7 日结束。",
        "最后免费日之后的每一天都计费，包括提货当天。",
        "如费率分阶段上调，第一档费率适用于阶段内的天数，第二档适用于此后的每一天。",
      ],
      caveat: "船公司和码头各自规定免费期、费率和计算规则，港口堆存费与集装箱滞期费、滞箱费分开收取。请与到货通知或船公司费率表核对。",
    },
    "volume-weight": {
      title: "体积和计费重量计算器",
      description: "计算货物的立方米体积、空运计费重量、海运重量或体积计费吨，以及占集装箱的比例。",
      intro: "每种尺寸的包装填写一次，并注明件数。计算器会汇总体积和重量，显示空运和海运的计费依据。",
      lengthUnit: "尺寸单位",
      weightUnit: "重量单位",
      piece: "包装 {n}",
      length: "长",
      width: "宽",
      height: "高",
      quantity: "件数",
      weight: "单件重量",
      add: "添加另一种尺寸",
      remove: "删除包装 {n}",
      pieces: "件数",
      volume: "体积",
      gross: "毛重",
      volumetric: "体积重量（空运）",
      airChargeable: "空运计费重量",
      sea: "海运拼箱，重量或体积",
      seaUnit: "计费吨",
      containers: "占集装箱比例",
      containerShare: "{box} 的 {percent}",
      boxes: { "20ft": "20 英尺", "40ft": "40 英尺", "40ft_hc": "40 英尺高柜" },
      quoteWith: "用这些数据获取报价",
      empty: "请至少填写一种包装的长、宽、高。",
      errors: {
        pieces: "请至少填写一种包装的长、宽、高。",
        dimensions: "每种包装的长、宽、高须大于零，件数须为整数。",
      },
      how: [
        "体积为每种包装的长 × 宽 × 高，乘以件数。",
        "空运按实际重量和体积重量中较大者计费：立方厘米除以 6,000。快递公司通常除以 5,000。",
        "海运拼箱按立方米数和吨数中较大者计费。",
      ],
      caveat: "货物永远无法装满集装箱的全部内部容积：包装、托盘和堆码方式都会留出空间。KCPL 会按实际尺寸核对装箱方案。",
    },
  },
};

export function toolCopy(locale: SiteLocale) {
  return tools[locale];
}
