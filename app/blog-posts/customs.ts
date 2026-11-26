import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const customsPosts: readonly BlogPost[] = [
  {
    slug: "commercial-invoice-for-nepal-customs",
    topic: "customs",
    title: "Writing an invoice that clears Nepal customs",
    description: "The commercial invoice is the document Nepal customs reads first. What it must show for a smooth clearance, and the small errors that start a long query.",
    intro: "Customs reads the commercial invoice before anything else. A clear one moves the cargo. A vague one starts a conversation that can last days.",
    published,
    cover: "clipboard-sign",
    coverCaption: "Most customs queries can be traced back to a line on the invoice.",
    sections: [
      {
        title: "What the invoice is for",
        blocks: [
          { type: "p", text: "To Nepal customs, the commercial invoice says what the goods are, how many there are, what they cost and who is buying them. From it, customs works out the classification, the value and the duty. If the invoice leaves any of those open, customs has to ask, and the cargo waits while it does." },
        ],
      },
      {
        title: "What it must show",
        blocks: [
          { type: "list", items: [
            "The seller's and the buyer's full names and addresses, with the buyer exactly as registered in Nepal",
            "An invoice number and date",
            "A clear description of each item: what it is, what it is made of, what it does, and the model or brand",
            "The quantity, the unit and the unit price of each item",
            "The total value and the currency",
            "The delivery term, such as FOB Shanghai or CIF Kolkata",
            "The country of origin of the goods",
            "HS codes, where the seller knows them",
          ] },
        ],
      },
      {
        title: "Errors that start a query",
        blocks: [
          { type: "list", items: [
            "Descriptions such as spare parts, accessories or general goods",
            "A total that does not add up from the lines",
            "Free goods or samples listed with no value",
            "A pro forma invoice in place of the final one",
            "Quantities that differ from the packing list",
            "A buyer name that differs from the bill of lading or the customs declaration",
          ] },
          { type: "p", text: "Free items are a common trap. Customs values goods whether or not they were paid for, so a free sample should carry a value for customs purposes, with a note that no payment is due." },
        ],
      },
      {
        title: "Check it before it travels",
        blocks: [
          { type: "p", text: "Ask the supplier for the draft invoice before the goods ship, and have your customs agent read it against the packing list and your purchase order. Corrections at that stage take an email. After the cargo has arrived, the supplier may need to reissue and courier documents, and the storage clock is running." },
        ],
      },
    ],
    questions: [
      { question: "Can the invoice be in a currency other than dollars?", answer: "Yes. Invoices can be in the currency of the sale. Customs converts the value into Nepali rupees at the exchange rate it applies. State the currency clearly on every page." },
      { question: "Does the invoice need a stamp and signature?", answer: "Customs, banks and buyers commonly expect an invoice signed by the seller, and many ask for a company stamp. If the payment is by letter of credit, follow the credit's exact requirements." },
      { question: "Can my forwarder write the invoice for me?", answer: "No. The commercial invoice is the seller's document. A forwarder can tell you what it must contain and check a draft, but it must come from the supplier." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"], tool: "duty-estimate" },
  },
  {
    slug: "the-packing-list-and-delays",
    topic: "customs",
    title: "The packing list: a small document, big delays",
    description: "The packing list tells customs, the transporter and the receiver what is in each package. Why it matters for Nepal freight, and how to write a good one.",
    intro: "Nobody pays for the goods on the packing list, so it is often written in a hurry. Then a customs officer opens a carton and finds something else.",
    published,
    cover: "warehouse-racks",
    coverCaption: "A packing list should let anyone find any item without opening every package.",
    sections: [
      {
        title: "Who reads it",
        blocks: [
          { type: "list", items: [
            "Customs, to check what is inside without opening everything, and to choose what to open",
            "The transporter, to plan the truck, the container and the lifting gear",
            "The forwarder, to work out the chargeable weight and volume",
            "The receiver, to count the delivery and report shortages",
            "The insurer, when a claim needs to show what was in a lost or damaged package",
          ] },
        ],
      },
      {
        title: "What a useful one contains",
        blocks: [
          { type: "list", items: [
            "The same invoice number, buyer and seller as the commercial invoice",
            "Each package by number, with its type: carton, crate, pallet, drum or loose piece",
            "What is in each package, in words that match the invoice",
            "The net and gross weight of each package",
            "The dimensions of each package, in centimetres",
            "Totals of packages, weight and volume that match the bill of lading",
          ] },
        ],
      },
      {
        title: "Where it goes wrong",
        blocks: [
          { type: "p", text: "The usual fault is a mismatch: 120 cartons on the packing list, 118 on the bill of lading, 4,820 kilos on one and 4,900 on the other. Each difference is a question for customs to answer before release. Another is a list that only gives totals, so that when one carton is opened there is no way to check it against anything." },
          { type: "p", text: "For project cargo, the packing list also has to give each piece's dimensions and weight, and mark the over-dimensional ones, because those figures decide the trailer and the route." },
        ],
      },
      {
        title: "Marks on the packages",
        blocks: [
          { type: "p", text: "The package numbers on the list should be written on the packages themselves, with the consignee's name and the destination. A list that says package 14 contains the motor is only useful if someone can find package 14." },
        ],
      },
    ],
    questions: [
      { question: "Does the packing list need prices?", answer: "No. Prices belong on the invoice. The packing list is about contents, quantities, weights and dimensions. Some importers prefer it without prices so it can be shown to transporters." },
      { question: "Should weights be net or gross?", answer: "Both. Net weight is the goods alone; gross includes the packing. The gross weight should agree with the bill of lading or air waybill." },
      { question: "What if a carton is repacked on the way?", answer: "Update the packing list and tell everyone who holds a copy. Packages that no longer match the list are the ones that get held." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "importing-to-nepal"], tool: "volume-weight" },
  },
  {
    slug: "exim-code-for-nepal-traders",
    topic: "customs",
    title: "The EXIM code: what Nepal traders need first",
    description: "Before a Nepal business can import or export, its registrations must be in order, including the EXIM code. What it is, and when to sort it out.",
    intro: "A first import into Nepal can be held for reasons that have nothing to do with the goods. One of the most common is a trader registration that is missing or does not match.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Registration problems are found at customs, but they are fixed in an office.",
    sections: [
      {
        title: "What the EXIM code is",
        blocks: [
          { type: "p", text: "Nepal uses an import-export code, usually called the EXIM code, to identify businesses that trade across the border. It is linked to the business's tax registration and is used on customs declarations. Without it, a business cannot clear goods in its own name." },
          { type: "p", text: "The application is made online through the government's trade systems. The exact process and requirements can change, so check the Department of Customs or the Nepal National Single Window for the current steps before you apply." },
        ],
      },
      {
        title: "What else must line up",
        blocks: [
          { type: "list", items: [
            "The business registration, with its name exactly as on the trade documents",
            "The PAN or VAT registration",
            "The EXIM code",
            "Any sector licence needed for the goods, such as for medicines or telecom equipment",
            "A bank account and the bank's arrangements for paying foreign suppliers",
          ] },
          { type: "p", text: "The name matters more than people expect. If the invoice says one thing, the bill of lading another and the registration a third, customs will ask which is right." },
        ],
      },
      {
        title: "Sort it before the first order",
        blocks: [
          { type: "p", text: "Registrations take time, and they cannot be rushed once the cargo is at the border. If you are planning a first import or export, get the registrations in place before you place the order. Then give your supplier your registered name and address to use on every document." },
        ],
      },
      {
        title: "For overseas sellers",
        blocks: [
          { type: "p", text: "If you are selling to a new buyer in Nepal, ask them to confirm their registered name and that they are set up to import before you ship. A buyer who cannot clear the goods leaves your cargo at the border, running up charges that someone will be asked to pay." },
        ],
      },
    ],
    questions: [
      { question: "Can I use someone else's registration to import?", answer: "Importing in another business's name creates problems with tax, ownership and accountability, and can break the rules. Get your own registrations in order before the first import." },
      { question: "Do I need the EXIM code for a one-off import?", answer: "Commercial imports by a business generally need the trader registrations. Personal effects and some small consignments follow different rules. Ask a customs agent about your specific case." },
      { question: "How long does registration take?", answer: "It depends on your documents and the authorities' workload. Start early and check the current process on official sites before you place your first order." },
    ],
    related: { service: service.customs, guides: ["importing-to-nepal", "exporting-from-nepal"] },
  },
  {
    slug: "nepal-national-single-window",
    topic: "customs",
    title: "The Nepal National Single Window, for traders",
    description: "The Nepal National Single Window lets traders submit trade documents and permits online. What it covers, who uses it, and what it means for your clearance.",
    intro: "Nepal's trade paperwork used to mean visits to several offices. The National Single Window is the government's way of bringing those steps online.",
    published,
    cover: "kathmandu",
    coverCaption: "Trade paperwork increasingly happens online, before the cargo reaches the border.",
    sections: [
      {
        title: "What a single window is",
        blocks: [
          { type: "p", text: "A trade single window lets a trader submit documents once, electronically, to the agencies that need them: customs, and the departments that issue permits and certificates for particular goods. Nepal's version is the Nepal National Single Window, or NNSW, linked to the customs system." },
        ],
      },
      {
        title: "Who uses it",
        blocks: [
          { type: "list", items: [
            "Importers and exporters, or their customs agents on their behalf",
            "Agencies that issue permits, licences and certificates for regulated goods",
            "Customs offices, which receive the declarations and documents",
          ] },
          { type: "p", text: "In practice, most importers work through a customs agent who handles the system. But the registrations, licences and permits belong to the trader, and they have to be valid and in the trader's correct name." },
        ],
      },
      {
        title: "What it changes for you",
        blocks: [
          { type: "p", text: "Documents can be prepared and submitted before the cargo arrives, so clearance can begin sooner. Permits for regulated goods can be applied for online, though they still take the issuing agency's time. Errors are still errors: a wrong code or a mismatched name gets rejected online instead of at a counter." },
        ],
      },
      {
        title: "Check the current rules",
        blocks: [
          { type: "p", text: "Which steps are online, and which agencies are connected, changes as the system develops. Before a first shipment of a new kind of goods, ask your customs agent which permits are needed, how they are applied for, and how long they take. Then apply before the cargo leaves origin." },
        ],
      },
    ],
    questions: [
      { question: "Do I have to use the single window myself?", answer: "Most traders work through a customs agent who uses the systems for them. You still need your registrations and any permits in your own name." },
      { question: "Can every permit be obtained online?", answer: "Not necessarily. Which permits run through the single window depends on which agencies are connected. Your customs agent can tell you how each permit is applied for today." },
      { question: "Does the single window make clearance faster?", answer: "It can, when the documents are right and are submitted early. It does not change the rules, and errors are still rejected." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "importing-to-nepal"] },
  },
  {
    slug: "how-nepal-customs-values-goods",
    topic: "customs",
    title: "How Nepal customs values your goods",
    description: "Duty in Nepal is charged on a customs value, not simply the invoice total. How that value is built, what is added to it, and why it may be questioned.",
    intro: "Import duty is a percentage of a value. The value customs uses is not always the number at the bottom of your invoice, and the difference can change the bill.",
    published,
    cover: "tariff-ledger",
    coverCaption: "The invoice is where the value starts, not always where it ends.",
    sections: [
      {
        title: "Starting from the price paid",
        blocks: [
          { type: "p", text: "Like most countries, Nepal starts from the transaction value: the price actually paid or payable for the goods. Costs that the buyer bears to bring the goods to the customs point are then taken into account, such as freight and insurance up to the border. That is why the delivery term on the invoice matters. Goods bought FOB at a Chinese port will have the sea freight and the transit to Nepal considered on top." },
          { type: "p", text: "VAT at 13% is then charged on the customs value plus the duty and any excise, not on the invoice alone." },
        ],
      },
      {
        title: "When customs questions the value",
        blocks: [
          { type: "p", text: "Customs compares declared values with what it knows about similar goods. If a value looks low, it may ask for evidence of the price, or assess on a different basis. Common triggers include prices well below the usual for the goods, free goods with no value, discounts that are not explained, and related-party sales." },
          { type: "list", title: "Evidence that helps", items: [
            "The purchase order or contract",
            "Proof of payment through the bank",
            "The supplier's price list or quotation",
            "Earlier import records for the same goods",
            "An explanation of any discount, in writing from the supplier",
          ] },
        ],
      },
      {
        title: "Estimate before you buy",
        blocks: [
          { type: "p", text: "When pricing a deal, estimate the landed cost on the customs value rather than the supplier's price. Add the freight to the border, the insurance, the duty at the rate for the HS code, and VAT on the total. Our duty estimate tool does the arithmetic, but the assessment is always customs' decision." },
        ],
      },
    ],
    questions: [
      { question: "Is freight to Nepal added to the value?", answer: "Costs of bringing the goods to the customs point, such as freight and insurance, are taken into account in the customs value. That is why the delivery term on the invoice matters." },
      { question: "What if I got a genuine discount?", answer: "Keep the evidence: a written explanation from the supplier, the contract and proof of payment. A real discount supported by documents is more likely to be accepted." },
      { question: "Can customs value my goods higher than I paid?", answer: "If it doubts the declared value, customs can assess on another basis set out in the rules. You can provide evidence and, if you disagree, ask your agent about review and appeal." },
    ],
    related: { service: service.customs, guides: ["hs-codes-and-import-duty", "customs-clearance-in-nepal"], tool: "duty-estimate" },
  },
  {
    slug: "customs-inspection-in-nepal",
    topic: "customs",
    title: "When customs opens the container",
    description: "Some Nepal imports are picked for physical inspection. Why it happens, what customs checks, how long it can take, and how to prepare so it goes quickly.",
    intro: "Most importers will have a consignment opened by customs sooner or later. It is routine, and how fast it goes depends mostly on the papers.",
    published,
    cover: "container-yard",
    coverCaption: "An inspection is quick when the packing list says exactly where everything is.",
    sections: [
      {
        title: "Why cargo is picked",
        blocks: [
          { type: "p", text: "Customs cannot open everything, so it chooses. Some consignments are cleared on the documents, some have their documents checked closely, and some are examined. The choice is partly risk-based: a new importer, a sensitive commodity, a value that looks low or papers that do not agree make an examination more likely. Some are picked at random." },
        ],
      },
      {
        title: "What happens",
        blocks: [
          { type: "steps", items: [
            { title: "The container is placed for examination", copy: "At the dry port or customs yard, the container is positioned and opened, usually with the importer's agent present." },
            { title: "Packages are checked", copy: "The officer opens some or all packages and compares the goods with the invoice and packing list: the description, the quantity, the markings and sometimes the origin." },
            { title: "Findings are recorded", copy: "If the goods match, the clearance continues. If they do not, customs may reassess the classification or value, or ask for more documents." },
          ] },
        ],
      },
      {
        title: "Preparing for it",
        blocks: [
          { type: "list", items: [
            "Make the packing list itemised by package, so the officer can find any item",
            "Make sure descriptions on the invoice match what is in the box, in plain words",
            "Keep catalogues or data sheets for technical goods ready",
            "Have labour and equipment arranged for heavy packages",
            "Make sure your agent is there when the container is opened",
          ] },
        ],
      },
      {
        title: "The cost of an inspection",
        blocks: [
          { type: "p", text: "Examination itself is part of the process, but it brings costs: labour to unload and reload, positioning of the container, and the extra days of storage and container time. An itemised packing list and accurate descriptions are the cheapest way to keep those days short." },
        ],
      },
    ],
    questions: [
      { question: "Can I avoid inspection?", answer: "No one can promise that. Accurate, consistent documents and a good compliance record reduce the chance of questions, but customs decides what it examines." },
      { question: "Who pays for the inspection?", answer: "The examination is part of the clearance process, but the labour, equipment and extra days of storage or container time fall on the importer." },
      { question: "Can goods be damaged in an inspection?", answer: "Handling during inspection carries some risk. Have your agent present, ask for careful repacking, and photograph the goods before and after." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal"], tool: "storage-charges" },
  },
  {
    slug: "certificates-of-origin",
    topic: "customs",
    title: "Certificates of origin: when you need one",
    description: "A certificate of origin says where goods were made. When Nepal importers and exporters need one, who issues it, and why the wrong one costs as much.",
    intro: "Where goods were made can change the duty they pay. A certificate of origin is how that is proved, and it has to be the right certificate for the right scheme.",
    published,
    cover: "clipboard-sign",
    coverCaption: "Origin is proved on paper, and the paper has to match the scheme.",
    sections: [
      {
        title: "Two kinds of certificate",
        blocks: [
          { type: "steps", items: [
            { title: "Non-preferential", copy: "States the country of origin, often for a buyer's or a bank's requirements. It does not lower any duty." },
            { title: "Preferential", copy: "Issued under a trade agreement or preference scheme, and lets the buyer claim a lower or zero rate of duty if the goods meet that scheme's rules of origin." },
          ] },
        ],
      },
      {
        title: "For imports into Nepal",
        blocks: [
          { type: "p", text: "If your goods qualify for a preferential rate under an agreement Nepal is part of, the supplier must obtain the certificate in the exporting country, in the form that agreement requires. Without it, customs charges the standard rate. Ask your supplier early, because the certificate is issued at origin and is hard to obtain once the goods have shipped." },
        ],
      },
      {
        title: "For exports from Nepal",
        blocks: [
          { type: "p", text: "Buyers abroad may need a certificate from Nepal to claim a lower duty in their own country. Which certificate, and who issues it, depends on the destination and the scheme. In Nepal, chambers of commerce and designated government bodies issue certificates of origin. Ask your buyer which form they need, and check the current rules for that destination before the goods ship." },
          { type: "list", title: "Where certificates go wrong", items: [
            "The wrong form for the scheme the buyer is claiming under",
            "Descriptions or quantities that differ from the invoice",
            "Goods that do not meet the scheme's origin rules",
            "A certificate issued after shipment when the scheme does not allow it",
          ] },
        ],
      },
      {
        title: "Keep the supporting records",
        blocks: [
          { type: "p", text: "Origin can be checked after the goods have cleared. Keep records of the materials, the suppliers and the production for the goods you certify, because a certificate that cannot be backed up can be withdrawn, and the duty claimed back." },
        ],
      },
    ],
    questions: [
      { question: "Can the certificate be issued after the goods have shipped?", answer: "Some schemes allow retrospective issue in limited cases, many do not. Arrange the certificate before shipment wherever possible." },
      { question: "Does a certificate of origin guarantee a lower duty?", answer: "No. It supports a claim, which customs accepts only if the goods meet the scheme's rules and the certificate is valid and matches the documents." },
      { question: "Who in Nepal can issue one?", answer: "Chambers of commerce and designated government bodies issue certificates of origin, depending on the scheme and destination. Check which body the buyer's scheme requires." },
    ],
    related: { service: service.customs, guides: ["exporting-from-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "goods-that-need-a-permit",
    topic: "customs",
    title: "Goods that need a permit before customs",
    description: "Some goods cannot clear Nepal customs on an invoice alone. Which kinds usually need a licence or permit, and why it must be in hand before the cargo ships.",
    intro: "For most goods, customs needs the invoice, the packing list and the duty. For some, it also needs a permission from another government office. Without it, the cargo waits.",
    published,
    cover: "container-plate",
    coverCaption: "A missing permit is found at customs, but it is issued somewhere else.",
    sections: [
      {
        title: "Kinds of goods that are often regulated",
        blocks: [
          { type: "list", items: [
            "Medicines, medical devices and related products",
            "Food, plants, seeds and agricultural products, which may need quarantine or quality checks",
            "Animals and animal products",
            "Chemicals, fertilisers and pesticides",
            "Radio, telecom and wireless equipment",
            "Explosives, arms and security equipment",
            "Vehicles, and some used goods",
          ] },
          { type: "p", text: "This is a guide to where to look, not a complete list. The rules change, and the same product can fall under different rules depending on how it is used. Your customs agent should check the specific goods." },
        ],
      },
      {
        title: "Why it must come first",
        blocks: [
          { type: "p", text: "A permit is issued by the relevant department, not by customs, and it takes that department's time. If the cargo arrives before the permit, it sits at the border or the dry port, paying storage and container charges, while the application is processed. For goods that need testing or inspection, the wait can be long." },
        ],
      },
      {
        title: "A safe order of work",
        blocks: [
          { type: "steps", items: [
            { title: "Classify the goods", copy: "Agree the HS code with your customs agent, from a full description and data sheets." },
            { title: "Check the requirements", copy: "Find out which permits, licences or certificates apply to that code and that use." },
            { title: "Apply", copy: "Apply for the permit, with the supplier's technical documents if needed." },
            { title: "Then ship", copy: "Tell the supplier to ship once the permit is issued, or once you are sure of its timing." },
          ] },
        ],
      },
    ],
    questions: [
      { question: "How do I know if my goods need a permit?", answer: "Start from the HS code and the product's use, and ask your customs agent to check the current requirements. The supplier's opinion is a starting point, not an answer." },
      { question: "Can the goods wait at customs while I apply?", answer: "They can, but every day costs storage and container charges, and some permits take long. Applying before shipment is far cheaper." },
      { question: "Do permits expire?", answer: "Many are valid for a set period or quantity. Check the validity before each shipment, in the calendar the permit was issued in." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "letters-of-authority",
    topic: "customs",
    title: "Letters of authority: letting an agent act for you",
    description: "Shipping lines, ports and customs need to know who may act for the cargo owner. What a letter of authority does on a Nepal shipment, and how to write one.",
    intro: "Your forwarder can only collect a delivery order, sign for a container or deal with customs if the people releasing your cargo know it is allowed to. That is what a letter of authority is for.",
    published,
    cover: "clipboard-sign",
    coverCaption: "A one-page letter can save a day at the line's counter.",
    sections: [
      {
        title: "What it does",
        blocks: [
          { type: "p", text: "A letter of authority, or LOA, is a short letter from the consignee on its letterhead, telling a shipping line, an airline, a terminal or another party that a named agent may act for it on a named shipment. The line then releases the delivery order, the documents or the cargo to that agent." },
        ],
      },
      {
        title: "What it should say",
        blocks: [
          { type: "list", items: [
            "Who it is addressed to: the line, airline or office concerned",
            "The consignee's full name and address, as on the bill of lading",
            "The agent's full name",
            "The shipment: bill of lading or air waybill number, and container numbers",
            "What the agent may do: collect the delivery order, pay charges, take delivery",
            "Signed and stamped by an authorised person, and dated",
          ] },
        ],
      },
      {
        title: "Where it is needed on a Nepal import",
        blocks: [
          { type: "p", text: "On a sea import, the delivery order is issued at the Indian port, where the consignee has no staff. The line needs to know that your forwarder, or its partner at the port, may collect it. A letter that names the wrong bill of lading, or is unsigned, is sent back, and the container waits." },
          { type: "p", text: "Customs clearance in Nepal is done by a licensed customs agent acting for the importer, under its own arrangements with the importer. Keep those in order too, especially when changing agents." },
        ],
      },
      {
        title: "Send it early",
        blocks: [
          { type: "p", text: "Ask your forwarder for its preferred wording when you place the booking, and send the signed letter with your other documents. A letter written on the day the ship arrives is one more thing waiting to be done when the clock is already running." },
        ],
      },
    ],
    questions: [
      { question: "Does a letter of authority cover all my shipments?", answer: "Some lines accept a standing letter; many want one per shipment, naming the bill of lading. Ask your forwarder what each line requires." },
      { question: "Can the letter be sent by email?", answer: "Usually a scanned signed and stamped copy is accepted, though some offices may ask for the original. Follow the line's instructions." },
      { question: "Is a letter of authority the same as a power of attorney?", answer: "No. A letter of authority is a narrow, practical permission for a shipment. A power of attorney is a broader legal document." },
    ],
    related: { service: service.customs, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "duty-concessions-and-the-letter",
    topic: "customs",
    title: "Duty concessions: why the letter comes first",
    description: "Projects that qualify for a customs duty concession in Nepal need a recommendation letter first. Why the letter, not the cargo, sets the timeline.",
    intro: "Some imports for qualifying projects can clear at a reduced duty. The cargo can arrive on time and still wait for weeks, because the concession depends on a letter.",
    published,
    cover: "substation",
    coverCaption: "Equipment for power projects often waits on paperwork, not on transport.",
    sections: [
      {
        title: "How concessions work",
        blocks: [
          { type: "p", text: "Nepal grants reduced or zero customs duty on certain goods for certain kinds of projects, such as some electricity and infrastructure works. The concession is not automatic. The project applies through the responsible ministry or department, which recommends the concession to customs for specific goods. Customs then applies it at clearance." },
          { type: "p", text: "The rules, the rates and the eligible goods are set by the authorities and change over time. A forwarder does not decide eligibility. What it can do is plan around the time the letter takes." },
        ],
      },
      {
        title: "Why the letter is late",
        blocks: [
          { type: "list", items: [
            "The application started when the cargo shipped, not when the order was placed",
            "The goods list in the application does not match the packing list",
            "Quantities or values changed after the application was made",
            "The approval chain runs through several offices",
          ] },
        ],
      },
      {
        title: "Planning the wait",
        blocks: [
          { type: "p", text: "If cargo reaches the border before the letter, it has to wait somewhere, and every option has a cost. It can be stored at the customs point, it can wait on the trucks, or it can be held at a warehouse before it enters Nepal customs. The right answer depends on the expected wait, the cargo and the charges at each place." },
          { type: "p", text: "The plan should say, before the cargo ships, where it will wait if the letter is late, what that costs per day, and who pays. Then a late letter is a known cost rather than a surprise." },
        ],
      },
      {
        title: "Start it with the order",
        blocks: [
          { type: "p", text: "The best time to start the concession paperwork is when the equipment is ordered and its packing list is known. Make sure the goods description and quantities in the application match what the supplier will put on the invoice and packing list." },
        ],
      },
    ],
    questions: [
      { question: "Can a forwarder obtain the recommendation letter?", answer: "The letter is issued by the authorities to the project or its contractor, on their application. A forwarder can help prepare the goods list and documents, and plan around the timing." },
      { question: "Can goods clear at full duty and claim back later?", answer: "Whether a refund is possible depends on the rules in force for that concession. Ask your customs agent before deciding, because paying and reclaiming may not be allowed." },
      { question: "Where should cargo wait for the letter?", answer: "Wherever the total cost and risk are lowest for the expected wait. A forwarder should price the options, including storage before Nepal customs, before the cargo arrives." },
    ],
    related: { service: service.project, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "when-customs-disagrees-with-your-hs-code",
    topic: "customs",
    title: "When customs disagrees with your HS code",
    description: "If Nepal customs puts your goods under a different HS code, the duty can change. Why classifications differ, what to do, and how to avoid it.",
    intro: "The HS code decides the duty rate, and sometimes whether a permit is needed. When customs reads the goods differently from you, the cost changes on the spot.",
    published,
    cover: "tariff-ledger",
    coverCaption: "One product can look like several different headings, depending on how it is described.",
    sections: [
      {
        title: "Why classifications differ",
        blocks: [
          { type: "p", text: "The Harmonized System sorts goods by what they are, what they are made of and what they do. Many products could fit more than one heading: a part could be classified with the machine it belongs to, or by its material. A multi-function device could fit under each of its functions. The supplier's code, written for their own export, is not always the code Nepal customs will accept." },
        ],
      },
      {
        title: "What to do on the day",
        blocks: [
          { type: "list", items: [
            "Ask your customs agent to explain the heading customs has chosen, and why",
            "Provide technical evidence: catalogues, data sheets, drawings, photographs",
            "If you agree, accept the reassessment and pay the difference to release the cargo",
            "If you disagree, ask your agent about the formal review and appeal routes, and their time limits",
          ] },
          { type: "p", text: "Cargo usually has to be cleared while a dispute continues, so it does not run up storage. Your agent can advise on how to clear while keeping the right to challenge the decision." },
        ],
      },
      {
        title: "Avoiding it next time",
        blocks: [
          { type: "p", text: "Classify new products before you buy them, from a full description, not after they arrive. Write descriptions on the invoice that make the classification obvious: material, function, model. Keep a record of the codes customs has accepted for your regular goods, and use the same descriptions each time." },
          { type: "p", text: "When a code has been accepted before, keep the clearance record. It is the strongest evidence you have the next time the same goods are questioned." },
        ],
      },
    ],
    questions: [
      { question: "Is the supplier's HS code wrong if customs changes it?", answer: "Not necessarily. Countries classify at more detailed levels than the shared six digits, and interpretations differ. Nepal customs decides the code for Nepal." },
      { question: "Can I get a classification decided before importing?", answer: "Ask your customs agent whether a ruling or prior opinion is available for your goods under current rules. If not, keep the evidence and records of past clearances." },
      { question: "Does a different HS code change anything besides duty?", answer: "It can. Some codes need permits or carry other charges. A reclassification can therefore affect more than the duty rate." },
    ],
    related: { service: service.customs, guides: ["hs-codes-and-import-duty", "customs-clearance-in-nepal"], tool: "duty-estimate" },
  },
  {
    slug: "importing-used-machinery",
    topic: "customs",
    title: "Importing used machinery into Nepal",
    description: "Second-hand machinery can be good value, but it raises questions at Nepal customs about value, condition and rules. What to check before you buy it.",
    intro: "Used machinery is often the right buy for a Nepal business. It also gives customs more questions to ask than new equipment, so the planning starts before the purchase.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "Used equipment needs a clear description, a clear value and clean packing.",
    sections: [
      {
        title: "Check the rules first",
        blocks: [
          { type: "p", text: "Rules on importing used goods differ by type. Some kinds of used goods are restricted or need extra approvals, and the rules change. Before you agree a price, ask your customs agent whether the specific machine, at its age and condition, can be imported, and what documents will be asked for." },
        ],
      },
      {
        title: "Value is the hard part",
        blocks: [
          { type: "p", text: "New machines have list prices. Used ones have whatever price was agreed, and customs has fewer reference points to check it against. A price that looks low will be questioned. Support it with the sale contract, proof of payment, and anything showing the machine's age, hours and condition, such as an inspection report or photographs." },
          { type: "list", title: "Documents worth having", items: [
            "The sale contract and proof of payment",
            "The manufacturer, model, serial number and year of manufacture",
            "An inspection or condition report, if available",
            "Photographs of the machine and its plates",
            "A list of any parts removed for transport",
          ] },
        ],
      },
      {
        title: "Cleaning and packing",
        blocks: [
          { type: "p", text: "Used machinery often carries oil, fuel, soil and plant matter. Drain fluids as transport requires, and clean the machine before it is packed. Soil and plant matter can cause trouble with quarantine checks, and leaking fluids are a hazard on any mode. Wooden packing and crates should meet the international treatment standard for wood packaging." },
        ],
      },
      {
        title: "Getting it there",
        blocks: [
          { type: "p", text: "Large machines may be over-dimensional and need flat-racks, open-tops or breakbulk shipping, with a route survey for the road in Nepal. Give your forwarder the dimensions and weight of the machine as it will be packed, not as it stood in the factory." },
        ],
      },
    ],
    questions: [
      { question: "Is used machinery valued at its purchase price?", answer: "Customs starts from the transaction value but can question it. Evidence of the price, condition and age helps the declared value stand." },
      { question: "Do I need an inspection certificate?", answer: "It depends on the machine and the current rules. Even where not required, an independent condition report supports the value and the description." },
      { question: "Can I ship used machinery by air?", answer: "Small parts and units can fly if accepted. Most used machinery is heavy and moves by sea or road, and any fuel or batteries make it dangerous goods for air." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "fixing-document-errors-after-shipping",
    topic: "customs",
    title: "Fixing a document error after the cargo has sailed",
    description: "A wrong name, weight or description found after shipping can still be fixed. What can be corrected, who has to do it, and how to keep the delay short.",
    intro: "Sometimes the error is found after the ship has sailed. It can still be fixed, but the fix now involves more people, more fees and more of your time.",
    published,
    cover: "clipboard-sign",
    coverCaption: "The later an error is found, the more offices have to agree to correct it.",
    sections: [
      {
        title: "Who fixes what",
        blocks: [
          { type: "steps", items: [
            { title: "The invoice and packing list", copy: "The supplier reissues them. Ask for the corrected documents with a short letter explaining the change, signed and dated." },
            { title: "The bill of lading", copy: "The line or forwarder that issued it corrects it, usually for a fee, and may need the originals back if they were issued." },
            { title: "The manifest in India", copy: "The line or its agent applies to Indian customs for an amendment. This takes time and holds the transit." },
            { title: "The Nepal declaration", copy: "Your customs agent explains the difference to Nepal customs, with the corrected documents." },
          ] },
        ],
      },
      {
        title: "What is easy and what is not",
        blocks: [
          { type: "p", text: "A typing error in an address is usually simple. A change of consignee after the bill is issued is harder, and may need the shipper's and the line's agreement. A difference between the goods and the description is the hardest, because customs will want to know which is true before it accepts either." },
        ],
      },
      {
        title: "Keeping the delay short",
        blocks: [
          { type: "list", items: [
            "Tell your forwarder the moment you find the error, not when the cargo arrives",
            "Get corrected documents from the supplier quickly, with an explanation letter",
            "Make every document tell the same story after the fix",
            "Ask what the correction will cost and how long it will take, so you can plan",
          ] },
        ],
      },
      {
        title: "Next time",
        blocks: [
          { type: "p", text: "Almost every error that needs fixing after sailing could have been caught at the draft stage. Ask your supplier for draft documents before shipment, and ask your forwarder to check them. It is the cheapest hour of the whole shipment." },
        ],
      },
    ],
    questions: [
      { question: "Can I just tell customs about the error?", answer: "Your customs agent will explain it, but customs usually needs corrected documents from the party that issued them, with an explanation. A verbal explanation alone is rarely enough." },
      { question: "Will a correction lead to a penalty?", answer: "It can, depending on the error and the rules. A genuine typing error corrected promptly is treated differently from a misdeclaration. Your agent can advise." },
      { question: "Who pays for the correction?", answer: "Usually whoever made the error, but the costs arrive at the importer first. Agree with the supplier in advance who bears the cost of their document errors." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "sea-freight-through-india"] },
  },
];
