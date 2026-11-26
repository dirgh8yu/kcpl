import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const costPosts: readonly BlogPost[] = [
  {
    slug: "incoterms-for-nepal-buyers",
    topic: "costs",
    title: "Incoterms for Nepal buyers: where delivered really ends",
    description: "Incoterms decide who pays and who carries the risk at each step. Why delivered terms often end at the border for Nepal, and how to write the right place.",
    intro: "Every purchase order names an Incoterm. For a Nepal import, the term and the place written after it decide where the seller's job ends and yours begins.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Three letters and a place name settle who pays for most of the journey.",
    sections: [
      {
        title: "What an Incoterm does",
        blocks: [
          { type: "p", text: "Incoterms are standard trade terms published by the International Chamber of Commerce. Each one says who arranges and pays for transport, who clears customs at each end, and where the risk of loss passes from seller to buyer. They do not say who owns the goods, or when payment is due. That belongs to the contract." },
        ],
      },
      {
        title: "The ones Nepal buyers meet most",
        blocks: [
          { type: "steps", items: [
            { title: "EXW", copy: "The seller makes the goods available at its premises. The buyer does everything else, including export clearance in the seller's country, which can be hard to do from Nepal." },
            { title: "FCA", copy: "The seller hands the goods to the buyer's carrier at a named place, cleared for export. Often the cleanest choice for containers and air cargo." },
            { title: "FOB", copy: "For sea only. The seller loads the goods on the buyer's ship at the named port. Risk passes once they are on board." },
            { title: "CFR and CIF", copy: "The seller pays the sea freight to the named port, and under CIF also buys minimum insurance. Risk still passes at loading in the origin country." },
            { title: "DAP", copy: "The seller delivers to a named place, ready for unloading. The buyer clears import customs and pays the duty." },
          ] },
        ],
      },
      {
        title: "Where delivered really ends",
        blocks: [
          { type: "p", text: "Sellers abroad often quote delivered terms to a place they know, such as an Indian port or the Nepal border, rather than your door in Kathmandu. CIF Kolkata leaves you to pay the port, the transit and everything after. DAP Birgunj ends at the border, before Nepal customs. Read the place, not just the term." },
          { type: "p", text: "Older contracts sometimes still use DDU, which was replaced years ago. If you see it, ask the seller to restate the term in current wording and name the exact place." },
        ],
      },
      {
        title: "Choosing",
        blocks: [
          { type: "list", items: [
            "Buy FCA or FOB if you want to choose the line, the gateway and the forwarder yourself",
            "Buy CIF or CFR only if you are happy with the seller's choice of carrier and port",
            "Name the place precisely: a port, a dry port, an address",
            "Make sure the insurance covers the whole journey, not just the sea leg",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Which Incoterms version should I use?", answer: "Name the version in the contract, such as Incoterms 2020, so both sides read the term the same way." },
      { question: "Do Incoterms decide when I pay?", answer: "No. Payment terms are separate and belong in the sales contract or letter of credit." },
      { question: "Can a term be modified?", answer: "Parties can add wording, but changes should be clear and written, because they can shift costs and risk in unexpected ways." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "exw-fob-or-cif",
    topic: "costs",
    title: "EXW, FOB or CIF: which to buy on for a Nepal import",
    description: "The three terms Nepal importers are most often offered, compared on cost, control and risk, with the hidden costs each one leaves for the buyer to pay.",
    intro: "Suppliers usually offer one of three prices: ex works, FOB or CIF. The cheapest looking one is not always the cheapest once the cargo is in Nepal.",
    published,
    cover: "ship-terminal",
    coverCaption: "Under FOB and CIF, the risk passes as the goods go on board at origin.",
    sections: [
      {
        title: "Ex works",
        blocks: [
          { type: "p", text: "The lowest price on paper. The buyer collects from the factory and handles everything: loading, export clearance in the supplier's country, freight, insurance and import. For a Nepal buyer, export clearance abroad is the problem. You need someone in the supplier's country who can do it in your name. FCA, where the supplier clears for export and hands over to your carrier, usually works better." },
        ],
      },
      {
        title: "FOB",
        blocks: [
          { type: "p", text: "The supplier clears for export and loads the goods on the ship you or your forwarder book. You choose the line, the routing and the Indian gateway, and you control the bill of lading. You pay the freight and insurance, which you can buy at competitive rates. For many Nepal importers, this gives the best mix of cost and control." },
        ],
      },
      {
        title: "CIF",
        blocks: [
          { type: "p", text: "The supplier books and pays the ship to a named port, often Kolkata or Visakhapatnam, and buys minimum insurance. It looks convenient. But the supplier chooses the line, and the line's destination charges at the Indian port fall to you. Some sailings that look cheap at origin carry high charges at destination. The minimum insurance may not cover the inland leg to Nepal at all." },
          { type: "p", text: "Under CIF, the risk passes to you when the goods are loaded at origin, even though the seller is paying the freight. If the cargo is damaged at sea, it is your claim to make, under the seller's insurance." },
        ],
      },
      {
        title: "Compare like with like",
        blocks: [
          { type: "list", items: [
            "Ask for FOB and CIF prices, and get a freight quote for the FOB option",
            "Add the destination charges at the Indian port, the transit and the Nepal side to both",
            "Check what the CIF insurance covers and to where",
            "Compare the totals delivered to your warehouse, not the supplier's prices",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Is FCA better than FOB for containers?", answer: "Often, because the seller hands over the container to the carrier at a terminal or depot, which matches how containers really move. FOB assumes loading on board." },
      { question: "Can I buy CIF but use my own forwarder at destination?", answer: "Yes. The seller handles the main carriage; you appoint your forwarder for the Indian port onwards." },
      { question: "Does the term change customs duty?", answer: "The term changes what costs are in the price, which affects how customs builds the value. The duty rate depends on the goods." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "can-a-seller-ship-ddp-to-nepal",
    topic: "costs",
    title: "Can a seller ship DDP to Nepal?",
    description: "Delivered duty paid looks simple: the seller handles everything. Why DDP is hard for a foreign seller to deliver into Nepal, and what usually works better.",
    intro: "Under DDP, the seller delivers to your door with duties paid. It sounds like the easiest way to buy. Into Nepal, it is often the hardest term for a foreign seller to keep.",
    published,
    cover: "container-plate",
    coverCaption: "Someone has to be the importer of record in Nepal.",
    sections: [
      {
        title: "What DDP asks of the seller",
        blocks: [
          { type: "p", text: "Under Delivered Duty Paid, the seller arranges and pays for everything: export, freight, import clearance, duties and taxes, and delivery to the named place. That means the seller must act as the importer in the buyer's country, or appoint someone who can." },
        ],
      },
      {
        title: "Why it is hard into Nepal",
        blocks: [
          { type: "list", items: [
            "Imports into Nepal are declared by a registered trader, and a foreign seller usually is not one",
            "Duty and VAT must be paid in Nepal, in Nepali rupees",
            "VAT paid at import is normally reclaimable only by a registered Nepal business",
            "Permits and licences for regulated goods are issued to the importer, not the seller",
          ] },
          { type: "p", text: "In practice, many DDP offers into Nepal are really delivered to the border, with the Nepal side left to the buyer, or they rely on a third party acting as importer, which can cause problems later with tax records and ownership." },
        ],
      },
      {
        title: "What usually works better",
        blocks: [
          { type: "p", text: "DAP to your warehouse, with you as the importer, keeps the seller responsible for the journey while you handle the Nepal customs clearance and pay the duty in your own name. You keep the import records for your accounts, and you can reclaim VAT where you are entitled to." },
          { type: "p", text: "If a seller insists on DDP, ask exactly who will be the importer in Nepal, whose name will be on the customs declaration, and who will hold the VAT receipt. If the answers are vague, the term is too." },
        ],
      },
    ],
    questions: [
      { question: "Can a foreign seller register in Nepal to import?", answer: "Registering a business presence involves legal and tax steps that most foreign sellers do not take for a few shipments." },
      { question: "Is DDP ever used for Nepal?", answer: "Sometimes, with a Nepal partner acting as importer. Clarify the arrangements before agreeing." },
      { question: "What about courier DDP?", answer: "Some couriers offer duty-paid services for parcels. For commercial cargo, the usual import rules apply." },
    ],
    related: { service: service.customs, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "demurrage-detention-and-storage",
    topic: "costs",
    title: "Demurrage, detention and storage: three clocks",
    description: "Three charges can run while a Nepal import waits: demurrage, detention and storage. What each one is, who bills it, and how to stop the clocks early.",
    intro: "While a container waits, up to three clocks can be running. They belong to different companies and are billed separately, which is why waiting costs more than people expect.",
    published,
    cover: "container-yard",
    coverCaption: "A full container waiting at a terminal can run more than one charge at once.",
    sections: [
      {
        title: "The three clocks",
        blocks: [
          { type: "steps", items: [
            { title: "Demurrage", copy: "Charged by the shipping line when its full container stays in the port or terminal beyond the free days." },
            { title: "Detention", copy: "Charged by the line when its container is kept outside the terminal, full or empty, beyond the free days, until the empty is returned." },
            { title: "Storage", copy: "Charged by the port, terminal or dry port for the space the cargo occupies beyond its free period." },
          ] },
          { type: "p", text: "Some lines combine demurrage and detention into one allowance. Others count them separately. Your booking confirmation or the line's tariff says which." },
        ],
      },
      {
        title: "Where they bite on a Nepal import",
        blocks: [
          { type: "p", text: "A Nepal import passes through an Indian port, a transit leg and a dry port before it reaches you. Free days that sound generous at the start can be used up at the gateway by a late release or a manifest problem, leaving the container on detention before it even reaches Birgunj." },
          { type: "p", text: "In September 2026, floods and landslides stranded import and export trucks and containers on Nepal's highways and at border points, long past their free time. Charges built up for days that nobody could have moved the cargo." },
        ],
      },
      {
        title: "Stopping the clocks",
        blocks: [
          { type: "list", items: [
            "Ask for extra free days when the booking is made, before the cargo sails",
            "Get the bill of lading released and the delivery order issued before arrival",
            "Have Nepal customs papers and payment ready before the container reaches Birgunj",
            "Unload at the dry port if your warehouse cannot receive quickly, and return the empty",
            "Keep the empty return receipt, and check the line's invoice against it",
          ] },
          { type: "p", text: "Our storage charges tool estimates how quickly the days add up. It uses the free days and daily rates you enter, so check them against your line's actual terms." },
        ],
      },
    ],
    questions: [
      { question: "Can free days be extended after arrival?", answer: "Sometimes, at the line's discretion, and usually at a cost. Asking at booking is easier and cheaper." },
      { question: "Are charges paused during holidays?", answer: "Usually not. Free days and charges often run through holidays unless the contract says otherwise." },
      { question: "Can I dispute detention charges?", answer: "Yes, with evidence: dates of release, return receipts and records of any refusal by the depot." },
    ],
    related: { service: service.ocean, guides: ["free-time-and-demurrage"], tool: "storage-charges" },
  },
  {
    slug: "estimating-duty-and-vat",
    topic: "costs",
    title: "Estimating Nepal import duty and VAT before you buy",
    description: "How to estimate the duty and VAT on a Nepal import before you order: the customs value, the HS code rate, VAT on top, and why the figure stays provisional.",
    intro: "The duty and VAT on an import can be a large share of what it costs. You can estimate them before you buy, as long as you treat the estimate as an estimate.",
    published,
    cover: "tariff-ledger",
    coverCaption: "The tariff rate comes from the HS code, so the estimate is only as good as the classification.",
    sections: [
      {
        title: "The building blocks",
        blocks: [
          { type: "steps", items: [
            { title: "The customs value", copy: "Usually the price paid for the goods, plus the cost of getting them to the Nepal customs point, such as freight and insurance." },
            { title: "The duty rate", copy: "Set by the HS code of the goods in Nepal's customs tariff, which can change with each year's budget." },
            { title: "Other duties", copy: "Some goods also carry excise duty or other charges." },
            { title: "VAT", copy: "13%, charged on the customs value plus the duty and any excise." },
          ] },
        ],
      },
      {
        title: "An illustration",
        blocks: [
          { type: "p", text: "Say the customs value is NPR 1,000,000 and the goods carry an illustrative duty rate of 15%. The duty is NPR 150,000. VAT is 13% of NPR 1,150,000, which is NPR 149,500. Duty and VAT together come to NPR 299,500, about 30% of the value. The rate here is an example only. Your goods' rate depends on their HS code." },
        ],
      },
      {
        title: "Why it stays provisional",
        blocks: [
          { type: "list", items: [
            "Customs may classify the goods differently from your estimate",
            "Customs may value the goods differently, especially if the price looks low",
            "Exchange rates move between order and clearance",
            "Tariff rates can change with the annual budget",
            "Exemptions and concessions apply only when customs accepts the paperwork",
          ] },
          { type: "p", text: "Our duty estimate tool runs the arithmetic from your figures. It is a planning aid, not an assessment. The only binding figure is the one customs assesses at clearance." },
        ],
      },
    ],
    questions: [
      { question: "Where do I find the duty rate?", answer: "In Nepal's customs tariff for the year, by HS code. Your customs agent can confirm the rate for your goods." },
      { question: "Can VAT be reclaimed?", answer: "VAT-registered businesses can usually credit import VAT against output VAT, following the tax rules." },
      { question: "Does the tool give an official figure?", answer: "No. The duty estimate tool is a planning aid. The binding assessment comes from customs at clearance." },
    ],
    related: { service: service.customs, guides: ["hs-codes-and-import-duty", "customs-clearance-in-nepal"], tool: "duty-estimate" },
  },
  {
    slug: "reading-a-freight-quote",
    topic: "costs",
    title: "Reading a freight quote: what is in, what is out",
    description: "Two quotes for the same Nepal shipment can differ because they cover different things. How to read a quote, and the lines to check before comparing.",
    intro: "Two freight quotes for the same shipment can be thousands apart and both be honest. Usually they are quoting different things.",
    published,
    cover: "clipboard-sign",
    coverCaption: "The total on a quote means little until you know where it starts and ends.",
    sections: [
      {
        title: "Start and end",
        blocks: [
          { type: "p", text: "The first thing to find is where the quote starts and where it ends. Port to port, door to door, or something in between? A quote to Kolkata port and a quote to your Kathmandu warehouse are not two prices for the same thing." },
        ],
      },
      {
        title: "Lines to look for",
        blocks: [
          { type: "list", items: [
            "Origin charges: collection, export clearance, terminal handling",
            "The main freight: ocean, air or road, with the unit and the rate",
            "Surcharges: fuel, currency, peak season, security",
            "Destination charges at the Indian port: handling, delivery order, documentation",
            "Transit to Nepal: transit papers, rail or truck, seals",
            "Nepal side: customs agency, dry port charges, unloading, delivery",
            "What is excluded: duty, VAT, storage, detention, inspection costs, insurance",
          ] },
        ],
      },
      {
        title: "The small print that matters",
        blocks: [
          { type: "list", items: [
            "The validity period of the rates",
            "The cargo it assumes: weight, volume, dimensions, commodity",
            "Free days included, and the charges after them",
            "Which costs are fixed and which are at actuals against receipts",
            "The currency of each part, and the exchange rate basis",
          ] },
          { type: "p", text: "A price depends on weight, dimensions, commodity, packing and access. If the cargo turns out different from the quote's assumptions, the price changes with it. Duty and taxes are never guaranteed by a forwarder, because the assessment belongs to customs." },
        ],
      },
      {
        title: "Comparing fairly",
        blocks: [
          { type: "p", text: "Put two quotes side by side, line by line, and fill the gaps in each with realistic figures. The quote that looked cheaper often leaves out the lines that cost the most." },
        ],
      },
    ],
    questions: [
      { question: "Why do quotes say subject to change?", answer: "Carriers' rates and surcharges change, and the actual cargo may differ from the enquiry. A quote is valid for the cargo and period stated." },
      { question: "What does at actuals mean?", answer: "Costs that will be charged as incurred, against receipts, because they cannot be known in advance." },
      { question: "How quickly does KCPL reply to quote requests?", answer: "Within one working day." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal"] },
  },
  {
    slug: "local-charges-on-a-sea-invoice",
    topic: "costs",
    title: "Local charges: the other lines on a sea freight invoice",
    description: "Terminal handling, delivery order fees, documentation and more: the local charges on a Nepal sea import, where they arise, and which ones you can plan for.",
    intro: "The ocean freight is the line everyone negotiates. The local charges at each end are the lines that surprise people when the invoice arrives.",
    published,
    cover: "port-aerial",
    coverCaption: "Every port and terminal a container passes through has its own charges.",
    sections: [
      {
        title: "Where local charges arise",
        blocks: [
          { type: "p", text: "Local charges are the fees at the ports and terminals at each end of the sea leg, set by the shipping line, the terminal or the agent. For a Nepal import, the destination charges arise in India, at the gateway port, and then there are the costs of the transit and the dry port in Nepal on top." },
        ],
      },
      {
        title: "Common destination lines",
        blocks: [
          { type: "list", items: [
            "Terminal handling charge, for moving the container through the terminal",
            "Delivery order fee, for issuing the release",
            "Documentation or bill of lading fees",
            "Container cleaning or maintenance charges",
            "Port storage, once free days run out",
            "Charges for any manifest amendment or document correction",
          ] },
          { type: "p", text: "Names and amounts vary by line and port. Some lines publish their local charges. Others quote them on request. Ask before you book, not after you arrive." },
        ],
      },
      {
        title: "Then the Nepal leg",
        blocks: [
          { type: "list", items: [
            "Transit documentation and customs broker charges in India",
            "Rail haulage or trucking to Birgunj",
            "Electronic seal and transit charges, where applicable",
            "Dry port handling and storage",
            "Customs agency fees in Nepal",
            "Unloading, delivery and empty return",
          ] },
        ],
      },
      {
        title: "Planning for them",
        blocks: [
          { type: "p", text: "When you buy CIF or CFR, the seller chooses the line, and its local charges come to you. A cheap CIF price on a line with high destination charges can cost more than a higher FOB price on a line you chose. Ask your forwarder for an estimate of the destination charges for the line the seller proposes, before you accept the price." },
        ],
      },
    ],
    questions: [
      { question: "Can local charges be negotiated?", answer: "Line charges are usually fixed tariffs. Choosing the line and the terms of purchase is the main way to manage them." },
      { question: "Why are some charges in dollars and some in rupees?", answer: "Charges set by international lines are often in dollars, while local services are billed in local currency." },
      { question: "Who pays local charges at origin?", answer: "That depends on the Incoterm. Under FOB, the seller usually pays origin charges; under EXW, the buyer does." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "free-time-and-demurrage"] },
  },
  {
    slug: "paying-freight-in-three-currencies",
    topic: "costs",
    title: "Paying for freight: USD, INR and NPR on one shipment",
    description: "A Nepal import can involve costs in dollars, Indian rupees and Nepali rupees. Why freight is billed in several currencies, and how to keep track.",
    intro: "One container into Nepal can generate costs in three currencies. Knowing which costs fall in which currency, and why, makes the invoices easier to check and to pay.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Each part of a Nepal shipment tends to be priced in the currency of the country it happens in.",
    sections: [
      {
        title: "Who bills in what",
        blocks: [
          { type: "steps", items: [
            { title: "US dollars", copy: "International freight: ocean and air rates, and charges between forwarders in different countries, are usually in dollars." },
            { title: "Indian rupees", copy: "Costs that arise in India: gateway port charges, transit, rail or trucking to the border, and Indian customs broker fees." },
            { title: "Nepali rupees", copy: "Costs in Nepal: customs agency, dry port charges, delivery, and Nepal VAT at 13% where it applies. Customs duty and VAT are paid in rupees too." },
          ] },
        ],
      },
      {
        title: "How it reaches you",
        blocks: [
          { type: "p", text: "Some forwarders bill each part in its own currency. Others convert everything into one invoice in Nepali rupees, at a stated exchange rate. Either way, ask which rate is used and when it is fixed, because a quote in dollars can cost more rupees by the time it is paid." },
        ],
      },
      {
        title: "Payments abroad",
        blocks: [
          { type: "p", text: "Paying a foreign supplier or an overseas freight charge from Nepal goes through your bank, under Nepal's foreign exchange rules. The bank will ask for documents that support the payment, such as the invoice and the transport document. Ask your bank early which documents it needs for freight payments, so a payment is not held up when a shipment needs releasing." },
        ],
      },
      {
        title: "Keeping it straight",
        blocks: [
          { type: "list", items: [
            "Keep one file per shipment, with every invoice in every currency",
            "Note the exchange rate used on each invoice",
            "Match each charge to the quote it was agreed in",
            "Keep VAT invoices for any VAT you are entitled to reclaim",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can I pay everything in Nepali rupees?", answer: "Some forwarders invoice the whole shipment in rupees and settle the foreign parts themselves. Ask how they convert and what rate they use." },
      { question: "Does VAT apply to freight invoices?", answer: "VAT applies to taxable services in Nepal at 13%. Whether a particular line attracts VAT depends on the service and the rules." },
      { question: "Why is the dollar amount different from the quote?", answer: "Usually because surcharges changed, the cargo differed, or extra services were needed. Ask for the difference line by line." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal"] },
  },
  {
    slug: "letters-of-credit-and-shipping-documents",
    topic: "costs",
    title: "Letters of credit and shipping documents",
    description: "When a Nepal import is paid by letter of credit, the documents must match it exactly. The terms that matter for freight, and the common discrepancies.",
    intro: "A letter of credit pays the seller against documents, not goods. If the documents do not match the credit exactly, payment and often release are delayed.",
    published,
    cover: "clipboard-sign",
    coverCaption: "Banks check documents, not cargo. Every word counts.",
    sections: [
      {
        title: "How a credit works",
        blocks: [
          { type: "p", text: "The buyer's bank promises to pay the seller when the seller presents the documents the credit lists: usually an invoice, a packing list, a transport document and sometimes insurance and origin certificates. The banks check the documents against the credit's terms. If they comply, the bank pays. If not, there is a discrepancy, and payment waits for the buyer to accept it." },
        ],
      },
      {
        title: "Terms that matter for freight",
        blocks: [
          { type: "list", items: [
            "The port of loading and port of discharge, such as Shanghai and Kolkata",
            "The final destination, such as Birgunj, Nepal, if a through transport document is used",
            "Whether transshipment is allowed: most Nepal-bound cargo transships",
            "Whether partial shipments are allowed",
            "The latest shipment date and the period for presenting documents",
            "The type of transport document required, and who it must be consigned to",
          ] },
          { type: "p", text: "A credit that forbids transshipment, or names a port the cargo cannot reach directly, can make compliance impossible. Read the draft credit with your forwarder before it is issued." },
        ],
      },
      {
        title: "Why it affects release",
        blocks: [
          { type: "p", text: "When the bill of lading is made out to the order of the bank, the cargo cannot be released until the bank has paid and endorsed the bill. Original documents then travel from the bank to the port agent, which takes days. Plan for that courier time, or agree how the release will be handled, before the cargo arrives at the Indian port." },
        ],
      },
      {
        title: "Common discrepancies",
        blocks: [
          { type: "list", items: [
            "Descriptions on the invoice that differ from the credit",
            "A late shipment or late presentation",
            "A bill of lading that is not marked clean or on board",
            "Names or addresses that do not match the credit",
            "Missing documents, or the wrong number of originals",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Who checks the documents for discrepancies?", answer: "The banks, against the credit's terms. Your forwarder can check the transport document wording before it is issued." },
      { question: "Can a discrepancy be accepted?", answer: "The buyer can choose to accept discrepant documents and instruct the bank to pay." },
      { question: "Does the credit affect release at the port?", answer: "Yes, if the bill of lading is consigned to the bank's order. The cargo cannot be released until the bank releases the documents." },
    ],
    related: { service: service.customs, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "cbm-and-weight-in-sea-freight",
    topic: "costs",
    title: "CBM and weight: how sea freight is charged",
    description: "Shared-container sea freight is charged by the cubic metre or the tonne, whichever is greater. How to measure, Nepal's weight limits, and an example.",
    intro: "Sea freight for a part load is charged by the cubic metre, unless the cargo is heavy for its size. Knowing how the charge is worked out helps you pack and plan.",
    published,
    cover: "container-yard",
    coverCaption: "Shared container space is sold by the cubic metre.",
    sections: [
      {
        title: "Weight or measure",
        blocks: [
          { type: "p", text: "LCL freight is charged per revenue tonne, which is the greater of the volume in cubic metres and the weight in tonnes. A cubic metre of cargo that weighs less than 1,000 kilos is charged as one cubic metre. A cubic metre that weighs 1,500 kilos is charged as 1.5 tonnes. Most consolidators set a minimum, often one cubic metre." },
        ],
      },
      {
        title: "Measuring",
        blocks: [
          { type: "steps", items: [
            { title: "Measure each package", copy: "Length, width and height in metres, at the longest points, including the pallet." },
            { title: "Multiply", copy: "A pallet 1.2 × 1.0 × 1.5 metres is 1.8 cubic metres." },
            { title: "Add them up", copy: "Total the cubic metres for all packages, and the weight for all packages." },
            { title: "Compare", copy: "Four such pallets are 7.2 cubic metres. If they weigh 2,400 kilos, that is 2.4 tonnes, so the charge is on 7.2." },
          ] },
        ],
      },
      {
        title: "Full containers are different",
        blocks: [
          { type: "p", text: "A full container is charged per box, whatever is in it, up to its weight limit. For Nepal, the limit that matters is often lower than the container's rating, because the road and rail legs and the trucks at the far end have their own limits. Overweight containers can be stopped and charged, so ask your forwarder for the safe maximum before loading." },
        ],
      },
      {
        title: "Use the tool",
        blocks: [
          { type: "p", text: "Our volume and chargeable weight tool works out cubic metres and chargeable weight from your package sizes, for sea and for air. Measure as packed, because that is what the station will measure." },
        ],
      },
    ],
    questions: [
      { question: "Why was I charged for more cubic metres than I declared?", answer: "The station measures cargo as received. Pallets, overhangs and uneven stacking add volume." },
      { question: "Is there a minimum charge for LCL?", answer: "Usually one cubic metre or one revenue tonne, and local charges per shipment." },
      { question: "How heavy can a 20-foot container be for Nepal?", answer: "Ask your forwarder for a safe maximum for the whole route. Road and rail limits often apply before the container's own rating." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india"], tool: "volume-weight" },
  },
  {
    slug: "why-the-cheapest-rate-costs-more",
    topic: "costs",
    title: "Why the cheapest freight rate can cost more",
    description: "The lowest freight rate often hides costs that come later: destination charges, delays, storage and rework. How to judge an offer on the whole trip.",
    intro: "A freight rate is the easiest number to compare and the least complete. The cheapest rate can lead to the most expensive shipment.",
    published,
    cover: "ghat-trucks",
    coverCaption: "The cost of a shipment is decided along the whole route, not on the first line of the quote.",
    sections: [
      {
        title: "Where the savings go",
        blocks: [
          { type: "list", items: [
            "High destination charges at the Indian port on a cheap sailing",
            "Fewer free days, so storage and detention start sooner",
            "Transshipment through busy hubs, adding weeks and missed connections",
            "No one checking the draft bill of lading, so errors surface at the port",
            "Gaps between the parties at the gateway, the border and the dry port",
          ] },
        ],
      },
      {
        title: "What a delay costs",
        blocks: [
          { type: "p", text: "For a Nepal import, a week of delay can mean port storage, container detention, dry port storage, and stock that is not on your shelves or a site that is waiting. Those costs often outweigh the difference between two freight rates. They are also harder to see, because they arrive on different invoices from different companies." },
        ],
      },
      {
        title: "Judge the whole journey",
        blocks: [
          { type: "list", items: [
            "Compare the total cost delivered to your door, with realistic charges filled in",
            "Ask for the free days and the charges after them",
            "Ask who checks the documents before shipment",
            "Ask who coordinates the gateway, the transit and the Nepal side",
            "Ask for the forwarder's record on similar shipments",
          ] },
        ],
      },
      {
        title: "Cheap is fine when it is complete",
        blocks: [
          { type: "p", text: "A low price is not a warning sign by itself. A low price that leaves out half the journey is. When a quote looks much cheaper than others, ask what it does not include, and price those parts before you decide." },
        ],
      },
    ],
    questions: [
      { question: "Does KCPL compete on price?", answer: "KCPL quotes for the whole journey and states what is included and what is not, so the price can be compared fairly." },
      { question: "How can I compare quotes from different forwarders?", answer: "Line them up by stage, fill in missing items with realistic figures, and compare the total cost delivered to your door." },
      { question: "Is the most expensive quote the safest?", answer: "Not necessarily. Look at what is included and the forwarder's record, not just the price." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "free-time-and-demurrage"] },
  },
  {
    slug: "landed-cost-of-an-import",
    topic: "costs",
    title: "Landed cost: what a Nepal import really costs",
    description: "The supplier's price is only the start of what an import into Nepal costs. How to add up landed cost: freight, charges, duty, VAT and time in transit.",
    intro: "Pricing a product for sale in Nepal starts with knowing what it costs to bring in. The supplier's price is only the first line of that sum.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Landed cost is the price that matters for your margin.",
    sections: [
      {
        title: "The lines in a landed cost",
        blocks: [
          { type: "list", items: [
            "The price paid to the supplier, under the agreed Incoterm",
            "Origin charges not included in that price",
            "International freight and surcharges",
            "Insurance",
            "Destination charges at the Indian port, and transit to Nepal",
            "Customs duty, excise where applicable, and VAT",
            "Customs agency, dry port, unloading and delivery charges",
            "Bank charges for the payment or letter of credit",
          ] },
        ],
      },
      {
        title: "Costs people forget",
        blocks: [
          { type: "list", items: [
            "Exchange rate movement between order and payment",
            "Storage and detention when a shipment is delayed",
            "Inspection costs if customs examines the cargo",
            "The cost of money tied up in goods while they travel",
            "Damage and shortage not covered by insurance",
          ] },
        ],
      },
      {
        title: "VAT is different",
        blocks: [
          { type: "p", text: "For a VAT-registered business, VAT paid at import can normally be credited against VAT charged on sales, so it is a cash-flow cost rather than a final one. Customs duty is not reclaimable in the same way. Keep the two apart in your costing, and keep the import VAT records for your accounts." },
        ],
      },
      {
        title: "Building the habit",
        blocks: [
          { type: "p", text: "Work out the landed cost for each regular product once, and update it when freight rates, tariffs or exchange rates change. Divide by the units in a shipment to get a landed cost per unit. Our duty estimate and storage charges tools can fill in two of the harder lines." },
        ],
      },
    ],
    questions: [
      { question: "Should duty be included in landed cost?", answer: "Yes. Duty is a real cost of bringing the goods in. VAT is normally recoverable for registered businesses, so it is often tracked separately." },
      { question: "How do I allocate freight across products?", answer: "By weight, volume or value, whichever reflects the real cost driver. Stay consistent." },
      { question: "Does landed cost change shipment to shipment?", answer: "Yes, with freight rates, exchange rates and tariffs. Update it regularly." },
    ],
    related: { service: service.customs, guides: ["importing-to-nepal", "hs-codes-and-import-duty"], tool: "duty-estimate" },
  },
  {
    slug: "surcharges-on-a-freight-bill",
    topic: "costs",
    title: "Surcharges on a freight bill, explained",
    description: "Fuel, currency, peak season, security and congestion: the surcharges that appear on sea and air freight bills, why they change, and how to plan for them.",
    intro: "Freight rates come with a family of surcharges, often in capital letters. They are not hidden fees, but they move, and they can change a quote between booking and sailing.",
    published,
    cover: "port-aerial",
    coverCaption: "Surcharges move with fuel prices, currencies and demand.",
    sections: [
      {
        title: "Common sea surcharges",
        blocks: [
          { type: "list", items: [
            "Bunker or fuel adjustment: follows the price of ship fuel",
            "Low sulphur or environmental surcharges: tied to fuel regulations",
            "Currency adjustment: covers exchange rate swings",
            "Peak season surcharge: added when demand is high",
            "Congestion surcharge: added when a port is congested",
            "War risk or emergency surcharges: for routes affected by conflict",
          ] },
        ],
      },
      {
        title: "Common air surcharges",
        blocks: [
          { type: "list", items: [
            "Fuel surcharge: usually per kilo, following jet fuel prices",
            "Security surcharge: covering screening and security measures",
          ] },
        ],
      },
      {
        title: "Why they change",
        blocks: [
          { type: "p", text: "Carriers use surcharges to pass on costs that move faster than their base rates. A quote may be built on the surcharges in force when it is given. If they change before the cargo sails or flies, the amount charged may change too. A good quote says whether surcharges are fixed for its validity or apply as at shipment." },
        ],
      },
      {
        title: "Planning for them",
        blocks: [
          { type: "list", items: [
            "Ask for a quote that shows each surcharge as a separate line",
            "Ask whether they are fixed for the quote's validity",
            "Expect peak season surcharges before big holidays and in busy shipping months",
            "Budget a margin for fuel-linked surcharges on long contracts",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can surcharges be refused?", answer: "They are part of the carrier's price. They can only be avoided by choosing different services or terms." },
      { question: "Why did a surcharge appear after booking?", answer: "Carriers sometimes introduce surcharges at short notice, for fuel spikes, congestion or emergencies. Quotes usually say whether they apply." },
      { question: "Do surcharges apply to road freight?", answer: "Road transporters may adjust prices for fuel or tolls, though the naming varies." },
      { question: "How do I budget for surcharges on a long project?", answer: "Ask your forwarder for the current surcharges as separate lines, and for how they have moved over recent months. Build a margin for the fuel-linked ones, and agree in the contract how changes will be passed on, with evidence from the carrier. A clear mechanism agreed at the start avoids an argument every time fuel prices move." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal"] },
  },
  {
    slug: "why-quotes-expire",
    topic: "costs",
    title: "Why a freight quote has an expiry date",
    description: "Freight quotes are valid for a set period and a stated cargo. Why rates expire, what changes them, and how to keep a quote valid until the cargo ships.",
    intro: "A freight quote is a price for a cargo, a route and a period. When any of the three changes, the price can change with it.",
    published,
    cover: "clipboard-sign",
    coverCaption: "A quote is valid for the cargo and the dates written on it.",
    sections: [
      {
        title: "Why rates expire",
        blocks: [
          { type: "p", text: "Freight forwarders buy space from shipping lines, airlines and truckers whose rates change often, sometimes every few weeks. Fuel prices, exchange rates, demand and regulation all move. A forwarder's quote is built on the rates it can buy during a set period, so it carries a validity date." },
        ],
      },
      {
        title: "What else changes a quote",
        blocks: [
          { type: "list", items: [
            "The cargo is heavier, larger or different from what was quoted",
            "The packing changes, so the volume or the handling changes",
            "The collection or delivery point changes",
            "The ready date moves into a new rate period or a peak season",
            "A carrier announces a surcharge or a rate increase",
          ] },
          { type: "p", text: "Receipted costs such as port storage, inspection charges or duty are usually charged at actuals, because nobody can fix them in advance." },
        ],
      },
      {
        title: "Keeping a quote valid",
        blocks: [
          { type: "list", items: [
            "Book within the validity period, even if the cargo ships a little later",
            "Give accurate weights, dimensions and commodity at the start",
            "Tell your forwarder when anything about the cargo changes",
            "For long projects, agree how rates will be reviewed over time",
          ] },
        ],
      },
      {
        title: "Asking for a quote",
        blocks: [
          { type: "p", text: "The more complete the enquiry, the more reliable the quote. Send the commodity, the weight and dimensions, the origin and destination, the ready date and the Incoterm. KCPL replies to quote requests within one working day." },
        ],
      },
    ],
    questions: [
      { question: "Can I extend a quote?", answer: "Ask before it expires. The forwarder will check whether its own buying rates have changed." },
      { question: "Is a booking confirmation the same as a quote?", answer: "No. A booking confirmation reserves space; the quote sets the price. Both matter." },
      { question: "What information gives the most accurate quote?", answer: "The commodity, weight, dimensions, origin and destination, ready date and Incoterm." },
      { question: "Why did my final invoice differ from the quote?", answer: "Usually for one of four reasons: the cargo was heavier or larger than quoted, the dates moved into a new rate period, a carrier surcharge changed, or costs at actuals such as storage or inspection were added. Ask for the difference line by line, with the reason for each. A good forwarder explains it before you have to ask." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal"] },
  },
];
