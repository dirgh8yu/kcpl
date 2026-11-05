import type { GuideSlug } from "./guide-data";
import type { ServiceSlug } from "./services-data";
import { siteText } from "./site-i18n.ts";

export type ContentSource = { label: string; href: string };

export type DepthSection = {
  title: string;
  paragraphs: string[];
  points?: string[];
};

export type DepthContent = {
  sections: DepthSection[];
  sources: ContentSource[];
  movement?: { href: `/work#${"air-export" | "infrastructure" | "western-nepal"}`; label: string };
};

const tepcImports = "https://tepc.gov.np/pages/imports-transit-procedure";
const tepcExports = "https://tepc.gov.np/pages/exports-transit-procedure";
const tepcAir = "https://www.tepc.gov.np/pages/import-and-export-by-air";
const customsTariff = "https://customs.gov.np/content/50/custom-tariff-rate/";
const customsExim = "https://exim.customs.gov.np/";
const transitTreaty = "https://www.commerce.gov.in/wp-content/uploads/2023/06/MoU-Treaty-of-Trransit-dated-1-June-2023-1.pdf";
const kolkataPort = "https://smportkolkata.shipping.gov.in/smpk/en/";
const visakhapatnamPort = "https://vpt.shipping.gov.in/Template/navigateTemplate/gnt/T3VyIEJ1c2luZXNz";
const carrierTerms = "https://www.maersk.com/local-information/europe/germany/import";
const carrierExamples = "https://www.maersk.com/~/media_sc9/maersk/local-information/files/africa/south-africa/import/demurrage-tariff/south-africa-demurrage-and-detention-terms-27-nov.pdf";

export const depthReferenceCopy = {
  title: "Sources",
  intro: "General procedures can change. Check the current source and the requirements for the specific shipment before acting.",
};

export const depthMovementCopy = { title: "A related documented movement" };

const documentedMovements = {
  airExport: { href: "/work#air-export", label: siteText("en", "home.proof_2_title") },
  infrastructure: { href: "/work#infrastructure", label: siteText("en", "home.proof_1_title") },
  westernNepal: { href: "/work#western-nepal", label: siteText("en", "home.proof_3_title") },
} as const;

export const guideDepth: Record<GuideSlug, DepthContent> = {
  "importing-to-nepal": {
    movement: documentedMovements.westernNepal,
    sections: [
      {
        title: "Treat the import as one connected file",
        paragraphs: [
          "The practical starting point is a single shipment record shared across the supplier, carrier, transit handling, importer and receiving site. The commercial invoice, packing list and transport instructions should use the same consignee, package count, goods description and destination. For ocean cargo, the bill of lading and Indian transit record also need to describe the movement consistently. A correction made before departure is usually simpler than an amendment after discharge.",
          "The 2023 India–Nepal transit protocol names Kolkata, Haldia and Visakhapatnam among the permitted seaport gateways, but that does not make every gateway suitable for every shipment. The origin service, cargo restrictions, container arrangement, Nepal entry point and final delivery location all affect the choice. Confirm the actual route and current authority requirements for the shipment rather than copying a previous booking.",
        ],
        points: [
          "Before departure: confirm the importer record, commodity description, HS-code basis, permits and payment documents that may be required.",
          "Before arrival: confirm document release, delivery-order responsibility, transit filing data and the Nepal clearance file.",
          "Before inland dispatch: confirm release status, equipment, border handover and the receiving site's unloading window.",
        ],
      },
      {
        title: "Prevent the handover failures that stop cargo",
        paragraphs: [
          "Imports most often lose time at the joins: an original or electronic release is unavailable, a manifest detail does not match the commercial papers, a commodity approval is still pending, or transport reaches the consignee before the site can unload. Give each join an owner and a dated confirmation. Keep the carrier or terminal terms with the file, because container return instructions and charge clocks are contract-specific.",
          "Customs classification, valuation, permit treatment and release remain authority decisions. Use the current Nepal Customs tariff and EXIM portal when preparing the file, then have the shipment-specific position checked before cargo moves. A planning estimate is useful for budgeting, but it is not the customs assessment.",
        ],
      },
    ],
    sources: [
      { label: "Nepal TEPC — Imports Transit Procedure", href: tepcImports },
      { label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty },
      { label: "Nepal Customs — current customs tariff", href: customsTariff },
      { label: "Nepal Customs — EXIM portal", href: customsExim },
    ],
  },
  "exporting-from-nepal": {
    movement: documentedMovements.airExport,
    sections: [
      {
        title: "Agree the export before booking transport",
        paragraphs: [
          "Start with the buyer's agreed delivery term, named destination, cargo-ready date and the party responsible for clearance and final delivery. Those decisions determine the transport instruction and the destination pre-alert. They also prevent a common dispute: cargo arrives while the buyer and seller each expect the other to arrange clearance or pay a local charge.",
          "Build one export record from the commercial invoice, packing list and cargo measurements. The description, quantity, package marks, value and consignee should agree. Nepal TEPC's export-transit guidance lists core records such as the customs export declaration, invoice, packing list and certificate of origin, with additional approvals for certain goods. It is an official procedure reference, not a universal list for every commodity and destination.",
        ],
        points: [
          "For air: confirm airline acceptance, packing, export clearance, carting and destination pre-alert before tendering cargo.",
          "For ocean: confirm the Indian gateway, transit file, port handover and document-release method before the inland movement begins.",
          "For controlled goods: identify the issuing authority and secure the current approval before setting a dispatch date.",
        ],
      },
      {
        title: "Use a release gate before dispatch",
        paragraphs: [
          "Do not call cargo ready because packing is complete. A useful release gate checks that the physical packages match the packing list, export and product documents are available, transport instructions are approved, and the destination party has received the pre-alert details it needs. Dangerous, perishable, fragile and oversized cargo should be declared while the route is still being designed, because acceptance and handling vary by carrier and route.",
          "The final check is responsibility at destination: who receives notices, who clears, what proof closes the delivery, and who is contacted if a connection changes. Recording those handovers before departure makes the export easier to manage without pretending that a carrier schedule or border process can be guaranteed.",
        ],
      },
    ],
    sources: [
      { label: "Nepal TEPC — Exports Transit Procedure", href: tepcExports },
      { label: "Nepal TEPC — Import and Export by Air", href: tepcAir },
      { label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty },
    ],
  },
  "customs-clearance-in-nepal": {
    movement: documentedMovements.infrastructure,
    sections: [
      {
        title: "Build a filing-ready customs record",
        paragraphs: [
          "A clearance file has three layers. Commercial records explain the sale and the goods: invoice, packing list, buyer, seller and payment basis. Transport records explain how the same goods moved: bill of lading or air waybill, manifest data, delivery order and transit references. Conditional records explain why the goods may be imported: a licence, permit, test certificate, certificate of origin or exemption document where applicable.",
          "Read those layers against each other before filing. The goods description should be specific enough to support classification; quantities and weights should reconcile; names should match the importer and transport records; and any preferential origin or exemption claim should have supporting evidence. Nepal Customs publishes the current tariff and operates the EXIM portal, so current official information should be checked instead of relying on a code or treatment from an older shipment.",
        ],
        points: [
          "Resolve description, quantity and consignee differences before lodging the declaration.",
          "Keep technical literature available when material, function or model affects classification.",
          "Identify permit and exemption dependencies early; filing does not replace authority approval.",
        ],
      },
      {
        title: "Plan for questions, examination and correction",
        paragraphs: [
          "A customs query is easier to answer when the supporting evidence is already indexed by line item. If Customs asks about classification, origin, value or a permit, the response should point to the relevant invoice line and supporting document rather than introduce a new description. If a manifest or transport detail is wrong, use the applicable correction process and keep the amended record with the file.",
          "Classification, valuation, inspection and release are decisions of the competent authority. KCPL can review consistency and coordinate the filing and follow-up within the agreed scope, but no checklist can guarantee release. The useful promise is a controlled file: discrepancies surfaced early, questions assigned, and the delivery arranged only after the required releases are confirmed.",
        ],
      },
    ],
    sources: [
      { label: "Nepal Customs — current customs tariff", href: customsTariff },
      { label: "Nepal Customs — EXIM portal", href: customsExim },
      { label: "Nepal TEPC — Import and Export by Air", href: tepcAir },
      { label: "Nepal TEPC — Imports Transit Procedure", href: tepcImports },
    ],
  },
  "sea-freight-through-india": {
    movement: documentedMovements.westernNepal,
    sections: [
      {
        title: "Connect the seaport decision to Nepal delivery",
        paragraphs: [
          "The gateway is one decision inside a longer route. The 2023 India–Nepal transit protocol identifies Kolkata, Haldia and Visakhapatnam for Nepal transit, while the relevant port authorities describe their own facilities. For a shipment, compare the carrier's actual origin service, cargo and container acceptance, transit option, Nepal entry point, final inland destination and current operational conditions. A permitted gateway is not automatically the fastest or lowest-risk choice.",
          "After discharge, release and transit formalities must be completed before the cargo moves toward Nepal. The bill of lading, invoice, packing list, manifest and transit particulars should describe the same shipment. When a container continues inland, the plan also needs a de-stuffing location, receiving window and empty-return instruction. These are part of route design, not tasks to assign after the container reaches the border.",
        ],
        points: [
          "Origin gate: approve bill instructions and cargo data before document release.",
          "Gateway gate: confirm release, transit filing, container and seal particulars, and the onward transport order.",
          "Nepal gate: confirm customs readiness, unloading capacity, delivery evidence and empty-return responsibility.",
        ],
      },
      {
        title: "Control changes with milestone evidence",
        paragraphs: [
          "Keep a dated milestone record for document release, discharge, delivery order, transit acceptance, inland departure, border arrival, Nepal release, unloading and empty return where relevant. If a step moves, record the source of the update and the next action. This separates a carrier or authority confirmation from an estimate and helps the importer see which dependency needs attention.",
          "Port, carrier and terminal terms vary. Free time, storage, demurrage, detention, return location and start or stop events must come from the applicable booking and local terms. Do not import a number from another carrier, country or previous shipment into the current plan.",
        ],
      },
    ],
    sources: [
      { label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty },
      { label: "Nepal TEPC — Imports Transit Procedure", href: tepcImports },
      { label: "Syama Prasad Mookerjee Port, Kolkata", href: kolkataPort },
      { label: "Visakhapatnam Port Authority", href: visakhapatnamPort },
    ],
  },
  "air-freight-to-kathmandu": {
    movement: documentedMovements.airExport,
    sections: [
      {
        title: "Decide the scope before comparing air options",
        paragraphs: [
          "Air freight should be compared against the delivery need, not only the airport-to-airport rate. Confirm whether the quote must include origin collection, export formalities, terminal handling, arrival clearance and delivery from Tribhuvan International Airport. Accurate piece dimensions and gross weights are essential because airline chargeable weight is based on the applicable weight or volume rule. The quote should state the rule used rather than treating an estimate as a final airline charge.",
          "Disclose the exact commodity and handling condition at enquiry. Dangerous goods, perishables, batteries, medicines and other controlled or sensitive cargo may require specialist packing, declarations, permits or carrier approval. Acceptance is carrier-, aircraft- and route-specific. Do not tender cargo until the booking and required documentation are confirmed.",
        ],
        points: [
          "Send piece count, dimensions, gross weight, cargo-ready date, commodity and airport or door scope.",
          "Make the invoice, packing list, air waybill instruction and consignee details consistent.",
          "Send the pre-alert early enough for the importer and clearing party to prepare the arrival file.",
        ],
      },
      {
        title: "Plan arrival as a clearance and delivery handover",
        paragraphs: [
          "Nepal TEPC's air-import guidance lists the customs declaration, authority letter, air waybill, invoice and packing list among the core records, with additional documents when the commodity or regime requires them. Treat that as an official planning reference and verify the current shipment-specific requirements. Not every conditional document applies to every consignment.",
          "Airport arrival is not completion. Track the carrier notice, document availability, customs filing, any query or examination, release, collection and delivery evidence as separate milestones. If a flight or connection changes, use the carrier's current confirmation for the revised plan; the original schedule is no longer evidence of arrival.",
        ],
      },
    ],
    sources: [
      { label: "Nepal TEPC — Import and Export by Air", href: tepcAir },
      { label: "Nepal Customs — current customs tariff", href: customsTariff },
      { label: "Nepal Customs — EXIM portal", href: customsExim },
    ],
  },
  "hs-codes-and-import-duty": {
    sections: [
      {
        title: "Classify from evidence, not a product nickname",
        paragraphs: [
          "Begin with what the goods are, what they are made from, what they do, how they are presented and whether they form part of a larger machine or set. Record model numbers and include a technical sheet, catalogue or clear photograph when the invoice description cannot support those facts. A supplier's code and an earlier import are useful references, but neither is automatically the Nepal classification.",
          "Then verify the candidate line against Nepal Customs' current tariff. Tariffs change, and national tariff lines can extend beyond the shared international HS digits. Keep the tariff year and the evidence used with the estimate so someone reviewing it can see why the code was chosen and whether the source is still current.",
        ],
        points: [
          "Separate each materially different product instead of forcing a mixed invoice into one code.",
          "Check whether origin evidence, a permit, an exemption or another levy changes the treatment.",
          "Escalate an uncertain or high-impact classification before shipping, when correction is still practical.",
        ],
      },
      {
        title: "Keep a duty estimate visibly provisional",
        paragraphs: [
          "An estimate needs more than a percentage. Record the candidate HS line, value basis, currency and exchange-rate source, freight and insurance inputs, origin basis, any claimed preference or exemption, and the taxes or levies included. If one input is unknown, show it as an assumption instead of hiding it inside a total.",
          "The Customs assessment is the amount that governs the shipment. Customs may reach a different classification or value, ask for evidence, or reject a claimed preference or exemption. Use the estimate for planning and comparison, then update it when the official assessment or a corrected input becomes available. Never reuse a rate simply because the product name looks similar.",
        ],
      },
    ],
    sources: [
      { label: "Nepal Customs — current customs tariff", href: customsTariff },
      { label: "Nepal Customs — EXIM portal", href: customsExim },
    ],
  },
  "free-time-and-demurrage": {
    sections: [
      {
        title: "Read the applicable terms before starting the clock",
        paragraphs: [
          "Free time and the related charges are defined by the applicable carrier, terminal, location, container type and commercial agreement. Carrier examples commonly distinguish demurrage for a full container held within a port, terminal or depot from detention while equipment is outside, but combined terms and event definitions also exist. Terminal storage may be separate. The current booking and local tariff control, not a generic definition.",
          "Create a charge register from the actual terms. Record the named charge, free-time allowance, start event, end event, return location, rate steps, responsible party and evidence source. Link each event to a dated notice, gate record, release or return receipt. That makes a later invoice review possible and prevents teams from debating dates from memory.",
        ],
        points: [
          "Before arrival: secure document release, permits, funds, transit data and clearance instructions.",
          "Before collection: confirm customs and terminal release, equipment and the consignee's unloading window.",
          "Before empty return: confirm the accepted depot, opening conditions and the document that proves return.",
        ],
      },
      {
        title: "Manage causes, not only the final invoice",
        paragraphs: [
          "A landlocked movement adds dependencies between discharge and empty return: port release, Indian transit, border handover, Nepal clearance, inland delivery, unloading and the return journey. Assign an owner and escalation point to each dependency. If a permit, document discrepancy or site-access problem threatens the plan, surface it while an alternative can still be arranged.",
          "No process can promise that charges will never occur. Weather, congestion, inspections, carrier changes and authority decisions can affect a movement. The prevention test is whether the controllable steps were ready and evidenced. The invoice-review test is whether the billed clock and events match the applicable terms and the shipment record, not a free-day figure from another booking.",
        ],
      },
    ],
    sources: [
      { label: "Carrier example — demurrage and detention definitions", href: carrierTerms },
      { label: "Carrier example — operational counting events", href: carrierExamples },
    ],
  },
};

export const serviceDepth: Record<ServiceSlug, DepthContent> = {
  "air-freight": {
    movement: documentedMovements.airExport,
    sections: [{
      title: "What a workable air-freight plan contains",
      paragraphs: [
        "The first decision is scope: airport-to-airport, airport-to-door or a wider movement including collection and export formalities. Send the commodity, piece count, dimensions, gross weight, cargo-ready date and destination, then flag dangerous, perishable, battery, medical or other controlled cargo. Carrier acceptance and documentation vary by cargo, aircraft and route, so suitability is confirmed for the proposed booking rather than assumed from a previous shipment.",
        "Before tender, align the invoice, packing list, air waybill instruction and consignee details. The operating sequence is booking confirmation, export readiness, carting or terminal handover, pre-alert, arrival notice, destination clearance and delivery where included. A changed connection should be communicated from the carrier's current confirmation, with the revised handover and next action recorded.",
      ],
      points: [
        "Choose air because the delivery need justifies it, then compare the complete scope and chargeable-weight basis.",
        "Do not tender conditional cargo until packing, declaration, permit and carrier requirements are confirmed.",
        "Treat airport arrival and consignee delivery as different milestones when the scope includes both.",
      ],
    }],
    sources: [{ label: "Nepal TEPC — Import and Export by Air", href: tepcAir }],
  },
  "ocean-freight": {
    movement: documentedMovements.westernNepal,
    sections: [{
      title: "Plan the container, gateway and inland leg together",
      paragraphs: [
        "FCL and LCL should be compared using the actual volume, weight, packing, handling sensitivity, origin charges, gateway arrangement and final Nepal delivery point. The India–Nepal transit protocol identifies Kolkata, Haldia and Visakhapatnam for Nepal transit, but a permitted port is not automatically the right gateway. Confirm the carrier service and current inland route for the shipment.",
        "Before bill release, check the consignee, goods description, package details, container and seal data, and transit destination against the commercial file. The operating plan should cover release, port handling, transit filing, rail-linked or road movement, Nepal clearance, de-stuffing or delivery and empty return where applicable. Carrier and terminal free time, storage, demurrage and detention come from the applicable terms, never from a generic estimate.",
      ],
      points: [
        "Make document approval a milestone before release, not an amendment task after arrival.",
        "Name who owns each handover from origin agent to gateway, border, clearing party and receiving site.",
        "Keep the empty-return instruction with the booking when carrier equipment travels inland.",
      ],
    }],
    sources: [
      { label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty },
      { label: "Nepal TEPC — Imports Transit Procedure", href: tepcImports },
      { label: "Carrier example — demurrage and detention definitions", href: carrierTerms },
    ],
  },
  "road-freight": {
    movement: documentedMovements.westernNepal,
    sections: [{
      title: "Scope the road movement before selecting equipment",
      paragraphs: [
        "A road quote needs piece-level dimensions and weights, commodity, loading method, collection and delivery addresses, access limits, unloading equipment and the receiving window. Standard cargo can still fail at a narrow approach or an unprepared site. Oversized or heavy pieces need a separate route, clearance, trailer and handling review before feasibility is confirmed.",
        "For cross-border cargo, plan the India leg, transit or customs requirements, border handover and Nepal leg as connected milestones. The India–Nepal transit protocol permits specified routes and transport forms, but route eligibility, seals, sensitive-goods controls and current authority requirements are shipment-specific. Dispatch only after the documents, equipment, border contact and receiving site are ready.",
        "If the route, cargo profile or site conditions change after quoting, pause and recheck the equipment and handover plan before dispatch. A price based on the earlier facts is not confirmation that the revised movement remains workable.",
      ],
      points: [
        "Record vehicle and cargo checks at dispatch, then preserve trip and handover references.",
        "At the border, confirm the next carrier, authority status and custody transfer instead of relying on an estimated arrival.",
        "Close the movement with a signed receipt or recorded exception linked to the correct packages.",
      ],
    }],
    sources: [{ label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty }],
  },
  "customs-clearance": {
    movement: documentedMovements.infrastructure,
    sections: [{
      title: "What customs and document support can control",
      paragraphs: [
        "The controllable work is a consistent, filing-ready record. Commercial documents explain the sale and goods; transport documents explain the movement; conditional documents support permits, origin, exemptions or product controls where applicable. Review names, descriptions, quantities, values and references across those groups before filing. Use Nepal Customs' current tariff and EXIM portal rather than a past shipment as the only source.",
        "KCPL can coordinate document review, filing inputs, authority queries, amendments and release follow-up within the agreed scope. Classification, valuation, permit eligibility, inspection and release remain decisions of the relevant authority. If a discrepancy appears, record it, identify the document owner and use the applicable correction or approval process before arranging the next handover.",
      ],
      points: [
        "Send the commodity description, transport record, invoice, packing list and any permit or exemption evidence early.",
        "Support technical classifications with material, function, model and product literature.",
        "Treat every document checklist as shipment-specific; commodity, route and current rules can add requirements.",
      ],
    }],
    sources: [
      { label: "Nepal Customs — current customs tariff", href: customsTariff },
      { label: "Nepal Customs — EXIM portal", href: customsExim },
      { label: "Nepal TEPC — Imports Transit Procedure", href: tepcImports },
    ],
  },
  "project-cargo": {
    movement: documentedMovements.infrastructure,
    sections: [{
      title: "Design the method from the largest piece and the site",
      paragraphs: [
        "Start with a piece register, not only a total weight. Record dimensions, gross weight, centre of gravity and lifting points where known, packing or drawings, origin handling, border and route constraints, site access, unloading equipment and the required delivery sequence. Unknown data should remain an open action; it should not be replaced with a standard-equipment assumption.",
        "The method then connects route and site review, equipment selection, lifting, permits or authority controls, customs and border dependencies, dispatch sequence and delivery evidence. The India–Nepal transit framework supports specified transit routes and transport forms, while route eligibility and sensitive-goods controls remain shipment-specific. Feasibility is confirmed only after the relevant route, cargo and authority checks.",
      ],
      points: [
        "Release pieces in the order the site can receive, store and install them.",
        "Record every custody transfer and any exception against the piece register.",
        "Use phase-specific delivery reports and signed receipts; never infer completion from gateway dispatch alone.",
      ],
    }],
    sources: [{ label: "Government of India — 2023 Treaty of Transit protocol", href: transitTreaty }],
  },
  warehousing: {
    sections: [{
      title: "Make storage part of a controlled freight movement",
      paragraphs: [
        "KCPL's storage is more than 1,000 square metres for air cargo and more than 6,000 square metres for road cargo. For a particular consignment, confirm the cargo type, dimensions or volume, expected duration, handling and packaging needs, release authority and onward dispatch plan. Additional or specialist arrangements are checked for the shipment rather than assumed from the standing footprint.",
        "At intake, record consignment references, package count and visible condition. Keep release instructions tied to an authorised contact, and reconcile the picked packages against the dispatch record before loading. Packaging should be selected for the cargo, handling method and onward mode, with weights and dimensions updated if repacking changes them. Cooler arrangements require review; KCPL does not claim temperature-controlled life-science storage.",
        "The storage plan should also name the next movement and the decision that releases it. An expected date is useful for capacity planning, but cargo should leave against the recorded release and dispatch checks, not an informal assumption.",
      ],
      points: [
        "Separate cargo that is awaiting clearance, awaiting instruction and ready for dispatch in the movement record.",
        "Photographs can support a condition record but do not replace counts, references or signed handovers.",
        "Close storage only when dispatch and the receiving movement reconcile to the released packages.",
      ],
    }],
    sources: [],
  },
  delivery: {
    movement: documentedMovements.westernNepal,
    sections: [{
      title: "Define completion before the vehicle leaves",
      paragraphs: [
        "Final delivery starts with receiving readiness: the correct address and site contact, access and vehicle restrictions, receiving hours, unloading equipment, package sequence and the person authorised to sign. For phased or multi-container movements, define which pieces belong to each drop. That keeps one receipt from being mistaken for completion of the whole consignment.",
        "During delivery, record dispatch, arrival, unloading and handover against the shipment references. If cargo is short, damaged, refused or only partly accepted, capture the exception at the time, identify the affected packages and name the next action. Photographs may support the record, but the agreed signed or electronic proof and any exception note are what show the consignee's response.",
        "Before departure, agree who must receive the close-out record and what the proof should contain. This avoids a completed physical handover remaining open because the document went to the wrong party or omitted the shipment reference.",
      ],
      points: [
        "Send the receiving party a practical pre-arrival notice and confirm changes rather than relying on the original plan.",
        "Circulate proof only after it has been matched to the delivery, packages and recipient.",
        "Close the file when all planned drops are evidenced or every remaining exception has an owner and status.",
      ],
    }],
    sources: [],
  },
};
