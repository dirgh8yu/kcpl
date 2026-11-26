import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const airPosts: readonly BlogPost[] = [
  {
    slug: "chargeable-weight-explained",
    topic: "air",
    title: "Chargeable weight: why a light box costs like a heavy one",
    description: "Air freight is charged on the greater of actual and volume weight. How chargeable weight is worked out, with an example, and how packing can lower it.",
    intro: "An air freight quote is a rate per kilo. Which kilos are counted is the question that surprises shippers, because a light carton can be charged as a heavy one.",
    published,
    cover: "warehouse-racks",
    coverCaption: "Cartons are measured as packed, and the space they take is charged for.",
    sections: [
      {
        title: "Two weights, the greater wins",
        blocks: [
          { type: "p", text: "Airlines charge for the space cargo takes as well as for its weight. So every shipment has two weights: the actual weight on the scale, and a volume weight worked out from its dimensions. The chargeable weight is whichever is greater." },
          { type: "p", text: "For most air cargo, the volume weight is the length, width and height in centimetres, multiplied together and divided by 6,000. The result is in kilos. Courier companies often divide by 5,000, which makes their volume weights higher." },
        ],
      },
      {
        title: "A worked example",
        blocks: [
          { type: "steps", items: [
            { title: "The carton", copy: "One carton of felt goods measuring 60 × 40 × 40 centimetres, weighing 8 kilos." },
            { title: "Its volume", copy: "60 × 40 × 40 = 96,000 cubic centimetres." },
            { title: "Its volume weight", copy: "96,000 ÷ 6,000 = 16 kilos." },
            { title: "What is charged", copy: "16 kilos, because the volume weight is greater than the actual 8." },
          ] },
          { type: "p", text: "Ten of those cartons are charged as 160 kilos, not 80. For a dense shipment, such as metal parts, the actual weight is usually the greater, and the volume weight does not matter." },
        ],
      },
      {
        title: "Lowering it",
        blocks: [
          { type: "list", items: [
            "Use the smallest carton that protects the goods, and fill it",
            "Avoid oversized outer cartons and loose filling where possible",
            "Combine light and heavy goods in one shipment, where they travel together",
            "Measure cartons after packing, and round the way your forwarder does",
          ] },
          { type: "p", text: "Rates are also tiered: the price per kilo usually falls as the chargeable weight passes certain breaks. A shipment just under a break can sometimes cost less if charged at the next one up. A good forwarder checks this for you." },
        ],
      },
      {
        title: "Try it yourself",
        blocks: [
          { type: "p", text: "Our volume and chargeable weight tool does the sums from your carton sizes and weights, for air and for sea. Use the dimensions as packed, including pallets, because that is what the airline measures." },
        ],
      },
    ],
    questions: [
      { question: "Why do couriers charge more for the same box?", answer: "Many couriers use a smaller divisor for volume weight, often 5,000 instead of 6,000, which makes the volume weight higher. They also price for door-to-door service." },
      { question: "Does chargeable weight apply to sea freight?", answer: "Sea freight uses a similar idea: LCL is charged on the greater of the cubic metres and the tonnes. Full containers are charged per box." },
      { question: "Do pallets count in the dimensions?", answer: "Yes. The airline measures the shipment as it is tendered, including the pallet and any packing." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"], tool: "volume-weight" },
  },
  {
    slug: "when-air-beats-sea",
    topic: "air",
    title: "When air freight beats sea for a Nepal shipment",
    description: "Air costs more per kilo than sea, but it can still be the cheaper choice. How to compare air and sea for a Nepal shipment on total cost, time and risk.",
    intro: "Air freight is the expensive option per kilo. Looked at as a whole, including what waiting costs, it is sometimes the cheaper one.",
    published,
    cover: "airport-dollies",
    coverCaption: "Air wins when the cost of waiting is higher than the cost of flying.",
    sections: [
      {
        title: "What sea really takes",
        blocks: [
          { type: "p", text: "A sea shipment to Nepal includes the ocean leg, the time at the Indian port, the transit to Birgunj, customs clearance and delivery. Door to door, that is usually weeks. Each stage can add days, and the costs at the gateway and the dry port are on top of the ocean rate." },
          { type: "p", text: "Air into Kathmandu is usually days, with fewer hand-overs and the clearance close to most buyers. The rate per kilo is much higher." },
        ],
      },
      {
        title: "When air makes sense",
        blocks: [
          { type: "list", items: [
            "A machine is stopped waiting for a part, and every day costs production",
            "Goods are high in value and low in weight, so freight is a small share of the price",
            "The order has a fixed date: a launch, a season or a project milestone",
            "Samples and first orders, where speed decides whether there is a second order",
            "Small shipments, where sea minimums and fixed charges make sea expensive",
          ] },
        ],
      },
      {
        title: "A fair comparison",
        blocks: [
          { type: "p", text: "Compare total costs, door to door: freight, local charges at both ends, insurance, and the money tied up in stock while the goods travel. Then add what a delay would cost you. If the difference between air and sea is less than the cost of the weeks saved, air is the cheaper option." },
          { type: "p", text: "Many importers split orders: the bulk by sea on a planned schedule, and a small part by air to cover the gap until the sea shipment arrives." },
        ],
      },
      {
        title: "When air is not possible",
        blocks: [
          { type: "p", text: "Very large or heavy pieces may not fit the aircraft flying the route, and some dangerous goods cannot travel on passenger aircraft at all. Ask before you plan on air for anything bulky, heavy or hazardous." },
        ],
      },
    ],
    questions: [
      { question: "Can I split one order between air and sea?", answer: "Yes. Many importers fly a small part to cover immediate needs and send the bulk by sea. Each part needs its own documents and clearance." },
      { question: "Is air freight more reliable than sea?", answer: "It is usually faster and has fewer hand-overs, but flights can be cancelled or cargo offloaded. For critical shipments, ask about backup routings." },
      { question: "Does air cargo pay less duty?", answer: "The duty rate is the same. The customs value includes freight to the customs point, so a higher air freight cost can raise the value slightly." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu", "sea-freight-through-india"], tool: "volume-weight" },
  },
  {
    slug: "importing-by-air-into-kathmandu",
    topic: "air",
    title: "Importing by air into Kathmandu: landing to release",
    description: "What happens after an air import lands at Kathmandu's airport: the arrival notice, documents, customs, duty, storage and collection, and how to speed it.",
    intro: "An air shipment can fly to Kathmandu in a day or two and still wait at the airport for longer. What happens after landing decides when it reaches you.",
    published,
    cover: "kathmandu",
    coverCaption: "The flight is the fast part. Release depends on the papers.",
    sections: [
      {
        title: "After the flight lands",
        blocks: [
          { type: "steps", items: [
            { title: "Arrival", copy: "The cargo is unloaded and moved into the import cargo area at Tribhuvan International Airport. The airline or forwarder sends an arrival notice." },
            { title: "Documents", copy: "The air waybill, commercial invoice, packing list and any permits are given to the customs agent, who prepares the declaration." },
            { title: "Customs", copy: "Customs checks the declaration, assesses duty and VAT, and may examine the cargo." },
            { title: "Payment", copy: "Duty, VAT and the airport and handling charges are paid." },
            { title: "Release", copy: "The cargo is released for collection or delivery." },
          ] },
        ],
      },
      {
        title: "What slows it",
        blocks: [
          { type: "list", items: [
            "Original documents that did not travel with the cargo or were not sent ahead",
            "A permit the goods need that has not been issued",
            "Descriptions too vague for customs to classify",
            "Duty and VAT not ready to be paid",
            "Arrival just before a weekend or a public holiday",
          ] },
          { type: "p", text: "Cargo left at the airport after its free period pays storage. For urgent goods, the hours after landing matter as much as the flight." },
        ],
      },
      {
        title: "Getting it out quickly",
        blocks: [
          { type: "p", text: "Ask the supplier to send scans of the invoice, packing list and air waybill the day the shipment flies. Your customs agent can then check the classification, estimate the duty and prepare the declaration before landing. For regulated goods, have the permit in hand before the supplier ships." },
          { type: "p", text: "For door delivery, give the address, the receiving hours and a contact who will be there. A courier who cannot deliver brings the cargo back, and tries again tomorrow." },
        ],
      },
    ],
    questions: [
      { question: "How long is the free storage period at the airport?", answer: "Free periods and storage rates are set by the cargo terminal and can change. Ask your forwarder for the current terms, and plan to clear within them." },
      { question: "Can I collect the cargo myself?", answer: "You can, once it is cleared and released, with the right authorisation. Many importers prefer door delivery to save the trip and the handling." },
      { question: "Does air cargo get inspected more often?", answer: "Customs selection depends on the goods, the documents and risk, not the mode. Complete papers reduce questions whatever the mode." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu", "customs-clearance-in-nepal"], tool: "duty-estimate" },
  },
  {
    slug: "reading-an-air-waybill",
    topic: "air",
    title: "Reading an air waybill",
    description: "The air waybill is the contract and the receipt for an air shipment. What each part shows, what to check, and how to track a shipment with its number.",
    intro: "Every air shipment travels under an air waybill. Knowing what its boxes mean helps you check a shipment, track it and spot an error before it costs time.",
    published,
    cover: "clipboard-sign",
    coverCaption: "The air waybill number is the one to quote whenever you ask about the shipment.",
    sections: [
      {
        title: "What it is",
        blocks: [
          { type: "p", text: "The air waybill, or AWB, is the contract of carriage between the shipper and the airline, and the airline's receipt for the goods. Unlike a bill of lading, it is not a document of title: the cargo is delivered to the consignee named on it, without surrendering the waybill." },
        ],
      },
      {
        title: "The number",
        blocks: [
          { type: "p", text: "An air waybill number has eleven digits. The first three identify the airline. The remaining eight are the serial number. You can track a shipment on the airline's website with the full number, which is why it is the one to quote." },
          { type: "p", text: "When a forwarder consolidates cargo, there is a master air waybill from the airline and a house air waybill from the forwarder. The airline tracks the master. Your forwarder tracks your house waybill within it." },
        ],
      },
      {
        title: "Fields to check",
        blocks: [
          { type: "list", items: [
            "Shipper and consignee: names and addresses exactly as the customs documents show them",
            "Airports of departure and destination, and the routing",
            "Number of pieces and gross weight, matching the packing list",
            "Chargeable weight and the rate applied",
            "Nature and quantity of goods, with dimensions or volume",
            "Handling information, such as dangerous goods or perishable notes",
            "Whether charges are prepaid by the shipper or collect from the consignee",
          ] },
        ],
      },
      {
        title: "Errors that cause trouble",
        blocks: [
          { type: "p", text: "A wrong consignee name means the cargo cannot be released to the person who needs it. A piece count that differs from what arrives starts a discrepancy report. A description that does not match the invoice draws customs questions. Check a draft or copy before the shipment flies, while corrections are simple." },
        ],
      },
    ],
    questions: [
      { question: "Can an air waybill be amended after the flight?", answer: "Some details can be corrected through the airline, but it takes time and may cost a fee. Changes to the consignee are the hardest." },
      { question: "Is the air waybill needed to collect cargo?", answer: "The consignee named on it collects the cargo with identification and any required authorisation. The original waybill does not need to be surrendered as a bill of lading would." },
      { question: "What does prepaid or collect mean?", answer: "Prepaid means the shipper pays the freight. Collect means the consignee pays it at destination. Check it matches the Incoterm." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"] },
  },
  {
    slug: "dangerous-goods-by-air",
    topic: "air",
    title: "Dangerous goods by air: what changes the booking",
    description: "Paints, chemicals, batteries and many everyday products are dangerous goods by air. What the rules ask of the shipper, and why review comes first.",
    intro: "Many ordinary products are dangerous goods in the air: paints, adhesives, perfumes, aerosols, batteries, some chemicals. Shipping them is possible, but only on the rules' terms.",
    published,
    cover: "airport-dollies",
    coverCaption: "Dangerous goods are accepted only when they are classified, packed and declared correctly.",
    sections: [
      {
        title: "How goods are classified",
        blocks: [
          { type: "p", text: "Air transport of dangerous goods follows the rules set by the international civil aviation bodies and published for the industry by the airlines' association. Goods are sorted into nine classes, such as flammable liquids, gases and corrosives, and each substance has a UN number. The safety data sheet from the manufacturer usually gives the classification." },
        ],
      },
      {
        title: "What the shipper must do",
        blocks: [
          { type: "list", items: [
            "Provide the safety data sheet for the product",
            "Use packaging approved for that substance and quantity",
            "Mark and label each package as the rules require",
            "Sign a shipper's declaration for dangerous goods, prepared by trained staff",
            "Stay within the quantity limits per package and per aircraft type",
          ] },
          { type: "p", text: "Some goods may fly only on cargo aircraft, not in passenger planes. Some may not fly at all. Many routes out of Kathmandu use passenger aircraft, which narrows the options." },
        ],
      },
      {
        title: "Review before booking",
        blocks: [
          { type: "p", text: "A dangerous goods shipment is accepted only after the forwarder and the airline have reviewed it. Send the safety data sheet, the quantity and the packaging details before you ask for a price. KCPL accepts dangerous goods only after that review and written confirmation, because a shipment refused at the airport costs more than one that was planned." },
        ],
      },
      {
        title: "Do not hide it",
        blocks: [
          { type: "p", text: "Declaring dangerous goods as general cargo to save time or money is dangerous and illegal. Screening finds many undeclared items, and the penalties fall on the shipper. When in doubt, ask." },
        ],
      },
    ],
    questions: [
      { question: "Are perfumes and paints really dangerous goods?", answer: "Many are, because they contain flammable liquids. The safety data sheet decides it. If in doubt, assume a check is needed." },
      { question: "Can dangerous goods go as consolidated cargo?", answer: "Some can, if the consolidator accepts them and the packing and paperwork are correct. Others must travel separately or on cargo aircraft." },
      { question: "Does dangerous goods shipping cost more?", answer: "Usually yes, because of the specialist packing, documentation, handling and fewer routing options." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu", "exporting-from-nepal"] },
  },
  {
    slug: "lithium-batteries-in-air-cargo",
    topic: "air",
    title: "Lithium batteries in air cargo",
    description: "Phones, laptops, tools and solar kits contain lithium batteries, which changes how they fly. What shippers to and from Nepal must declare and pack.",
    intro: "Lithium batteries are in phones, laptops, power tools, solar equipment and scooters. In air cargo they are dangerous goods, with rules that depend on how they are packed.",
    published,
    cover: "airport-dollies",
    coverCaption: "Battery shipments are checked closely at every airport they pass through.",
    sections: [
      {
        title: "Why batteries are regulated",
        blocks: [
          { type: "p", text: "A damaged or short-circuited lithium battery can overheat and catch fire, and such fires are hard to put out in an aircraft hold. Air rules therefore control how batteries are packed, how much charge they carry and which aircraft can take them." },
        ],
      },
      {
        title: "Three ways batteries travel",
        blocks: [
          { type: "steps", items: [
            { title: "Batteries on their own", copy: "Loose batteries, such as spare packs or cells, face the strictest rules. Lithium-ion batteries shipped alone generally cannot travel on passenger aircraft, and limits apply to their state of charge." },
            { title: "Packed with equipment", copy: "Batteries in the same box as the device they power, but not installed. Rules are lighter, with limits per package." },
            { title: "Contained in equipment", copy: "Batteries installed in the device, such as a laptop or phone. The most common case, with the lightest rules, though marking and limits still apply." },
          ] },
          { type: "p", text: "Lithium metal batteries, the non-rechargeable kind, have their own entries and rules. The battery type and its watt-hour or lithium content decide which apply." },
        ],
      },
      {
        title: "What to send your forwarder",
        blocks: [
          { type: "list", items: [
            "The battery type: lithium-ion or lithium metal",
            "Whether batteries are loose, packed with or contained in equipment",
            "The watt-hour rating or lithium content per battery",
            "The number of batteries per package and in total",
            "The test summary the manufacturer provides for the battery design",
          ] },
        ],
      },
      {
        title: "Plan for the route",
        blocks: [
          { type: "p", text: "Because many flights from Kathmandu use passenger aircraft, some battery shipments have fewer routing options, and some must go by sea or road instead. Ask before you promise a delivery date for anything with large batteries, such as solar storage or electric vehicle parts." },
        ],
      },
    ],
    questions: [
      { question: "Can I ship a power bank by air cargo?", answer: "Power banks are lithium batteries shipped on their own, which face the strictest rules. They are often refused on passenger aircraft. Ask before you ship." },
      { question: "Do laptops count?", answer: "Yes. Batteries installed in equipment are still regulated, though under lighter rules. Commercial shipments of laptops need correct marking and documents." },
      { question: "What is the test summary?", answer: "A document from the battery manufacturer confirming the battery design passed the required safety tests. Carriers ask for it." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"] },
  },
  {
    slug: "perishable-cargo-by-air",
    topic: "air",
    title: "Perishable cargo by air: timing is the packaging",
    description: "Fresh produce, flowers and other perishables lose value every hour in transit. How to plan perishable air cargo to and from Nepal, packing to flight.",
    intro: "For perishable cargo, every hour between harvest and delivery costs quality. Air shortens the journey, but only a tight plan makes the shortened journey work.",
    published,
    cover: "airport-dollies",
    coverCaption: "Perishables wait at airports. The plan decides how long.",
    sections: [
      {
        title: "Where the time goes",
        blocks: [
          { type: "p", text: "The flight is often the shortest part of a perishable shipment's journey. Time is lost at collection, at export screening and customs, waiting for the flight, at transfer hubs, and at import clearance on arrival. Each wait happens at whatever temperature the airport happens to be." },
        ],
      },
      {
        title: "Planning the chain",
        blocks: [
          { type: "list", items: [
            "Book space before harvest or packing, so the goods do not wait for a flight",
            "Pack to protect against heat, cold and crushing, with the product's needs in mind",
            "Have plant health or other certificates ready before the goods reach the airport",
            "Choose routings with short connections and reliable transfers",
            "Tell the consignee the flight details so the goods are cleared and collected at once",
          ] },
        ],
      },
      {
        title: "What to agree in writing",
        blocks: [
          { type: "p", text: "Agree what happens if a flight is cancelled or the cargo is offloaded: who decides, how fast, and who pays. Perishables do not wait well for a decision. KCPL handles perishable cargo only after reviewing the product, the packing and the routing, and it does not offer temperature-controlled storage for life-science products, so plan that part with the right specialist." },
        ],
      },
      {
        title: "Into Nepal",
        blocks: [
          { type: "p", text: "Perishable imports into Kathmandu, such as food products, may need quarantine or food safety checks before release. Confirm what is required for your product before it ships, so the inspection is arranged for the day it lands rather than the day after." },
        ],
      },
    ],
    questions: [
      { question: "Can perishables be stored at Kathmandu airport?", answer: "Facilities and space vary. Plan so perishables move straight from clearance to delivery rather than waiting at the airport." },
      { question: "Who decides if spoiled goods are disposed of?", answer: "The owner, customs and sometimes health authorities. Have a decision-maker available while the shipment travels." },
      { question: "Is insurance available for perishables?", answer: "Yes, but often with conditions on packing, temperature and delay. Read the exclusions carefully." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"] },
  },
  {
    slug: "urgent-spares-into-nepal",
    topic: "air",
    title: "Urgent spares into Nepal: planning a breakdown shipment",
    description: "When a machine or aircraft stops for want of a part, the shipment is measured in hours. How to move urgent spares into Nepal without losing a day.",
    intro: "A stopped production line, a failed turbine part or an aircraft on the ground all have one thing in common: every hour without the part costs more than the freight.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "For urgent spares, the plan starts before the part is packed.",
    sections: [
      {
        title: "Speed is mostly paperwork",
        blocks: [
          { type: "p", text: "The fastest flight does not help if the part waits at customs for a missing document. For urgent spares, the paperwork is prepared in parallel with the packing: the invoice, the packing list, the air waybill and the customs declaration are all drafted before the part reaches the airport." },
        ],
      },
      {
        title: "What to have ready",
        blocks: [
          { type: "list", items: [
            "A clear description of the part, its function and the machine it belongs to",
            "The part number and, where possible, the HS code",
            "A value on the invoice, even if the part is supplied under warranty",
            "The consignee's details exactly as registered",
            "Any permit the part needs, such as for radio or aviation equipment",
            "A contact at the site who can receive the part at any hour",
          ] },
          { type: "p", text: "Warranty replacements are a common snag. Customs values goods whether or not they were paid for, so a free part still needs a value for customs, with a note that it is a no-charge replacement." },
        ],
      },
      {
        title: "Choosing the route",
        blocks: [
          { type: "p", text: "For urgent spares, the routing that arrives first is not always the one that leaves first. Look at the connections, the cut-off times at each hub and the arrival time in Kathmandu against customs working hours. A shipment that lands at night may not clear until morning." },
          { type: "p", text: "For repeated risks, such as critical parts for a power plant or an aircraft, agree a standing plan with your forwarder: who to call, which suppliers, what documents. Then a breakdown starts a known process rather than a scramble." },
        ],
      },
    ],
    questions: [
      { question: "Can urgent spares clear customs outside working hours?", answer: "It depends on the office and the arrangements available at the time. Ask your customs agent in advance rather than on the night." },
      { question: "Is a hand-carried part faster?", answer: "Sometimes, for small parts, a person travelling with the part can be quickest. It still needs to be declared properly at customs." },
      { question: "Do warranty parts pay duty?", answer: "Duty is assessed on the customs value of the goods, whether or not they were paid for. Some exemptions may apply in specific cases, so check with your agent." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu", "customs-clearance-in-nepal"] },
  },
  {
    slug: "carting-an-air-export-at-kathmandu",
    topic: "air",
    title: "Carting an air export at Kathmandu",
    description: "Before an air export leaves Kathmandu it is carted, screened, cleared and accepted. What happens in those hours, and how not to miss the flight.",
    intro: "Booking the flight is the start. Before an export leaves Kathmandu, it has to be delivered to the airport, cleared, screened and accepted, all before the cut-off.",
    published,
    cover: "airport-dollies",
    coverCaption: "An export is ready to fly only when the airline has accepted it.",
    sections: [
      {
        title: "The steps before the flight",
        blocks: [
          { type: "steps", items: [
            { title: "Booking", copy: "Space is confirmed on a flight, with the weight and dimensions of the shipment." },
            { title: "Export customs", copy: "The export declaration is filed with the invoice and packing list, and Nepal customs clears the goods for export." },
            { title: "Carting", copy: "The cargo is delivered to the airport's export cargo area, weighed and measured." },
            { title: "Screening", copy: "Cargo is security screened before it can be loaded on an aircraft." },
            { title: "Acceptance", copy: "The airline checks the cargo against the air waybill and the booking, and accepts it for the flight." },
          ] },
        ],
      },
      {
        title: "Why exports miss flights",
        blocks: [
          { type: "list", items: [
            "Cargo arrives after the airline's acceptance cut-off",
            "Weight or dimensions differ from the booking, and space no longer fits",
            "Packages fail screening, or must be opened",
            "The export declaration is not complete",
            "Labels and marks are missing or wrong",
          ] },
        ],
      },
      {
        title: "Building the plan backwards",
        blocks: [
          { type: "p", text: "Start from the flight and work back: the airline's cut-off, the time to screen and accept, the export clearance, the drive to the airport, the packing. Add a margin for traffic and for a busy cargo terminal. A booking built backwards from the ready date, not forwards from a flight, is far less likely to miss." },
        ],
      },
      {
        title: "Tell the buyer",
        blocks: [
          { type: "p", text: "Once the shipment flies, send the buyer and the destination agent the air waybill, the flight details and the documents. A dispatch message with the number of packages, the weight and the expected arrival lets them prepare the import clearance before the cargo lands." },
        ],
      },
    ],
    questions: [
      { question: "How early should cargo reach the airport?", answer: "Early enough for export clearance, screening and acceptance before the airline's cut-off. Ask your forwarder for the cut-off of your flight and add a margin." },
      { question: "What if my cargo fails screening?", answer: "It may be opened and checked, which takes time. Clear, honest descriptions and plain packing reduce delays." },
      { question: "Can I change the flight after carting?", answer: "It may be possible, but the cargo has already been accepted for a flight, so a change means rebooking and sometimes extra charges." },
    ],
    related: { service: service.air, guides: ["exporting-from-nepal", "air-freight-to-kathmandu"] },
  },
  {
    slug: "consolidated-air-cargo",
    topic: "air",
    title: "Consolidated air cargo: the house air waybill",
    description: "Forwarders combine shipments under one master air waybill to get better rates. What consolidation means for your price, tracking and arrival date.",
    intro: "Most air cargo does not travel under its own airline waybill. It is consolidated with other shipments by a forwarder, and that changes how you track it.",
    published,
    cover: "airport-dollies",
    coverCaption: "One master air waybill can cover many shippers' cargo.",
    sections: [
      {
        title: "How consolidation works",
        blocks: [
          { type: "p", text: "A forwarder collects shipments from several shippers going to the same destination and books them with the airline as one. The airline issues a master air waybill to the forwarder's agent at the destination. The forwarder issues each shipper a house air waybill. At the destination, the agent breaks the consolidation down and releases each house shipment to its consignee." },
        ],
      },
      {
        title: "Why it is used",
        blocks: [
          { type: "list", items: [
            "Airline rates per kilo fall as weight rises, so combined cargo earns a lower rate",
            "Small shipments avoid the airline's minimum charges",
            "The forwarder manages the booking, screening and acceptance for all of it",
          ] },
        ],
      },
      {
        title: "What it means for you",
        blocks: [
          { type: "p", text: "Your house waybill number is the reference for your shipment, but the airline's tracking shows the master. Ask your forwarder for both, and for updates at departure and arrival. At the destination, your cargo is released after the consolidation is broken down, which can add a little time compared with a direct shipment." },
          { type: "p", text: "Consolidations may wait for a set departure day. For urgent goods, ask whether the shipment will fly on the next flight or on the next consolidation, and what the difference costs." },
        ],
      },
      {
        title: "Papers still matter",
        blocks: [
          { type: "p", text: "A consolidation is many shipments, each with its own consignee and its own customs clearance. A problem with one does not usually hold the others, but it can slow the break-down. Clean, matching documents on your shipment keep it out of the queue." },
        ],
      },
    ],
    questions: [
      { question: "Can I ask for a direct air waybill instead?", answer: "Yes, a forwarder can book a shipment directly with the airline. It may cost more for small shipments but avoids waiting for a consolidation." },
      { question: "Who releases my cargo at destination?", answer: "The forwarder's agent at the destination, after the airline releases the consolidation to it." },
      { question: "Is a house air waybill a legal document?", answer: "Yes. It is the forwarder's contract of carriage with you and its receipt for your goods." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"] },
  },
  {
    slug: "packing-for-air-cargo",
    topic: "air",
    title: "Packing for air cargo: weight, stacking and pallets",
    description: "Air cargo is handled fast and stacked tight. How to pack for the hold: carton strength, pallets, piece size limits and marks that survive the journey.",
    intro: "Air cargo moves fast and is handled by many people and machines. Packing that would be fine on a truck can fail in an aircraft hold.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "Cargo is built onto pallets and containers that must fit the shape of the aircraft.",
    sections: [
      {
        title: "Built for stacking",
        blocks: [
          { type: "p", text: "Airlines build cargo into unit load devices: pallets and containers shaped to fit the aircraft. Your cartons will be stacked with other cargo, and have other cargo stacked on them. Use strong cartons, fill them so they do not collapse, and avoid odd shapes that cannot be stacked." },
        ],
      },
      {
        title: "Size and weight limits",
        blocks: [
          { type: "list", items: [
            "Every aircraft has door sizes and hold heights that limit the largest piece",
            "Heavy pieces need floor loading limits checked, and sometimes spreader boards",
            "Passenger aircraft holds take smaller pieces than freighters",
            "Pieces that need a forklift should be on a pallet with entry points",
          ] },
          { type: "p", text: "Send the dimensions and weight of the largest piece when you ask for a quote. It may decide which flights can take the shipment at all." },
        ],
      },
      {
        title: "Pallets",
        blocks: [
          { type: "p", text: "Palletising many small cartons protects them and speeds handling. Wrap the load, strap it to the pallet and keep it within the pallet's edges. Wooden pallets for international shipments should be heat-treated and marked to the international standard, or many destinations will refuse or treat them." },
        ],
      },
      {
        title: "Marks",
        blocks: [
          { type: "list", items: [
            "The air waybill number on every piece",
            "Consignee name and destination airport",
            "Piece number of total, such as 3 of 10",
            "Handling labels where they apply: fragile, this way up, keep dry",
            "Dangerous goods marks and labels, only where the goods are declared as such",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Are wooden crates allowed?", answer: "Yes, if they are strong enough and, for international shipments, made of treated and marked wood or processed wood." },
      { question: "Can cargo be loaded on its side?", answer: "Unless marked otherwise, handlers may turn cartons to fit. Use orientation labels and strong packing for goods that must stay upright." },
      { question: "Does packing affect the price?", answer: "Yes. Packing adds weight and volume, and air freight charges for both. Pack for protection without wasting space." },
    ],
    related: { service: service.warehouse, guides: ["air-freight-to-kathmandu"], tool: "volume-weight" },
  },
  {
    slug: "courier-or-air-cargo",
    topic: "air",
    title: "Courier or air cargo? Where the line falls",
    description: "Courier and air cargo both fly, but they are priced and cleared differently. How to choose for shipments to and from Nepal by weight, value and urgency.",
    intro: "A courier picks up and delivers door to door, with one price. Air cargo moves airport to airport, with more steps and a lower rate. The right one depends on the size of the shipment.",
    published,
    cover: "airport-dollies",
    coverCaption: "Small parcels suit couriers. Larger shipments are usually cheaper as cargo.",
    sections: [
      {
        title: "How they differ",
        blocks: [
          { type: "steps", items: [
            { title: "Courier", copy: "Collection, flight, customs and delivery under one service and one price. Simple, fast and tracked, but priced for small parcels, with volume weight often calculated more strictly." },
            { title: "Air cargo", copy: "Booked through a forwarder, with separate export and import clearance and handling at each airport. More steps, but much cheaper per kilo as the shipment grows." },
          ] },
        ],
      },
      {
        title: "Where the line falls",
        blocks: [
          { type: "p", text: "For documents, samples and small parcels, a courier is usually cheaper and simpler. As the weight grows into tens of kilos, air cargo rates start to win, even after adding clearance and delivery. The exact crossover depends on the route, the goods and the courier's pricing, so ask for both once a shipment is more than a few cartons." },
        ],
      },
      {
        title: "Customs is not the same",
        blocks: [
          { type: "p", text: "Couriers clear goods through their own processes, which suit low-value parcels. Commercial shipments with higher values, regulated goods or duty to pay are often better cleared as cargo, with a customs agent who prepares the declaration properly. A commercial shipment sent by courier can still be held for full formal clearance." },
        ],
      },
      {
        title: "A simple rule",
        blocks: [
          { type: "list", items: [
            "Small, light and urgent: courier",
            "Several cartons, or a pallet: air cargo",
            "Regulated, dangerous or high-value goods: talk to a forwarder first",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can a courier handle dangerous goods?", answer: "Some couriers accept certain dangerous goods under strict conditions. Many refuse them. Ask before booking." },
      { question: "Does a courier clear Nepal customs for me?", answer: "Couriers handle the clearance of their parcels, but duties and taxes still apply, and commercial goods may need a full declaration." },
      { question: "Which is easier for samples?", answer: "For small samples, a courier is usually simpler and faster." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu"], tool: "volume-weight" },
  },
];
