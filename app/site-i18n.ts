/*
 * Public website language.
 *
 * The customer portal already proved the shape this needs: a typed dictionary
 * where a missing Nepali key is a compile error rather than an English word
 * surfacing mid-sentence. The public site reuses that discipline for the same
 * reason — the reader is often the documentation clerk or the owner of a small
 * trading business, not the director who takes the call in English.
 *
 * Two rules carry over from the portal and matter just as much here:
 *
 *   1. Trade vocabulary stays as Kathmandu freight desks say it. "Bill of
 *      lading" is बिल अफ लेडिङ in a clearing office, not a coined translation.
 *   2. Names are records, not copy. Ports, corridors, projects, the company
 *      name and the Managing Director's name are never translated.
 */

export const siteLocales = ["en", "ne"] as const;
export type SiteLocale = (typeof siteLocales)[number];

export const siteLocaleLabels: Record<SiteLocale, string> = {
  en: "English",
  ne: "नेपाली",
};

/** BCP 47 for the `lang` attribute, so screen readers and hyphenation follow. */
export const siteLocaleTags: Record<SiteLocale, string> = {
  en: "en",
  ne: "ne-NP",
};

/** English sits at the root; Nepali is prefixed. One helper owns that rule. */
export function sitePath(locale: SiteLocale, path: string) {
  const clean = path === "/" ? "" : path;
  return locale === "en" ? clean || "/" : `/ne${clean}`;
}

/** The same page in the other language, for the switch in the header. */
export function siteAlternatePath(locale: SiteLocale, path: string) {
  return sitePath(locale === "en" ? "ne" : "en", path);
}

const en = {
  /* Chrome */
  "chrome.skip": "Skip to content",
  "chrome.nav_label": "Main",
  "chrome.home": "Home",
  "chrome.services": "Services",
  "chrome.sectors": "Sectors & projects",
  "chrome.network": "Network",
  "chrome.about": "About",
  "chrome.contact": "Contact",
  "chrome.quote": "Request a quote",
  "chrome.track": "Track a shipment",
  "chrome.language": "Language",
  "chrome.menu": "Menu",
  "chrome.close": "Close",
  "chrome.portal": "Customer portal",
  "chrome.rights": "All rights reserved.",
  "chrome.footer_services": "Services",
  "chrome.footer_company": "Company",
  "chrome.footer_contact": "Contact",

  /* Company constants that read as copy */
  "company.tagline": "From Nepal. To the world.",
  "company.established": "Established 2015, Kathmandu, Nepal",
  "company.established_short": "Established 2015",
  "company.established_where": "Kathmandu, Nepal",

  /* Home */
  "home.meta_title": "Kapileshwor Cargo | Freight Forwarding in Nepal",
  "home.meta_description": "KCPL is a Kathmandu freight and logistics company established in 2015, coordinating air, ocean and road freight, customs documentation and project cargo for Nepalese importers and exporters.",
  "home.hero_title": "One desk, from booking to proof of delivery.",
  "home.hero_intro": "Air, ocean and road freight, customs documentation and project cargo, for Nepalese importers and exporters.",
  "home.hero_cta": "Request a quote",
  "home.hero_secondary": "See what we handle",

  "home.capability_title": "What a shipment needs, from one desk.",
  "home.capability_intro": "Most delays are not transport failures. They happen where a document, a customs requirement and a carrier deadline meet and nobody owns the join.",
  "home.cap_1_title": "Freight",
  "home.cap_1_copy": "Air, ocean and road freight, FCL and LCL, chosen around the cargo, the deadline and the route rather than a default lane.",
  "home.cap_2_title": "Customs and documents",
  "home.cap_2_copy": "Customs and trade documentation: bills of lading, airway bills, invoices, packing lists, certificates and permits, prepared and followed through.",
  "home.cap_3_title": "Project cargo",
  "home.cap_3_copy": "Project and specialist cargo, from breakbulk and open-top to over-height and oversized units, planned with route, trailer and handling reviewed first.",
  "home.cap_4_title": "Delivery and proof",
  "home.cap_4_copy": "Storage, delivery coordination and proof of delivery, so a movement ends with a record rather than an assumption.",
  "home.capability_link": "All services",

  "home.corridor_title": "Corridors into and out of Nepal.",
  "home.corridor_intro": "Nepal is landlocked, so almost every ocean movement is really two movements and a border. KCPL plans both halves together.",
  "home.corridor_in_title": "Into Nepal",
  "home.corridor_in_copy": "China and Southeast Asian origins through Indian gateways, moved inland by road and rail-linked services to Birgunj, Kathmandu and western Nepal.",
  "home.corridor_out_title": "Out of Nepal",
  "home.corridor_out_copy": "Air exports from Kathmandu and ocean exports through Kolkata to North America, Europe, Australia and Asian markets.",
  "home.corridor_gateways": "Gateways",
  "home.corridor_origins": "Frequent origins",
  "home.corridor_destinations": "Frequent destinations",
  "home.corridor_link": "Network & coverage",

  "home.proof_eyebrow": "Evidence",
  "home.proof_title": "Three completed movements.",
  "home.proof_intro": "Customer and project identities stay private.",
  "home.proof_1_kicker": "Breakbulk, infrastructure",
  "home.proof_1_title": "308 packages to an inland project site",
  "home.proof_1_copy": "A multi-package breakbulk infrastructure movement handled at an Indian gateway, delivered inland in phases and closed out with delivery records at site.",
  "home.proof_2_kicker": "Air export, disruption",
  "home.proof_2_title": "Time-critical air export through a network failure",
  "home.proof_2_copy": "A multi-package air export from Kathmandu rerouted mid-journey during carrier-network disruption, received in good order by the consignee.",
  "home.proof_3_kicker": "FCL, western Nepal",
  "home.proof_3_title": "Six containers, door-delivered to Nepalgunj",
  "home.proof_3_copy": "A multi-container DDU movement through an Indian gateway to western Nepal, completed with unloading evidence and a signed delivery receipt.",
  "home.proof_link": "Sectors & projects",

  "home.credibility_title": "Capacity and project work.",
  "home.credibility_copy": "KCPL works from Kathmandu, with counterpart agents abroad and customs capability at Nepal's entry points.",
  "home.credibility_award": "Export Excellence Award",
  "home.credibility_award_detail": "Lalitpur Chamber of Commerce, 2022-2025",
  "home.credibility_storage": "Secured storage",
  "home.credibility_storage_detail": "Over 1,000 sqm air cargo, over 6,000 sqm road cargo",
  "home.credibility_member": "Memberships",
  "home.credibility_member_detail": "CPL and NEFFA member",
  "home.credibility_projects": "Infrastructure",
  "home.credibility_projects_detail": "Project handling agent on NEA transmission and substation work",

  "home.cta_title": "Tell us the cargo, the route and the date.",
  "home.cta_copy": "Send the origin, destination, mode, weight and dimensions, and KCPL will come back on how the movement should be planned.",
  "home.cta_primary": "Request a quote",
  "home.cta_secondary": "Contact the team",

  /* Services */
  "services.meta_title": "Freight Services",
  "services.meta_description": "Air, ocean and road freight, customs and documentation, project cargo, warehousing and delivery, coordinated from Kathmandu for Nepalese importers and exporters.",
  "services.title": "Services",
  "services.intro": "Seven services that make up one movement. Most shipments use several, planned together rather than handed between desks.",
  "services.detail_link": "Service detail",
  "services.covers": "What it covers",
  "services.ask": "Useful to tell us",
  "services.back": "All services",
  "services.related": "Often planned with",

  "svc.air.title": "Air freight",
  "svc.air.summary": "Airport-to-airport and door movements out of Kathmandu, and inbound air cargo where a deadline decides the mode.",
  "svc.air.p1": "Export bookings from Kathmandu to North America, Europe, Australia and Asian markets.",
  "svc.air.p2": "Airway bill preparation, carting, pre-alert and arrival follow-up.",
  "svc.air.p3": "Rerouting when a carrier network is disrupted, with the consignee kept informed.",
  "svc.air.ask": "Gross weight, dimensions, commodity, ready date, airport or door delivery.",

  "svc.ocean.title": "Ocean freight",
  "svc.ocean.summary": "FCL and LCL through Indian gateways, planned as one movement from origin port to the Nepal delivery point.",
  "svc.ocean.p1": "20ft, 40ft and 40HQ containers, plus LCL consolidations.",
  "svc.ocean.p2": "Gateway handling at Kolkata, Visakhapatnam and Haldia, with rail-linked movement to ICD Birgunj.",
  "svc.ocean.p3": "Bill of lading review, endorsement, delivery orders and de-stuffing coordination.",
  "svc.ocean.ask": "Container type and count or CBM, origin port, incoterm, final delivery address.",

  "svc.road.title": "Road freight",
  "svc.road.summary": "Cross-border and domestic trucking, including the inland half that every ocean movement into Nepal depends on.",
  "svc.road.p1": "India to Nepal movements through Raxaul and other border points.",
  "svc.road.p2": "Domestic distribution from Birgunj and Kathmandu to project sites and western Nepal.",
  "svc.road.p3": "Trailers and special equipment where the cargo will not travel on a standard bed.",
  "svc.road.ask": "Weight, dimensions, collection point, delivery point, access at both ends.",

  "svc.customs.title": "Customs and documentation",
  "svc.customs.summary": "Document preparation and clearance support at Nepal's entry points, and for exports leaving through Indian gateways.",
  "svc.customs.p1": "Invoices, packing lists, certificates of origin, permits and duty-exemption paperwork.",
  "svc.customs.p2": "Transit documentation for rail-linked and road movements into Nepal.",
  "svc.customs.p3": "Follow-up until the entry is cleared, rather than filing and waiting.",
  "svc.customs.ask": "Commodity, HS code if known, value, any licence or exemption already held.",

  "svc.project.title": "Project and specialist cargo",
  "svc.project.summary": "Breakbulk, open-top, over-height and oversized units, planned around the route before anything is booked.",
  "svc.project.p1": "Route and trailer survey, handling method and lifting requirements.",
  "svc.project.p2": "Transmission and substation equipment moved to inland project sites.",
  "svc.project.p3": "Phased delivery with records at site, where a single drop is not practical.",
  "svc.project.ask": "Piece dimensions and weights, total packages, site access, required completion date.",

  "svc.warehouse.title": "Warehousing and packaging",
  "svc.warehouse.summary": "Secured storage arrangements and cargo preparation, used as part of a movement rather than sold on their own.",
  "svc.warehouse.p1": "Over 1,000 sqm for air cargo and over 6,000 sqm for road cargo.",
  "svc.warehouse.p2": "Consolidation and deconsolidation before onward dispatch.",
  "svc.warehouse.p3": "Packing and preparation for export handling.",
  "svc.warehouse.ask": "Volume, duration, whether the cargo needs handling or only storage.",

  "svc.delivery.title": "Delivery and proof",
  "svc.delivery.summary": "Final delivery coordination and the evidence that a movement actually closed.",
  "svc.delivery.p1": "Delivery scheduling with the consignee and the site.",
  "svc.delivery.p2": "Unloading evidence and signed delivery receipts.",
  "svc.delivery.p3": "Status updates through the movement, and a record at the end of it.",
  "svc.delivery.ask": "Delivery address, site contact, unloading equipment available, receiving hours.",
} as const;

export type SiteTextKey = keyof typeof en;

const ne: Record<SiteTextKey, string> = {
  /* Chrome */
  "chrome.skip": "मुख्य सामग्रीमा जानुहोस्",
  "chrome.nav_label": "मुख्य",
  "chrome.home": "गृहपृष्ठ",
  "chrome.services": "सेवाहरू",
  "chrome.sectors": "क्षेत्र र परियोजना",
  "chrome.network": "सञ्जाल",
  "chrome.about": "हाम्रो बारेमा",
  "chrome.contact": "सम्पर्क",
  "chrome.quote": "कोटेसन माग्नुहोस्",
  "chrome.track": "ट्र्याक गर्नुहोस्",
  "chrome.language": "भाषा",
  "chrome.menu": "मेनु",
  "chrome.close": "बन्द गर्नुहोस्",
  "chrome.portal": "ग्राहक पोर्टल",
  "chrome.rights": "सर्वाधिकार सुरक्षित।",
  "chrome.footer_services": "सेवाहरू",
  "chrome.footer_company": "कम्पनी",
  "chrome.footer_contact": "सम्पर्क",

  "company.tagline": "नेपालबाट। विश्वभर।",
  "company.established": "स्थापना २०१५, काठमाडौँ, नेपाल",
  "company.established_short": "स्थापना २०१५",
  "company.established_where": "काठमाडौँ, नेपाल",

  /* Home */
  "home.meta_title": "कपिलेश्वर कार्गो | नेपालमा फ्रेट फर्वार्डिङ",
  "home.meta_description": "काठमाडौँमा २०१५ मा स्थापित कपिलेश्वर कार्गोले नेपालका आयातकर्ता र निर्यातकर्ताका लागि एयर, ओसन र रोड फ्रेट, भन्सार कागजात र प्रोजेक्ट कार्गो समन्वय गर्छ।",
  "home.hero_title": "बुकिङदेखि डेलिभरी प्रमाणसम्म, एउटै डेस्क।",
  "home.hero_intro": "नेपाली आयातकर्ता र निर्यातकर्ताका लागि एयर, ओसन र रोड फ्रेट, भन्सार कागजात र प्रोजेक्ट कार्गो।",
  "home.hero_cta": "कोटेसन माग्नुहोस्",
  "home.hero_secondary": "हामी के ह्यान्डल गर्छौं",

  "home.capability_title": "शिपमेन्टलाई चाहिने कुरा, एउटै डेस्कबाट।",
  "home.capability_intro": "धेरैजसो ढिलाइ ट्रान्सपोर्टको कारणले हुँदैन। कागजात, भन्सारको आवश्यकता र क्यारियरको समयसीमा जोडिने ठाउँमा कसैले जिम्मा नलिँदा हुन्छ।",
  "home.cap_1_title": "फ्रेट",
  "home.cap_1_copy": "एयर, ओसन र रोड फ्रेट, FCL र LCL: कार्गो, समयसीमा र रुट हेरेर छनोट गरिन्छ, बानीको लेन हेरेर होइन।",
  "home.cap_2_title": "भन्सार र कागजात",
  "home.cap_2_copy": "भन्सार र व्यापार कागजात: बिल अफ लेडिङ, एयरवे बिल, इनभ्वाइस, प्याकिङ लिस्ट, सर्टिफिकेट र परमिट, तयार पारेर पछ्याइन्छ।",
  "home.cap_3_title": "प्रोजेक्ट कार्गो",
  "home.cap_3_copy": "प्रोजेक्ट र विशेष कार्गो (ब्रेकबल्क, ओपन-टप, अग्लो र ओभरसाइज युनिट): रुट, ट्रेलर र ह्यान्डलिङ पहिले जाँचेर योजना बनाइन्छ।",
  "home.cap_4_title": "डेलिभरी र प्रमाण",
  "home.cap_4_copy": "भण्डारण, डेलिभरी समन्वय र प्रुफ अफ डेलिभरी। मुभमेन्ट अनुमानमा होइन, रेकर्डमा टुङ्गिन्छ।",
  "home.capability_link": "सबै सेवाहरू",

  "home.corridor_title": "नेपाल भित्रिने र बाहिरिने कोरिडोर।",
  "home.corridor_intro": "नेपाल भूपरिवेष्टित भएकाले प्रायः हरेक ओसन मुभमेन्ट दुई मुभमेन्ट र एउटा नाका हो। KCPL दुवै खण्डको योजना सँगै बनाउँछ।",
  "home.corridor_in_title": "नेपालभित्र",
  "home.corridor_in_copy": "चीन र दक्षिणपूर्वी एसियाली मूलबाट भारतीय गेटवे हुँदै, सडक र रेल-जोडिएको सेवाबाट वीरगन्ज, काठमाडौँ र पश्चिम नेपालसम्म।",
  "home.corridor_out_title": "नेपालबाहिर",
  "home.corridor_out_copy": "काठमाडौँबाट एयर निर्यात र कोलकाता हुँदै ओसन निर्यात: उत्तर अमेरिका, युरोप, अस्ट्रेलिया र एसियाली बजारसम्म।",
  "home.corridor_gateways": "गेटवे",
  "home.corridor_origins": "बारम्बारका मूल",
  "home.corridor_destinations": "बारम्बारका गन्तव्य",
  "home.corridor_link": "सञ्जाल र कभरेज",

  "home.proof_eyebrow": "प्रमाण",
  "home.proof_title": "तीन सम्पन्न मुभमेन्ट।",
  "home.proof_intro": "ग्राहक र परियोजनाको पहिचान गोप्य राखिन्छ।",
  "home.proof_1_kicker": "ब्रेकबल्क, पूर्वाधार",
  "home.proof_1_title": "३०८ प्याकेज भित्री परियोजना साइटसम्म",
  "home.proof_1_copy": "भारतीय गेटवेमा ह्यान्डल गरिएको बहु-प्याकेज ब्रेकबल्क पूर्वाधार मुभमेन्ट, चरणबद्ध रूपमा भित्री क्षेत्रमा पुर्‍याइयो र साइटमै डेलिभरी रेकर्डसहित टुङ्ग्याइयो।",
  "home.proof_2_kicker": "एयर निर्यात, अवरोध",
  "home.proof_2_title": "नेटवर्क अवरोधबीच समय-संवेदनशील एयर निर्यात",
  "home.proof_2_copy": "काठमाडौँबाट गएको बहु-प्याकेज एयर निर्यात क्यारियर नेटवर्क अवरोधका बेला बीच बाटोमै अर्को रुटबाट पठाइयो र प्राप्तकर्ताले राम्रो अवस्थामा बुझे।",
  "home.proof_3_kicker": "FCL, पश्चिम नेपाल",
  "home.proof_3_title": "छ कन्टेनर, नेपालगन्जसम्म डोर डेलिभरी",
  "home.proof_3_copy": "भारतीय गेटवे हुँदै पश्चिम नेपालसम्मको बहु-कन्टेनर DDU मुभमेन्ट, अनलोडिङ प्रमाण र हस्ताक्षरित डेलिभरी रसिदसहित सम्पन्न।",
  "home.proof_link": "क्षेत्र र परियोजना",

  "home.credibility_title": "क्षमता र पूर्वाधार काम।",
  "home.credibility_copy": "KCPL काठमाडौँबाट काम गर्छ, विदेशमा समकक्षी एजेन्ट र नेपालका प्रवेश नाकाहरूमा भन्सार क्षमतासहित।",
  "home.credibility_award": "निर्यात उत्कृष्टता पुरस्कार",
  "home.credibility_award_detail": "ललितपुर उद्योग वाणिज्य संघ, २०२२-२०२५",
  "home.credibility_storage": "सुरक्षित भण्डारण",
  "home.credibility_storage_detail": "एयर कार्गो १,०००+ वर्गमिटर, रोड कार्गो ६,०००+ वर्गमिटर",
  "home.credibility_member": "सदस्यता",
  "home.credibility_member_detail": "CPL र NEFFA सदस्य",
  "home.credibility_projects": "पूर्वाधार",
  "home.credibility_projects_detail": "NEA प्रसारण र सबस्टेसन कामको प्रोजेक्ट ह्यान्डलिङ एजेन्ट",

  "home.cta_title": "कार्गो, रुट र मिति भन्नुहोस्।",
  "home.cta_copy": "मूल, गन्तव्य, मोड, तौल र नाप पठाउनुहोस्। मुभमेन्ट कसरी योजना गर्ने भनेर KCPL जवाफ दिन्छ।",
  "home.cta_primary": "कोटेसन माग्नुहोस्",
  "home.cta_secondary": "टोलीसँग सम्पर्क",

  /* Services */
  "services.meta_title": "फ्रेट सेवाहरू",
  "services.meta_description": "एयर, ओसन र रोड फ्रेट, भन्सार र कागजात, प्रोजेक्ट कार्गो, भण्डारण र डेलिभरी, काठमाडौँबाट नेपाली आयातकर्ता र निर्यातकर्ताका लागि समन्वय गरिन्छ।",
  "services.title": "सेवाहरू",
  "services.intro": "सात सेवा मिलेर एउटा मुभमेन्ट बन्छ। धेरैजसो शिपमेन्टमा कैयौँ सेवा सँगै चाहिन्छ, र ती एकै ठाउँबाट योजना गरिन्छ।",
  "services.detail_link": "सेवा विवरण",
  "services.covers": "यसमा के पर्छ",
  "services.ask": "हामीलाई भन्दा राम्रो",
  "services.back": "सबै सेवाहरू",
  "services.related": "प्रायः सँगै",

  "svc.air.title": "एयर फ्रेट",
  "svc.air.summary": "काठमाडौँबाट एयरपोर्ट-टु-एयरपोर्ट र डोर मुभमेन्ट, र समयसीमाले मोड तय गर्दा भित्रिने एयर कार्गो।",
  "svc.air.p1": "काठमाडौँबाट उत्तर अमेरिका, युरोप, अस्ट्रेलिया र एसियाली बजारसम्म निर्यात बुकिङ।",
  "svc.air.p2": "एयरवे बिल तयारी, कार्टिङ, प्रि-अलर्ट र आगमन फलोअप।",
  "svc.air.p3": "क्यारियर नेटवर्क अवरुद्ध हुँदा अर्को रुट, र प्राप्तकर्तालाई निरन्तर जानकारी।",
  "svc.air.ask": "ग्रस तौल, नाप, वस्तु, तयार मिति, एयरपोर्ट कि डोर डेलिभरी।",

  "svc.ocean.title": "ओसन फ्रेट",
  "svc.ocean.summary": "भारतीय गेटवे हुँदै FCL र LCL, मूल बन्दरगाहदेखि नेपालको डेलिभरी बिन्दुसम्म एउटै मुभमेन्टका रूपमा।",
  "svc.ocean.p1": "२०ft, ४०ft र ४०HQ कन्टेनर, साथै LCL कन्सोलिडेसन।",
  "svc.ocean.p2": "कोलकाता, विशाखापट्टनम र हल्दियामा गेटवे ह्यान्डलिङ, र ICD वीरगन्जसम्म रेल-जोडिएको मुभमेन्ट।",
  "svc.ocean.p3": "बिल अफ लेडिङ जाँच, इन्डोर्समेन्ट, डेलिभरी अर्डर र डि-स्टफिङ समन्वय।",
  "svc.ocean.ask": "कन्टेनर प्रकार र सङ्ख्या वा CBM, मूल बन्दरगाह, इन्कोटर्म, अन्तिम ठेगाना।",

  "svc.road.title": "रोड फ्रेट",
  "svc.road.summary": "सीमापार र आन्तरिक ट्रकिङ, जसमा नेपाल भित्रिने हरेक ओसन मुभमेन्टको भित्री खण्ड पनि पर्छ।",
  "svc.road.p1": "रक्सौल र अन्य नाका हुँदै भारतबाट नेपाल मुभमेन्ट।",
  "svc.road.p2": "वीरगन्ज र काठमाडौँबाट परियोजना साइट र पश्चिम नेपालसम्म वितरण।",
  "svc.road.p3": "सामान्य बेडमा नअट्ने कार्गोका लागि ट्रेलर र विशेष उपकरण।",
  "svc.road.ask": "तौल, नाप, उठाउने ठाउँ, पुर्‍याउने ठाउँ, दुवैतर्फको पहुँच।",

  "svc.customs.title": "भन्सार र कागजात",
  "svc.customs.summary": "नेपालका प्रवेश नाकामा कागजात तयारी र क्लियरेन्स सहयोग, र भारतीय गेटवे हुँदै जाने निर्यातका लागि पनि।",
  "svc.customs.p1": "इनभ्वाइस, प्याकिङ लिस्ट, सर्टिफिकेट अफ ओरिजिन, परमिट र छुटसम्बन्धी कागजात।",
  "svc.customs.p2": "रेल-जोडिएको र सडक मुभमेन्टका लागि ट्रान्जिट कागजात।",
  "svc.customs.p3": "दर्ता गरेर पर्खने होइन, क्लियर नभएसम्म फलोअप।",
  "svc.customs.ask": "वस्तु, थाहा भए HS कोड, मूल्य, पहिले नै लिएको लाइसेन्स वा छुट।",

  "svc.project.title": "प्रोजेक्ट र विशेष कार्गो",
  "svc.project.summary": "ब्रेकबल्क, ओपन-टप, अग्लो र ओभरसाइज युनिट, बुकिङअघि नै रुट हेरेर योजना गरिन्छ।",
  "svc.project.p1": "रुट र ट्रेलर सर्वे, ह्यान्डलिङ विधि र लिफ्टिङ आवश्यकता।",
  "svc.project.p2": "प्रसारण र सबस्टेसन उपकरण भित्री परियोजना साइटसम्म।",
  "svc.project.p3": "एकैपटक पुर्‍याउन नमिल्दा चरणबद्ध डेलिभरी, साइटमै रेकर्डसहित।",
  "svc.project.ask": "प्रति पिस नाप र तौल, कुल प्याकेज, साइट पहुँच, सम्पन्न गर्नुपर्ने मिति।",

  "svc.warehouse.title": "भण्डारण र प्याकेजिङ",
  "svc.warehouse.summary": "सुरक्षित भण्डारण व्यवस्था र कार्गो तयारी, छुट्टै सेवा होइन, मुभमेन्टकै अंश।",
  "svc.warehouse.p1": "एयर कार्गोका लागि १,०००+ वर्गमिटर र रोड कार्गोका लागि ६,०००+ वर्गमिटर।",
  "svc.warehouse.p2": "अगाडि पठाउनुअघि कन्सोलिडेसन र डिकन्सोलिडेसन।",
  "svc.warehouse.p3": "निर्यात ह्यान्डलिङका लागि प्याकिङ र तयारी।",
  "svc.warehouse.ask": "परिमाण, अवधि, कार्गोलाई ह्यान्डलिङ चाहिन्छ कि भण्डारण मात्र।",

  "svc.delivery.title": "डेलिभरी र प्रमाण",
  "svc.delivery.summary": "अन्तिम डेलिभरी समन्वय, र मुभमेन्ट साँच्चै टुङ्गियो भन्ने प्रमाण।",
  "svc.delivery.p1": "प्राप्तकर्ता र साइटसँग मिलाएर डेलिभरी तालिका।",
  "svc.delivery.p2": "अनलोडिङ प्रमाण र हस्ताक्षरित डेलिभरी रसिद।",
  "svc.delivery.p3": "मुभमेन्टभरि स्थिति अपडेट, र अन्त्यमा एउटा रेकर्ड।",
  "svc.delivery.ask": "डेलिभरी ठेगाना, साइट सम्पर्क, उपलब्ध अनलोडिङ उपकरण, बुझ्ने समय।",
};

const dictionaries: Record<SiteLocale, Record<SiteTextKey, string>> = { en, ne };

export function siteText(locale: SiteLocale, key: SiteTextKey) {
  return dictionaries[locale][key];
}

/** A bound translator, so a component reads `t("home.hero_title")`. */
export function siteTranslator(locale: SiteLocale) {
  return (key: SiteTextKey) => siteText(locale, key);
}
