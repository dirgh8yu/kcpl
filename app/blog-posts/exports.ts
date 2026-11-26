import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const exportPosts: readonly BlogPost[] = [
  {
    slug: "exporting-carpets-by-air",
    topic: "exports",
    title: "Exporting hand-knotted carpets from Nepal by air",
    description: "How hand-knotted carpets leave Kathmandu by air: packing rolls, weights and sizes, the air waybill, buyer documents and delivery to a showroom abroad.",
    intro: "Hand-knotted carpets are among Nepal's best-known exports. They are heavy, valuable and awkward to handle, and the way they are packed decides how they arrive.",
    published,
    cover: "rug-hands",
    coverCaption: "Weeks of work go into a carpet. The packing should protect it for the few days it travels.",
    sections: [
      {
        title: "Why carpets often go by air",
        blocks: [
          { type: "p", text: "Buyers abroad often order carpets in small lots, against a showroom launch, a client order or a trade fair. Air from Kathmandu gets them there in days rather than weeks, and the value of a hand-knotted carpet usually carries the freight cost. Larger and less urgent orders can go by sea through Kolkata." },
        ],
      },
      {
        title: "Packing that survives the journey",
        blocks: [
          { type: "list", items: [
            "Roll each carpet pile inward, around a sturdy core, rather than folding it",
            "Wrap in polythene against moisture, then in hessian or strong woven sacking",
            "Strap or stitch the roll so it cannot unroll in handling",
            "Label each roll with the carpet number, size, weight and destination",
            "Keep rolls dry before carting: a damp carpet in a sealed wrap can mark or smell",
          ] },
          { type: "p", text: "Rolls are handled by hand and by forklift many times between Kathmandu and the buyer. A tight, well-wrapped roll stays clean and keeps its shape. A loose one arrives creased and dirty." },
        ],
      },
      {
        title: "Weight and the bill",
        blocks: [
          { type: "p", text: "Air freight is charged on the greater of the actual weight and the volume weight. Rolled carpets are dense, so they are usually charged on actual weight, but long rolls can still trip the volume calculation. Measure each roll as packed, including the wrapping, and use those figures for the quote." },
          { type: "p", text: "Very long rolls also need to fit the aircraft. Ask about length limits when the carpets are larger than usual, because a roll that fits a freighter may not fit the hold of a passenger aircraft." },
        ],
      },
      {
        title: "Documents the buyer will need",
        blocks: [
          { type: "list", items: [
            "A commercial invoice describing each carpet: material, knot count or quality, size and value",
            "A packing list with each roll's number, size and weight",
            "The air waybill",
            "A certificate of origin, if the buyer claims a preferential duty rate",
          ] },
          { type: "p", text: "Send copies to the buyer and the destination agent the day the shipment flies, with the flight details, so the import clearance can be prepared before it lands." },
        ],
      },
    ],
    questions: [
      { question: "Should carpets be folded to save space?", answer: "Hand-knotted carpets are normally rolled, pile inward, because folding can leave lasting creases and strain the foundation. Ask the buyer if they have a preference, and follow it." },
      { question: "Can carpets go by sea instead?", answer: "Yes. Larger orders, and buyers who can wait weeks, often ship by sea through Kolkata, as LCL or in a full container. Keep rolls dry and well wrapped, because sea transit is long and humid." },
      { question: "Do buyers need a certificate of origin?", answer: "Only if they want to claim a preferential duty rate in their country, or their contract or bank requires one. Ask the buyer which form, if any, before the goods ship." },
    ],
    related: { service: service.air, guides: ["exporting-from-nepal", "air-freight-to-kathmandu"], tool: "volume-weight" },
  },
  {
    slug: "shipping-felt-products",
    topic: "exports",
    title: "Shipping felt from Nepal: light cargo, big volume",
    description: "Felt products are light and bulky, so freight is charged on space, not weight. How Nepal felt exporters can pack, choose a mode and keep costs down.",
    intro: "Felt balls, slippers, bags and décor are light for their size. That simple fact drives almost every freight decision a felt exporter makes.",
    published,
    cover: "warp-threads",
    coverCaption: "Wool goods are light, so carriers charge them by the space they take.",
    sections: [
      {
        title: "Volume decides the price",
        blocks: [
          { type: "p", text: "Carriers charge for whichever is greater: the weight, or the space. Air freight uses a volume weight worked out from the carton dimensions, and sea LCL charges by the cubic metre. Felt nearly always pays on space. A carton of felt balls that weighs eight kilos can be charged as if it weighed more than twice that by air." },
        ],
      },
      {
        title: "Packing to save space",
        blocks: [
          { type: "list", items: [
            "Fill cartons completely: air in a carton is paid for",
            "Choose carton sizes that stack well on a standard pallet",
            "Ask whether products can be compressed or bagged without damage",
            "Nest products that nest, such as bowls and baskets",
            "Avoid oversized outer cartons around smaller inner ones",
          ] },
          { type: "p", text: "Test any compression on a sample first. Felt that comes out of a bag flattened or creased is a returned order, not a freight saving." },
        ],
      },
      {
        title: "Air or sea",
        blocks: [
          { type: "p", text: "Small, urgent orders and samples usually fly. Larger orders, especially to the United States, Europe and Australia, often go by sea through Kolkata, as LCL or a full container. Because felt is light, a full 40-foot or high cube container can hold a large order at a far lower cost per item than air." },
          { type: "p", text: "Compare door-to-door prices and dates, not just the freight line. Sea LCL carries handling charges at both ends, and some destinations add charges for small consignments." },
        ],
      },
      {
        title: "What buyers ask for",
        blocks: [
          { type: "p", text: "Retail buyers often have their own rules for cartons, labels and documents, and may nominate their own forwarder. Read the buyer's routing guide before you pack, because relabelling cartons at the port is slow and charged." },
        ],
      },
    ],
    questions: [
      { question: "Is felt treated as dangerous goods?", answer: "No. Plain wool felt is general cargo. Felt items with batteries, lights or chemical treatments may need checking, so describe the products fully." },
      { question: "Why is my air quote higher than the weight suggests?", answer: "Because felt is charged on volume weight, which for light, bulky goods is greater than the actual weight. Smaller, fuller cartons bring the charge down." },
      { question: "Can felt be shipped on pallets?", answer: "Yes, and for sea or large air shipments pallets protect cartons and speed handling. Wooden pallets should be treated and marked to the international standard." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal"], tool: "volume-weight" },
  },
  {
    slug: "lcl-export-nepal-to-usa",
    topic: "exports",
    title: "LCL from Nepal to the USA: Birgunj to a US door",
    description: "How a shared-container export travels from Nepal to the United States: transit to Kolkata, carting, US filings, the ocean leg and inland delivery.",
    intro: "Many Nepal exporters ship to American buyers in quantities too small for a full container. This is how an LCL shipment gets from Nepal to a US warehouse.",
    published,
    cover: "ship-aerial",
    coverCaption: "Nepal's sea exports join mainline ships at an Indian port, often transshipping on the way.",
    sections: [
      {
        title: "The journey",
        blocks: [
          { type: "steps", items: [
            { title: "Export clearance in Nepal", copy: "The goods are declared for export and cleared by Nepal customs, with the invoice, packing list and any certificates." },
            { title: "Transit to Kolkata", copy: "The cargo travels through India in transit to Kolkata, with a customs transit declaration, by truck or rail." },
            { title: "Carting at the CFS", copy: "The cargo is delivered into the consolidator's container freight station before its cut-off, where it is loaded into a shared container." },
            { title: "US filings and the bill", copy: "The data for the US advance filings is sent, the draft bill of lading is approved, and the final bill is issued." },
            { title: "The ocean leg", copy: "The container sails, often transshipping at a hub, to a US port." },
            { title: "Delivery in the US", copy: "The buyer's customs broker clears the goods, and a trucker delivers to the warehouse." },
          ] },
        ],
      },
      {
        title: "The deadlines that matter",
        blocks: [
          { type: "p", text: "The CFS cut-off in Kolkata is fixed by the consolidator, and the transit from Nepal has to fit in front of it. Count backwards from that cut-off: the transit days, the export clearance, the collection from your factory. Missing the cut-off usually means waiting for the next sailing a week later." },
          { type: "p", text: "The US filings have their own deadline, before the cargo is loaded abroad. Late or missing filing data stops cargo from loading, so send it as soon as the booking is confirmed." },
        ],
      },
      {
        title: "What the buyer's side needs",
        blocks: [
          { type: "list", items: [
            "Commercial invoice and packing list in English, matching each other",
            "Product descriptions specific enough for US customs classification",
            "The manufacturer's and seller's names and addresses for the US filing",
            "Carton marks and labels to the buyer's routing guide",
            "The final delivery address and any appointment rules at the warehouse",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Who pays for the US customs clearance?", answer: "Under most terms, the US buyer appoints a customs broker and pays duties and clearance at the US end. If you sell delivered with duty paid, you take on those costs." },
      { question: "How long does LCL from Nepal to the US take?", answer: "Usually weeks, depending on the CFS schedule in Kolkata, transshipment and inland delivery in the US. Ask for the current sailing schedule and realistic door-to-door times." },
      { question: "Can a full container be cheaper?", answer: "For larger orders, yes. Compare the LCL and FCL prices once your volume gets near half a container." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "ams-and-isf-for-nepal-exporters",
    topic: "exports",
    title: "AMS and ISF: US filings Nepal exporters are asked for",
    description: "US-bound cargo needs data filed with US customs before it loads abroad. What AMS and ISF are, what a Nepal shipper supplies, and why timing matters.",
    intro: "Ship to the United States by sea and someone will ask for ISF data. It is a filing the buyer's side makes, and it depends on information only the shipper has.",
    published,
    cover: "ship-terminal",
    coverCaption: "US-bound cargo cannot be loaded until the advance filings are made.",
    sections: [
      {
        title: "Two filings",
        blocks: [
          { type: "steps", items: [
            { title: "AMS", copy: "The Automated Manifest System filing is made by the carrier or the forwarder issuing the bill of lading. It declares the cargo to US customs before it is loaded on the ship abroad." },
            { title: "ISF", copy: "The Importer Security Filing, often called 10+2, is made for the US importer, usually by its customs broker. It must also be filed before loading, and has its own penalties for late or wrong data." },
          ] },
          { type: "p", text: "Neither is filed by the Nepal exporter. Both need information from the Nepal side, and if it is late, the cargo is not loaded." },
        ],
      },
      {
        title: "What the shipper is asked for",
        blocks: [
          { type: "list", items: [
            "The seller's and the manufacturer's names and addresses",
            "The country of origin of the goods",
            "The HS code of each product, to at least six digits",
            "Where the container is stuffed, and by whom",
            "The consolidator, for LCL",
            "The buyer and ship-to party, as the buyer has confirmed them",
          ] },
        ],
      },
      {
        title: "Why it is often late",
        blocks: [
          { type: "p", text: "On an export from Nepal, the cargo is loaded on the ocean vessel at an Indian port, days after it leaves the factory. Everyone assumes there is plenty of time. Then the buyer's forwarder asks for the filing data the day before the vessel cut-off, and the details are in someone's inbox in Kathmandu." },
          { type: "p", text: "Send the filing data with the booking, not with the bill of lading. If the buyer's forwarder has a form, fill it in once and keep it for repeat orders." },
        ],
      },
      {
        title: "Getting the details right",
        blocks: [
          { type: "p", text: "The names, addresses and codes in the filings must agree with the commercial invoice and the bill of lading. A manufacturer listed as the exporter's trading company, or an HS code that differs from the invoice, can lead to holds and penalties at the US end, which the buyer will raise with the shipper." },
        ],
      },
    ],
    questions: [
      { question: "Do I need to file anything myself?", answer: "Usually no. The carrier or forwarder files the AMS, and the importer's broker files the ISF. You provide accurate, timely information." },
      { question: "What happens if the data is late?", answer: "The cargo may not be loaded, and the importer can face penalties at the US end. Late data is one of the most avoidable reasons a US-bound shipment misses its vessel." },
      { question: "Are these filings needed for air cargo?", answer: "Air shipments to the US have their own advance data rules, filed by the airline and forwarder. The information you supply is similar: who, what and where." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "vgm-for-nepal-exporters",
    topic: "exports",
    title: "Verified gross mass: weighing an export container",
    description: "No export container is loaded without a verified gross mass. What VGM is, the two ways to get it, and how Nepal shippers avoid a rolled booking.",
    intro: "Every packed export container needs a verified gross mass before it is loaded on a ship. It is a simple number that stops cargo when it is missing or wrong.",
    published,
    cover: "container-marks",
    coverCaption: "The container's own weight is printed on its door. The cargo's is the shipper's job.",
    sections: [
      {
        title: "What VGM is",
        blocks: [
          { type: "p", text: "The verified gross mass is the total weight of a packed container: the cargo, the packing and dunnage, and the container itself. International safety rules for ships require the shipper to provide it before the container is loaded. Without it, the line will not load the box." },
        ],
      },
      {
        title: "Two ways to get it",
        blocks: [
          { type: "steps", items: [
            { title: "Weigh the packed container", copy: "The whole loaded container is weighed on a certified weighbridge." },
            { title: "Add up the parts", copy: "Every package, the packing and the dunnage are weighed with certified equipment, and the container's tare weight is added, using a method the authorities accept." },
          ] },
          { type: "p", text: "Whichever is used, the shipper named on the bill of lading is responsible for the figure, and signs for it." },
        ],
      },
      {
        title: "For Nepal exports",
        blocks: [
          { type: "p", text: "Nepal's exports are loaded on ocean vessels at Indian ports, so the VGM has to be submitted to the line before the vessel's VGM cut-off there. If the container is stuffed in Nepal, the weights from the stuffing are the basis of the figure. If cargo is loaded at a CFS in India, the consolidator handles the container's VGM, but needs accurate weights for each consignment." },
        ],
      },
      {
        title: "Avoiding problems",
        blocks: [
          { type: "list", items: [
            "Weigh packages, do not estimate them",
            "Make the weights on the packing list, the invoice and the VGM agree",
            "Respect the weight limits for the roads and rail between Nepal and the port, not just the container's rating",
            "Submit the VGM with the shipping instructions, well before the cut-off",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can I estimate the weight instead of weighing?", answer: "No. The figure must come from weighing, by one of the two recognised methods. Estimates risk a rejected booking or penalties." },
      { question: "Who is responsible if the VGM is wrong?", answer: "The shipper named on the bill of lading is responsible for the declared VGM. That is why weights on every document must come from the scale." },
      { question: "Is VGM needed for air cargo?", answer: "No. VGM is a rule for sea containers. Air cargo is weighed by the airline at acceptance." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "the-export-file",
    topic: "exports",
    title: "The export file: documents a Nepal shipper prepares",
    description: "What a Nepal exporter should have ready before cargo is collected: the invoice, packing list, declarations, certificates and the buyer's papers.",
    intro: "Export shipments leave on time when the papers are ready before the cargo is. This is the file a Nepal shipper should put together before collection day.",
    published,
    cover: "clipboard-sign",
    coverCaption: "An export file is ready when the buyer could clear the goods from it alone.",
    sections: [
      {
        title: "Before collection",
        blocks: [
          { type: "list", items: [
            "Commercial invoice: buyer, seller, description, quantities, values, currency and delivery term",
            "Packing list: each package's contents, dimensions, net and gross weight",
            "The buyer's order or contract, for reference",
            "Your registrations: business, tax and EXIM details",
            "Any export permit or certificate the goods need",
          ] },
        ],
      },
      {
        title: "For the destination",
        blocks: [
          { type: "list", items: [
            "Certificate of origin, if the buyer claims a preferential duty rate",
            "Plant or health certificates for food, plant or animal products, where the destination requires them",
            "Treatment certificates for wooden packing, where required",
            "Any document listed in a letter of credit, in the exact form it asks for",
          ] },
          { type: "p", text: "The buyer usually knows what their customs needs. Ask, in writing, before you pack." },
        ],
      },
      {
        title: "Made by the forwarder",
        blocks: [
          { type: "list", items: [
            "The export customs declaration, filed with Nepal customs",
            "The transit papers for cargo moving through India to a port",
            "The air waybill or bill of lading",
            "Data for advance filings at the destination, from the details you supply",
          ] },
        ],
      },
      {
        title: "One story, every page",
        blocks: [
          { type: "p", text: "The buyer's name, the goods, the quantities and the weights must be the same on every document. A difference between the invoice and the packing list is the most common reason for a query on export, and the second most common on import at the other end." },
        ],
      },
    ],
    questions: [
      { question: "Can I start packing before the documents are ready?", answer: "Yes, but finalise the packing list from what is actually packed, and make sure the invoice matches it before collection." },
      { question: "Do documents need to be originals?", answer: "Some do, depending on the buyer, the bank and the destination's customs. Many are accepted as copies. Ask early which ones must travel as originals." },
      { question: "How long should I keep export records?", answer: "Keep them for as long as tax, foreign exchange and origin rules require, and at least as long as any buyer or authority may ask about the shipment." },
    ],
    related: { service: service.customs, guides: ["exporting-from-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "when-the-buyer-nominates-the-forwarder",
    topic: "exports",
    title: "When the buyer names the forwarder: what you still own",
    description: "Many buyers abroad nominate their own forwarder for Nepal exports. What it handles, what stays with the shipper in Nepal, and how to avoid gaps.",
    intro: "Large buyers often tell their suppliers which forwarder to use. That does not take the shipment off the Nepal exporter's desk.",
    published,
    cover: "ship-terminal",
    coverCaption: "A nominated forwarder runs the ocean leg. Getting the cargo to it is still a Nepal job.",
    sections: [
      {
        title: "Why buyers nominate",
        blocks: [
          { type: "p", text: "Buyers on FOB or FCA terms pay for the main carriage, so they choose who carries it. Large retailers have contracts with forwarders and shipping lines, and route all their suppliers' cargo through them. The forwarder may be at the destination, at the Indian port, or both." },
        ],
      },
      {
        title: "What usually stays with you",
        blocks: [
          { type: "list", items: [
            "Packing, labelling and marking to the buyer's routing guide",
            "Export customs clearance in Nepal",
            "Moving the cargo from Nepal to the port or CFS the forwarder names, in transit through India",
            "Delivering before the forwarder's cut-off",
            "Supplying weights, VGM data and filing data on time",
            "The commercial documents: invoice, packing list, certificates",
          ] },
          { type: "p", text: "Under FOB or FCA, the seller's risk normally ends when the goods are handed over at the named place. Until then, damage and delay are the shipper's problem, whoever the buyer's forwarder is." },
        ],
      },
      {
        title: "Avoiding gaps",
        blocks: [
          { type: "p", text: "The usual gap is between Nepal and the Indian port. The buyer's forwarder expects the cargo at its CFS in Kolkata by a date. Getting it there means export clearance in Nepal, transit papers through India and a truck or rail slot, which someone in Nepal has to arrange." },
          { type: "list", title: "Agree in writing", items: [
            "The exact handover point: a CFS, a terminal, or an airport",
            "The cut-off date and time at that point",
            "Who pays the charges at the handover point",
            "Who to contact at the forwarder, and how they confirm receipt",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can I use my own forwarder for the Nepal side?", answer: "Usually yes. The buyer's forwarder runs the main leg. Your forwarder handles the Nepal export, the transit through India and the handover." },
      { question: "Who pays the CFS charges at the handover?", answer: "It depends on the Incoterm and the agreement. Write down who pays each charge at the handover point before the first shipment." },
      { question: "What if the nominated forwarder's cut-off is impossible?", answer: "Tell the buyer and the forwarder at once, with a realistic date. A missed cut-off reported early can be rebooked. One discovered at the gate is a lost sailing." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "garment-exports-from-nepal",
    topic: "exports",
    title: "Garment exports: cartons, hangers and buyer labels",
    description: "Garment buyers abroad set strict rules for cartons, labels, hangers and documents. What Nepal garment exporters should get right before collection.",
    intro: "Garment buyers, especially large retailers, are precise about how goods arrive. Most of their rules are about the carton, and most of the fines are too.",
    published,
    cover: "warp-threads",
    coverCaption: "Retail buyers check the carton before they ever open it.",
    sections: [
      {
        title: "The routing guide",
        blocks: [
          { type: "p", text: "Large buyers publish a routing or vendor guide. It covers carton sizes and weights, label positions, barcodes, packing methods, documents and booking procedures. Breaking the rules can mean relabelling at the destination, chargebacks against the invoice, or cargo refused at the warehouse. Read it before production is packed, not when the truck is at the gate." },
        ],
      },
      {
        title: "Cartons and labels",
        blocks: [
          { type: "list", items: [
            "Use the carton sizes and maximum weights the buyer specifies",
            "Place labels where the guide says, on the sides it says",
            "Match carton contents to the packing list exactly, by style, colour and size",
            "Use strong export cartons that will survive stacking in a container",
            "Seal cartons with plain tape unless the buyer allows printed tape",
          ] },
        ],
      },
      {
        title: "Flat-packed or on hangers",
        blocks: [
          { type: "p", text: "Most garments ship folded in cartons. Some buyers want garments on hangers, shipped in containers fitted with rails, so they can go straight to the shop floor. Hanging garments take more space and need special equipment, so confirm the method and the container fittings with the buyer's forwarder well before the booking." },
        ],
      },
      {
        title: "Documents",
        blocks: [
          { type: "p", text: "Garment descriptions need to say what the garment is, the fabric composition and whether it is knitted or woven, because destination customs classify on those details. A packing list by carton, an invoice with fibre content, and a certificate of origin where the buyer claims a preference are the usual minimum." },
        ],
      },
    ],
    questions: [
      { question: "What is a chargeback?", answer: "A deduction a retailer makes from the supplier's invoice when the supplier breaks its rules, such as wrong labels or late delivery. Routing guides set out the chargebacks." },
      { question: "Can garments on hangers go by air?", answer: "Some airlines and forwarders offer hanging garment services by air. It costs more and needs booking in advance." },
      { question: "Does the fibre content really matter for freight?", answer: "It matters for customs at the destination, which classifies garments by fabric and construction. Getting it wrong can mean delays and penalties for the buyer." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "packing-handicrafts-for-export",
    topic: "exports",
    title: "Packing handicrafts for export: fragile and mixed",
    description: "Handicraft orders mix fragile, oddly shaped and heavy pieces. How Nepal exporters can pack them to arrive whole, and to clear customs abroad.",
    intro: "A handicraft order can hold singing bowls, wooden carvings, paper lamps and metal statues in the same shipment. Each needs packing in its own way.",
    published,
    cover: "warehouse-racks",
    coverCaption: "Mixed orders travel best in uniform outer cartons with careful inner packing.",
    sections: [
      {
        title: "Protect each piece",
        blocks: [
          { type: "list", items: [
            "Wrap fragile items individually, with cushioning on every side",
            "Fill empty space so nothing moves when the carton is shaken",
            "Pack heavy items low and light items on top, never mixed loosely",
            "Use double-wall cartons for heavy metal or stone pieces",
            "Mark cartons with fragile and this-way-up labels, and do not rely on them",
          ] },
        ],
      },
      {
        title: "Wood and natural materials",
        blocks: [
          { type: "p", text: "Many countries check wooden articles and wooden packing for pests. Wooden crates and pallets should be treated and marked to the international standard for wood packaging. Some destinations also look closely at products made of untreated wood, bamboo, straw or plant fibre, and may require treatment or certificates. Check the destination's rules before the goods are packed." },
        ],
      },
      {
        title: "Describe it properly",
        blocks: [
          { type: "p", text: "Handicrafts is not a description customs anywhere can classify. List each item by what it is and what it is made of: brass statue, cotton bag, paper lamp, wooden mask. Mixed orders benefit from a packing list that says which carton holds which items, so an inspection does not mean unpacking the whole shipment." },
        ],
      },
      {
        title: "Choose the mode for the goods",
        blocks: [
          { type: "p", text: "Small, light and valuable pieces travel well by air. Heavy metal and stone work is often cheaper by sea, if the buyer can wait. Fragile goods suffer most from handling, so a full container or a well-built air pallet is safer than many loose cartons in a shared load." },
        ],
      },
    ],
    questions: [
      { question: "Can I mix fragile and heavy items in one carton?", answer: "It is safer not to. If you must, pack the heavy items at the bottom, firmly separated, with the fragile items cushioned above." },
      { question: "Do singing bowls or metal statues need special papers?", answer: "Ordinary metal handicrafts are general cargo, but antiques and items of cultural heritage may need clearance before export. Check if an item is old or religious." },
      { question: "Is insurance worth it for handicrafts?", answer: "Yes, especially for fragile goods. Packing defects are usually excluded, so good packing and insurance work together." },
    ],
    related: { service: service.warehouse, guides: ["exporting-from-nepal"], tool: "volume-weight" },
  },
  {
    slug: "exporting-tea-coffee-and-spices",
    topic: "exports",
    title: "Food exports from Nepal: tea, coffee and spices",
    description: "Tea, coffee, cardamom and other food exports from Nepal face extra checks abroad. The certificates, packing and destination rules to sort before shipping.",
    intro: "Nepal's tea, coffee, cardamom and herbs are sold worldwide. Food is checked more closely than most goods at the border it enters, so the paperwork starts early.",
    published,
    cover: "kathmandu",
    coverCaption: "Food exports are judged by the destination's food rules, not just its customs.",
    sections: [
      {
        title: "Two sets of rules",
        blocks: [
          { type: "p", text: "A food export has to satisfy customs and the destination's food and plant health authorities. The second set of rules is often the harder one. Depending on the product and the destination, the buyer's country may require a plant health certificate, laboratory results, labelling in its own format, or registration of the producer or importer before the goods arrive." },
        ],
      },
      {
        title: "Certificates to ask about",
        blocks: [
          { type: "list", items: [
            "A phytosanitary certificate for plant products, issued by Nepal's plant quarantine authority",
            "A certificate of origin, if the buyer claims a preferential duty rate",
            "Laboratory analysis, where the buyer or destination asks for it",
            "Organic or other certifications, if the goods are sold as certified",
          ] },
          { type: "p", text: "Some destinations require advance notice of food shipments, or registration of the food facility. The United States, for example, requires food facility registration and prior notice for food imports. Check with the buyer which rules apply to your product." },
        ],
      },
      {
        title: "Packing food",
        blocks: [
          { type: "list", items: [
            "Use food-grade inner packing, sealed against moisture",
            "Keep food away from chemicals and strong-smelling cargo",
            "Protect against heat in transit, especially through summer at Indian ports",
            "Label each package as the destination's food rules require",
          ] },
        ],
      },
      {
        title: "Mode and timing",
        blocks: [
          { type: "p", text: "Samples and small high-value lots usually fly. Larger shipments of tea or spices often go by sea. Sea transit through Indian ports can be hot and humid, so moisture protection matters. Ask your forwarder about container liners or desiccants for long sea journeys." },
        ],
      },
    ],
    questions: [
      { question: "Can I send food samples by courier?", answer: "Often yes, but many destinations apply food rules to samples too. Check with the courier and the buyer before sending." },
      { question: "Who checks food at the destination?", answer: "The destination's food or agriculture authority, alongside customs. They may sample the goods, inspect the paperwork or hold the shipment until conditions are met." },
      { question: "Does KCPL issue phytosanitary certificates?", answer: "No. Certificates are issued by the relevant Nepal authority. KCPL can coordinate the shipment around the inspection and the certificate." },
    ],
    related: { service: service.air, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "shipping-from-nepal-to-europe",
    topic: "exports",
    title: "Shipping from Nepal to Europe: air or sea",
    description: "Nepal exporters reach Europe by air from Kathmandu or by sea through Kolkata. How the two compare, and what Europe's advance cargo rules ask for.",
    intro: "Europe is a major market for Nepal's carpets, felt, garments and handicrafts. Getting goods there is a choice between air from Kathmandu and sea through India.",
    published,
    cover: "ship-aerial",
    coverCaption: "Sea exports to Europe leave through Kolkata and often change ships on the way.",
    sections: [
      {
        title: "By air",
        blocks: [
          { type: "p", text: "Air exports leave Kathmandu on carriers that connect through hubs in the Gulf, South Asia or East Asia, then fly on to European airports. Transit is measured in days, which suits samples, urgent orders and high-value goods such as carpets. The cost is charged on the greater of the actual weight and the volume weight." },
        ],
      },
      {
        title: "By sea",
        blocks: [
          { type: "p", text: "Sea exports travel from Nepal through India to Kolkata, then by sea, often transshipping at a hub, to European ports such as Rotterdam or Hamburg. Transit is measured in weeks. It suits larger orders, heavier goods and buyers who plan ahead. LCL services carry smaller shipments, and full containers suit regular volume." },
        ],
      },
      {
        title: "Europe's advance data rules",
        blocks: [
          { type: "p", text: "The European Union requires detailed information about cargo before it is loaded for Europe. Vague descriptions such as gifts, handicrafts or textiles are not accepted. Each item needs a plain, specific description, and the HS code helps. The forwarder and carrier file the data, but the details come from the shipper's invoice." },
          { type: "list", title: "Give your forwarder", items: [
            "A specific description of each product, such as wool felt slippers or hand-knotted wool carpet",
            "The HS code, to at least six digits",
            "The buyer's full name, address and any EU identifiers they give you",
            "Accurate weights and package counts",
          ] },
        ],
      },
      {
        title: "Choosing",
        blocks: [
          { type: "p", text: "Ask for both prices door to door, with realistic dates. A buyer who pays for air may prefer it for a first order and switch to sea once demand is steady. Many exporters use both: sea for the season's stock, air for repeat orders that run short." },
        ],
      },
    ],
    questions: [
      { question: "Which European ports do Nepal exports use?", answer: "Common destinations include major northern European ports such as Rotterdam and Hamburg, with onward transport inland. The buyer's location and the line's services decide." },
      { question: "Do EU buyers pay import VAT?", answer: "Import VAT in the EU is normally paid by the importer of record, usually the buyer, unless you sell with duty paid." },
      { question: "Why was my description rejected?", answer: "European advance data rules reject generic descriptions. Name each product plainly by what it is and what it is made of." },
    ],
    related: { service: service.air, guides: ["exporting-from-nepal", "air-freight-to-kathmandu"], tool: "volume-weight" },
  },
  {
    slug: "exporting-to-australia",
    topic: "exports",
    title: "Exporting from Nepal to Australia: packing and checks",
    description: "Australia applies some of the strictest biosecurity checks on imports. What Nepal exporters should know about packing, wood, cleanliness and papers.",
    intro: "Australia is a growing market for Nepal's handmade goods, and one of the strictest about what comes in with them. Most problems are about the packing, not the product.",
    published,
    cover: "ship-aerial",
    coverCaption: "Australia checks the packing and the container as closely as the goods.",
    sections: [
      {
        title: "Biosecurity first",
        blocks: [
          { type: "p", text: "Australia protects its farms and environment from pests and diseases carried on imports. Cargo, packing and containers can be inspected, and anything that does not meet the rules can be treated, re-exported or destroyed at the importer's cost. The buyer will pass those costs back to the supplier." },
        ],
      },
      {
        title: "Packing that passes",
        blocks: [
          { type: "list", items: [
            "Wooden pallets and crates must be treated and marked to the international standard, or avoided",
            "No soil, seeds, leaves, insects or straw in or on the packing",
            "Clean containers inside and out, with no residue from earlier loads",
            "Packing declarations, which Australia requires for sea cargo, completed accurately",
          ] },
          { type: "p", text: "Products made of natural materials, such as wood, bamboo, grass or unprocessed wool, may face their own conditions. Check the Australian government's import conditions for your product before you accept the order." },
        ],
      },
      {
        title: "Documents",
        blocks: [
          { type: "p", text: "Beyond the invoice and packing list, the buyer may need a certificate of origin and treatment certificates. Descriptions must be specific enough for Australian customs to classify and for biosecurity officers to judge the risk." },
        ],
      },
      {
        title: "Getting there",
        blocks: [
          { type: "p", text: "Sea shipments travel through Kolkata and usually transship on the way to Australian ports such as Brisbane, Sydney or Melbourne. Air shipments connect through Asian or Gulf hubs. Ask the buyer which port and whether they have a nominated forwarder, then plan the Nepal side to its cut-offs." },
        ],
      },
    ],
    questions: [
      { question: "Can I use plastic pallets instead of wood?", answer: "Plastic or processed-wood pallets avoid the rules for untreated wood packaging, though they still need to be clean." },
      { question: "What happens if a container fails inspection?", answer: "The goods or packing may be treated, re-exported or destroyed, at the importer's cost. The buyer will usually look to the supplier to cover it." },
      { question: "Are wool products restricted?", answer: "Processed wool goods are generally treated differently from raw wool. Check Australia's import conditions for your specific product." },
    ],
    related: { service: service.ocean, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "delivering-to-the-buyers-door",
    topic: "exports",
    title: "Delivering to the buyer's door abroad",
    description: "When a Nepal exporter sells delivered to the buyer's door, the job does not end at the port. What DAP and DDP add, and the costs to price first.",
    intro: "Some buyers want the price to include delivery to their door. That turns a freight booking into a door-to-door move, with costs at the far end the exporter must price.",
    published,
    cover: "airport-dollies",
    coverCaption: "The last leg abroad is often where unplanned costs appear.",
    sections: [
      {
        title: "What changes",
        blocks: [
          { type: "p", text: "Under FOB or FCA, the seller hands over in Nepal or at the port and the buyer arranges the rest. Under DAP, the seller arranges delivery to the named place and the buyer handles import clearance and duties. Under DDP, the seller also clears the goods and pays the destination duties and taxes, which can be hard for a foreign seller to do in some countries." },
        ],
      },
      {
        title: "Costs at the far end",
        blocks: [
          { type: "list", items: [
            "Terminal or airport handling and storage",
            "Customs brokerage and any advance filings",
            "Duties and taxes, under DDP",
            "Trucking from the port or airport to the door",
            "Extra charges for small consignments, residential addresses, tail-lifts or appointments",
            "Waiting time if the receiver is not ready",
          ] },
          { type: "p", text: "These are usually quoted by a destination agent. Get the quote before you price the sale, not after, and make sure it covers the actual address and the actual cargo." },
        ],
      },
      {
        title: "Read the destination quote line by line",
        blocks: [
          { type: "p", text: "A good destination quote breaks the door delivery into its parts: trucking from the airport or port, delivery to the address, handling per shipment, and add-ons such as pallet fees, residential delivery or a tail-lift. It also states how long the rates are valid. If the arrival airport might change, ask what trucking from the alternative would cost, so a schedule change does not wipe out the margin on the sale." },
        ],
      },
      {
        title: "Before you agree a door price",
        blocks: [
          { type: "list", items: [
            "Confirm the exact address and receiving hours",
            "Ask whether the address is commercial or residential",
            "Ask about access: loading dock, tail-lift, forklift",
            "Agree who pays if the consignee delays delivery",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can I quote DDP to the US or Europe?", answer: "It is possible, but you need a way to act as, or appoint, the importer of record and pay duties and taxes. Many sellers use DAP instead and leave import clearance to the buyer." },
      { question: "Who pays if the delivery is refused?", answer: "Agree it in advance. Storage, return and redelivery costs can be significant, and without an agreement they land on whoever booked the delivery." },
      { question: "Can KCPL arrange delivery abroad?", answer: "KCPL works with counterpart agents abroad who handle import clearance and door delivery, and obtains their rates before you confirm a delivered price." },
    ],
    related: { service: service.delivery, guides: ["exporting-from-nepal"] },
  },
  {
    slug: "rerouting-an-air-export",
    topic: "exports",
    title: "When the flight network breaks: rerouting an export",
    description: "Airline disruption can strand an air export mid-journey. How a Kathmandu export was rerouted through three hubs and delivered, and what shippers can learn.",
    intro: "An air export from Kathmandu changes planes at least once. When a carrier's network is disrupted, the shipment needs a new route, and someone has to find it.",
    published,
    cover: "airport-dollies",
    coverCaption: "A rerouted shipment is a chain of new connections, each one confirmed before the last one lands.",
    sections: [
      {
        title: "What happened",
        blocks: [
          { type: "p", text: "A 53-package air export from Kathmandu to Charlotte, in the United States, was cleared through export customs and dispatched as planned. Then the carrier's network was disrupted. The shipment was rerouted through Delhi, Addis Ababa and Rome, and the consignee confirmed receipt in good order on 14 April 2026." },
        ],
      },
      {
        title: "What a reroute involves",
        blocks: [
          { type: "steps", items: [
            { title: "Find where the cargo is", copy: "The first job is to confirm exactly where the shipment is held, and in whose custody." },
            { title: "Find a new routing", copy: "Look for connections that accept the cargo, with space, that reach the destination or a nearby airport." },
            { title: "Rebook and update the papers", copy: "The new routing has to be booked and reflected in the shipment's records with the carriers involved." },
            { title: "Tell the consignee", copy: "The buyer and the destination agent need the new flights and arrival so they can plan clearance and delivery." },
            { title: "Follow it to the door", copy: "Each connection is checked as it happens, until the consignee confirms receipt." },
          ] },
        ],
      },
      {
        title: "What shippers can do",
        blocks: [
          { type: "list", items: [
            "Pack for extra handling: rerouted cargo is loaded and unloaded more often",
            "Keep the buyer informed early, before they hear it from somewhere else",
            "Allow some flexibility on the arrival airport if trucking to the door is possible",
            "Make sure the documents travel electronically as well as with the cargo",
          ] },
        ],
      },
      {
        title: "Why follow-up matters",
        blocks: [
          { type: "p", text: "Most air exports arrive without a problem, and nobody remembers them. The ones that matter are the ones where a schedule breaks. A forwarder that follows the shipment to the consignee, not only to the departure flight, is the difference between a late delivery and a lost customer." },
        ],
      },
    ],
    questions: [
      { question: "Who pays for a reroute?", answer: "It depends on the cause and the terms of carriage. Carriers often reroute at their own cost when their network fails, but extra trucking or handling at the far end may be charged." },
      { question: "Can I choose not to reroute and wait?", answer: "Sometimes. Waiting may be cheaper if the original route will recover soon. The decision depends on the deadline and the cost of storage while waiting." },
      { question: "Does rerouting affect insurance?", answer: "Cover usually continues during reasonable deviations, but check the policy terms and tell your insurer if the route changes significantly." },
    ],
    related: { service: service.air, guides: ["exporting-from-nepal", "air-freight-to-kathmandu"] },
  },
];
