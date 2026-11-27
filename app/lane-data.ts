import type { ToolSlug } from "./tool-data.ts";
import type { SiteLocale } from "./site-i18n.ts";
import { laneCopyOther } from "./lane-copy.ts";

/* Lane pages answer a corridor query — "Kolkata to Birgunj transport" — rather
 * than an origin query. They exist in all four languages since 2026-11-27; the
 * English lives here and the other three in lane-copy.ts, so a translator edits
 * one file and the corridor metadata stays untouched.
 *
 * Two rules held while writing this:
 *  - A transit range appears only where the operations side confirmed one. The
 *    Kolkata and Birgunj legs carry no published number because KCPL quotes the
 *    range with the shipment; the northern leg carries the 14–21 day range
 *    KCPL gave on 2026-11-27, with the date it was confirmed.
 *  - Nothing here promises a clearance date, a free-time allowance or a rate.
 */

export const laneSlugs = ["kolkata-to-birgunj", "haldia-to-kathmandu", "nepal-to-tibet"] as const;
export type LaneSlug = (typeof laneSlugs)[number];

/** The prose of one lane page. Translated as a unit; facts must not drift. */
export type LaneCopy = {
  title: string;
  description: string;
  intro: string;
  questionsTitle: string;
  otherTitle: string;
  /** The quote button on the page. */
  cta: string;
  /** Sits before the confirmation date, so the date can be formatted per locale. */
  confirmedPrefix: string;
  sections: { title: string; copy: string; list?: string[] }[];
  questions: { question: string; answer: string }[];
};

export type Lane = LaneCopy & {
  slug: LaneSlug;
  /** The date the corridor facts were last confirmed by the operations side. */
  confirmed: string;
  service: string;
  tool: ToolSlug;
  next: LaneSlug[];
};

export type LaneIndexCopy = {
  title: string;
  description: string;
  intro: string;
  corridorsTitle: string;
  readingTitle: string;
  /** Section heading used where another page links to the lane set. */
  lanesTitle: string;
};

/** Everything that is not prose, shared by every language. */
const laneMeta: Record<LaneSlug, Omit<Lane, keyof LaneCopy | "slug">> = {
  "kolkata-to-birgunj": {
    confirmed: "2026-11-27",
    service: "/services/customs-clearance",
    tool: "storage-charges",
    next: ["haldia-to-kathmandu", "nepal-to-tibet"],
  },
  "haldia-to-kathmandu": {
    confirmed: "2026-11-27",
    service: "/services/ocean-freight",
    tool: "storage-charges",
    next: ["kolkata-to-birgunj", "nepal-to-tibet"],
  },
  "nepal-to-tibet": {
    confirmed: "2026-11-27",
    service: "/services/road-freight",
    tool: "volume-weight",
    next: ["kolkata-to-birgunj", "haldia-to-kathmandu"],
  },
};

const laneCopyEn: Record<LaneSlug, LaneCopy> = {
  "kolkata-to-birgunj": {
    title: "Kolkata to Birgunj transport",
    description: "How a container reaches Birgunj from Kolkata: port release, rail to the ICD or road across Raxaul, Nepal customs at Birgunj, and delivery to the door.",
    intro: "A container from Kolkata reaches Birgunj by rail to the inland container depot or by road across Raxaul, then clears Nepal customs at the ICD. Four stages decide the transit, and three of them begin before the container arrives.",
    questionsTitle: "Common questions",
    otherTitle: "Other lanes",
    cta: "Send the cargo, route and date",
    confirmedPrefix: "Corridor details confirmed with KCPL operations on",
    sections: [
      {
        title: "Release at Kolkata",
        copy: "The bill of lading is surrendered, the delivery order is issued, and the container is either put on a train toward Birgunj or trucked to Raxaul. Third-country cargo moving under transit is a different file from goods bought in India, and the transit file has to be followed across India, not only at the two ends. KCPL's own staff work in Kolkata, so the release is chased on the ground.",
      },
      {
        title: "Rail to the ICD, or road across Raxaul",
        copy: "Full containers usually travel by rail to ICD Birgunj. Road across Raxaul suits part loads, smaller consignments and cargo that cannot wait for the next rail allotment. Rail space is allocated week by week, and that allocation moves the arrival date more than distance does, which is why the transit is quoted with the shipment instead of printed here.",
      },
      {
        title: "Clearance at ICD Birgunj",
        copy: "Declaration, assessment, duty and VAT, examination if customs selects the consignment, then release. Free time at the terminal depends on the shipping line and the container type, and it is confirmed for each booking before the container moves. Whatever runs past free time is billed to the party holding the box, so the clock is worth watching from the release date.",
        list: [
          "Invoice and packing list that agree line by line",
          "HS code for each line, settled before the declaration",
          "Letter of authority for the clearing agent",
          "Duty and VAT ready to pay on assessment",
        ],
      },
      {
        title: "Delivery, and the empty back",
        copy: "Delivery is booked against release and the receiving site's unloading capacity. The file closes with an unloading record and a signed receipt. The empty container returns inside its own window, which starts when the container leaves the terminal and runs separately from the clock that started at the port.",
      },
    ],
    questions: [
      {
        question: "How long does Kolkata to Birgunj take?",
        answer: "We quote the transit with the shipment rather than publishing a fixed figure. It moves with the week's rail allocation, the release date and the queue at the ICD, so a number printed on a page would be wrong more often than right.",
      },
      {
        question: "Who clears the container at Birgunj?",
        answer: "A licensed clearing agent acts on your letter of authority, and KCPL's staff follow the file at the ICD from declaration to release.",
      },
      {
        question: "What does free time cover?",
        answer: "Free time is the period before demurrage, detention or storage starts. The shipping line and the terminal set it, and it is confirmed per booking.",
      },
    ],
  },

  "haldia-to-kathmandu": {
    title: "Haldia to Kathmandu cargo",
    description: "Haldia and Kolkata as gateways for a Kathmandu delivery: which cargo suits Haldia, the inland leg to Birgunj, clearance at the ICD, then delivery.",
    intro: "Haldia and Kolkata both serve Nepal, and the port is chosen by the cargo, the sailing and the inland leg. From either one, the container moves by rail or road toward Birgunj and then up to Kathmandu.",
    questionsTitle: "Common questions",
    otherTitle: "Other lanes",
    cta: "Send the cargo, route and date",
    confirmedPrefix: "Corridor details confirmed with KCPL operations on",
    sections: [
      {
        title: "Which port fits the cargo",
        copy: "Haldia sits downstream of Kolkata with deeper water, so it takes vessels and parcels that the Kolkata berths handle awkwardly: bulk, heavy and non-containerised cargo. Kolkata carries most of the container sailings and gives the shorter first leg toward Birgunj. Both are in use for Nepal cargo, and the choice is made per shipment rather than by habit.",
      },
      {
        title: "Haldia to Birgunj",
        copy: "Rail to ICD Birgunj, or road from the port. The transit is quoted with the shipment for the same reason as the Kolkata leg: rail allocation, the release date and the ICD queue decide it, and none of the three is fixed in advance.",
      },
      {
        title: "Birgunj to Kathmandu",
        copy: "Road delivery against release and the site's unloading capacity. Where a unit needs a route survey, permits or an escort, that work starts before the vessel berths, because a permit arranged after discharge delays the whole file.",
      },
      {
        title: "Bulk, heavy and out of gauge",
        copy: "Discharge method, rail or road equipment and site access are planned together for cargo a container cannot hold. That planning is the project cargo service, and it begins with the dimensions of the largest piece.",
        list: [
          "Dimensions and weight per piece, with lifting points",
          "Route and site access checked before booking",
          "Permits and escort requirements, with their lead time",
        ],
      },
    ],
    questions: [
      {
        question: "Is Haldia cheaper than Kolkata?",
        answer: "When the cargo allows a choice, both are quoted on the same terms. A lower ocean freight at Haldia does not always give the lower delivered cost once the inland leg and the clearance time are counted.",
      },
      {
        question: "Can containers discharge at Haldia?",
        answer: "Yes. The question worth asking is which port gives the shorter or more reliable inland leg for the cargo in hand.",
      },
      {
        question: "Which gateway reaches Kathmandu faster?",
        answer: "Transit is quoted per shipment. Rail allocation and clearance time move the arrival date more than the choice between these two ports does.",
      },
    ],
  },

  "nepal-to-tibet": {
    title: "Nepal to Tibet cargo",
    description: "Exports from Nepal to Tibet over Tatopani–Zhangmu and Kerung–Rasuwagadhi: the transit range, export documents, the consignee's role, and delays.",
    intro: "Exports from Nepal to China cross the same two Himalayan crossings that carry imports the other way. Allow 14 to 21 days between Kathmandu and Lhasa, depending on the season and the crossing.",
    questionsTitle: "Common questions",
    otherTitle: "Other lanes",
    cta: "Send the cargo, route and date",
    confirmedPrefix: "Corridor details confirmed with KCPL operations on",
    sections: [
      {
        title: "Which crossing",
        copy: "Tatopani–Zhangmu and Kerung–Rasuwagadhi carry the trade. Both have closed for long periods after floods and landslides, so the crossing's status is confirmed for each shipment before the truck is loaded. KCPL runs northbound cargo on this corridor regularly.",
      },
      {
        title: "How long it takes",
        copy: "Allow 14 to 21 days between Kathmandu and Lhasa, depending on the season and which crossing is open. Winter conditions and the monsoon both move the range, and a closure can move it further. The range was confirmed with the operations team on 27 November 2026.",
      },
      {
        title: "Export documents",
        copy: "The file is prepared before the truck loads, because a document corrected at the border costs days rather than hours.",
        list: [
          "Export declaration, filed by the clearing agent on your authority",
          "Commercial invoice and packing list that agree line by line",
          "HS code for each line, settled before the declaration",
          "Certificate of origin, where the commodity or the buyer requires it",
          "Road consignment note for the northern leg",
        ],
      },
      {
        title: "What the Chinese consignee has to do",
        copy: "The consignee clears the goods on the Chinese side and holds the import documentation. A forwarder in Nepal cannot file for the consignee, so when a buyer is new to importing, that responsibility is agreed before the truck leaves. This is the step where northern exports most often wait.",
      },
    ],
    questions: [
      {
        question: "Can Nepal export to China by road?",
        answer: "Yes, over Tatopani–Zhangmu or Kerung–Rasuwagadhi, with the crossing confirmed before loading.",
      },
      {
        question: "How long does Kathmandu to Lhasa take?",
        answer: "14 to 21 days, depending on the season and the crossing. That range was confirmed in November 2026 and is worth rechecking before a peak-season booking.",
      },
      {
        question: "What does the Chinese side need?",
        answer: "The consignee's import declaration and the commodity paperwork the goods require. KCPL prepares the Nepal-side file; the Chinese import filing stays with the consignee or their agent.",
      },
    ],
  },
};

export const laneCopy: Record<SiteLocale, Record<LaneSlug, LaneCopy>> = {
  en: laneCopyEn,
  ne: laneCopyOther.ne,
  hi: laneCopyOther.hi,
  zh: laneCopyOther.zh,
};

export function laneFor(locale: SiteLocale, slug: LaneSlug): Lane {
  return { ...laneCopy[locale][slug], slug, ...laneMeta[slug] };
}

export const laneIndex: Record<SiteLocale, LaneIndexCopy> = {
  en: {
    title: "Nepal freight lanes",
    description: "The corridors KCPL moves freight on every month: Kolkata and Haldia through Birgunj, the northern crossings to Tibet, and India's land border points.",
    intro: "Each page follows one corridor from the gateway to delivery, names the documents at every handover, and says which part of the transit KCPL controls and which part it does not.",
    corridorsTitle: "Corridors",
    readingTitle: "Related reading",
    lanesTitle: "Lane pages",
  },
  ne: {
    title: "नेपाल ढुवानी मार्गहरू",
    description: "KCPL ले महिनैपिच्छे चलाउने मार्गहरू: वीरगन्ज हुँदै कोलकाता र हल्दिया, तिब्बततर्फका उत्तरी नाका, र भारतका स्थल सीमा नाका। हरेक पृष्ठमा कागजात र डेलिभरी।",
    intro: "हरेक पृष्ठले एउटा मार्गलाई गेटवेबाट डेलिभरीसम्म देखाउँछ, हरेक हस्तान्तरणमा चाहिने कागजात बताउँछ, र कुन भाग KCPL ले नियन्त्रण गर्छ र कुन गर्दैन भन्ने पनि।",
    corridorsTitle: "मार्गहरू",
    readingTitle: "सम्बन्धित सामग्री",
    lanesTitle: "मार्ग पृष्ठहरू",
  },
  hi: {
    title: "नेपाल माल ढुलाई मार्ग",
    description: "वे मार्ग जिन पर KCPL हर महीने माल ढुलाई करता है: बीरगंज के रास्ते कोलकाता और हल्दिया, तिब्बत के उत्तरी नाके, और भारत के स्थल नाके। हर पृष्ठ पर दस्तावेज़।",
    intro: "हर पृष्ठ एक मार्ग को गेटवे से डिलीवरी तक दिखाता है, हर हैंडओवर पर दस्तावेज़ बताता है, और यह भी कि पारगमन का कौन सा हिस्सा KCPL नियंत्रित करता है और कौन सा नहीं।",
    corridorsTitle: "मार्ग",
    readingTitle: "संबंधित पठन",
    lanesTitle: "मार्ग पृष्ठ",
  },
  zh: {
    title: "尼泊尔货运路线",
    description: "KCPL 每月实际承运的路线：经比尔根杰的加尔各答与哈尔迪亚、通往西藏的北向口岸，以及印度陆路边境点。",
    intro: "每个页面沿着一条路线从口岸写到交付，标明每一次交接所需的单据，并说明哪些环节由 KCPL 控制、哪些不由 KCPL 控制。",
    corridorsTitle: "路线",
    readingTitle: "相关阅读",
    lanesTitle: "路线页面",
  },
};

export function lanesFor(locale: SiteLocale): Lane[] {
  return laneSlugs.map((slug) => laneFor(locale, slug));
}
