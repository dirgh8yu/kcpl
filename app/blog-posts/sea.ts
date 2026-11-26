import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const seaPosts: readonly BlogPost[] = [
  {
    slug: "choosing-an-indian-gateway-for-nepal",
    topic: "sea",
    title: "Kolkata, Haldia or Visakhapatnam: choosing a gateway",
    description: "Nepal has no coast, so every sea import lands at an Indian port first. How Kolkata, Haldia and Visakhapatnam differ, and how to choose for your cargo.",
    intro: "Nepal has no seaport, so every sea container for Nepal lands in India first. Which port it lands at shapes the sailing, the inland leg and the papers.",
    published,
    cover: "port-aerial",
    coverCaption: "The gateway port is chosen for the whole journey, not for the ocean leg alone.",
    sections: [
      {
        title: "Three ports, one job",
        blocks: [
          { type: "p", text: "Cargo for Nepal travels across India in transit, under customs control, from a port named for that purpose. For containers from overseas, the ports in regular use are Kolkata, Haldia and Visakhapatnam. All three can deliver a container to the inland container depot at Birgunj, by rail or by road. They differ in the ships they receive, the way the box travels north, and how often things go wrong." },
          { type: "steps", items: [
            { title: "Kolkata", copy: "A river port up the Hooghly, closest to the Raxaul and Birgunj border by road. It is the usual gateway for breakbulk and project cargo, and for containers that will travel to Nepal by truck." },
            { title: "Haldia", copy: "Downriver from Kolkata, under the same port authority, and able to take somewhat larger ships. Some lines call at Haldia instead of Kolkata, and the onward journey is much the same." },
            { title: "Visakhapatnam", copy: "A deep-water port further south, on a rail route to Birgunj. Many lines call there direct, and containers often travel to Nepal on through rail services." },
          ] },
        ],
      },
      {
        title: "What actually decides it",
        blocks: [
          { type: "p", text: "The ocean rate is only one line. The right gateway is the one where the whole journey costs least and holds together: the sailing, the port days, the inland leg and the release of the papers." },
          { type: "list", title: "Questions to settle with your forwarder", items: [
            "Which ports the shipping line actually calls at from your origin, and how often",
            "Whether the line's bill of lading can run through to Birgunj, or ends at the Indian port",
            "Whether the cargo will travel north by rail or by truck",
            "How many free days the line and the port allow before charges start",
            "Whether the cargo is over-dimensional, which usually means Kolkata and a trailer",
          ] },
        ],
      },
      {
        title: "Through bills and port bills",
        blocks: [
          { type: "p", text: "Some lines will issue a bill of lading with Birgunj as the place of delivery and arrange the rail leg themselves. This is often called carrier haulage. The line then owns the inland move, and its free time usually covers it." },
          { type: "p", text: "Other lines end their bill at the Indian port. From there, the inland leg is arranged by your forwarder: transit papers, a truck or a rail slot, and the delivery order. Neither is better in every case. What matters is knowing, before you book, which one you are buying, because it decides who you chase when a container stops moving." },
        ],
      },
      {
        title: "Ask before the supplier books",
        blocks: [
          { type: "p", text: "Many delays start when the seller books the cheapest sailing to any Indian port and the buyer finds out later. If you buy on FOB or EXW terms, you or your forwarder choose the line and the gateway. If you buy on CIF or CFR, write the discharge port and the transit wording into the purchase order, so the seller books the journey you planned." },
        ],
      },
    ],
    questions: [
      { question: "Is one gateway always the fastest?", answer: "No. Speed depends on the sailing, the line's port calls, congestion at the port that month and how the container travels north. A port with a faster ocean leg can still be slower door to door if the inland connection or the release of papers is slow. Compare the whole journey for each shipment." },
      { question: "Can I change the gateway after the cargo has sailed?", answer: "Rarely, and not cheaply. The discharge port is fixed in the booking and the manifest. Changing it after sailing needs the line's agreement, amended documents and often a fee, and the line may not call at the port you want. Settle the gateway before the supplier books." },
      { question: "Does the gateway change the customs process in Nepal?", answer: "Not the rules. Nepal customs applies the same law wherever the cargo entered India. What changes is the transit paperwork in India, the route to the border and, for some cargo, which Nepal customs office it reaches first." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "visakhapatnam-to-birgunj-by-rail",
    topic: "sea",
    title: "From Visakhapatnam to Birgunj: a container's rail journey",
    description: "How a Nepal-bound container moves from the port of Visakhapatnam to the Birgunj dry port by rail: the BL check, transit papers, rail-out and arrival.",
    intro: "Visakhapatnam is a regular gateway for containers bound for Nepal, with rail running north to the dry port at Birgunj. This is the journey step by step, as a freight desk sees it.",
    published,
    cover: "freight-train",
    coverCaption: "The inland leg from Visakhapatnam is usually made by rail.",
    sections: [
      {
        title: "Before the ship arrives",
        blocks: [
          { type: "steps", items: [
            { title: "The draft bill is checked", copy: "The consignee, the notify party, the description, the package count and the transit wording are checked against the invoice before the bill is issued. Errors found here cost nothing to fix." },
            { title: "The pre-alert comes in", copy: "The origin agent sends the bill of lading, the sailing details and the expected arrival. This is when the release method is confirmed: an original bill, or a telex release." },
            { title: "The release is chased", copy: "If the bill is telex-released, the line's office in India needs the release message before the container can move. Chasing it now saves days at the port." },
          ] },
        ],
      },
      {
        title: "At the port",
        blocks: [
          { type: "p", text: "Once the ship is in, the container is discharged and the Indian side of the transit begins. The transit documents for each bill of lading are lodged with the customs broker at the port. The line's charges are paid, the bill is surrendered or the telex release is matched, and the line issues the delivery order." },
          { type: "p", text: "Doing this in advance is the difference between a container that leaves on the next suitable train and one that waits for paperwork. A forwarder who files the transit papers as soon as the pre-alert arrives, rather than when the ship berths, saves the importer port storage." },
        ],
      },
      {
        title: "Rail-out and rail-arrival",
        blocks: [
          { type: "p", text: "When the container is loaded, the rail operator sends a rail-out notice with the train number and date. When it reaches Birgunj, a rail-arrival notice follows. These two notices are the dates an importer should watch. The first tells you to get your Nepal customs papers and your payment ready. The second tells you the free days at the dry port have started." },
        ],
      },
      {
        title: "At Birgunj",
        blocks: [
          { type: "p", text: "The container is cleared through Nepal customs at the dry port. Duty and VAT are assessed and paid, the cargo may be inspected, and the container is released. It then goes to your warehouse by truck, or is unloaded at the dry port and the cargo carried loose." },
          { type: "list", title: "Keep these in one place", items: [
            "The bill of lading number and the container number",
            "The train number from the rail-out notice",
            "The free days on the container, and where the empty goes back",
            "Your customs papers: invoice, packing list, bill of lading and any permits",
          ] },
        ],
      },
    ],
    questions: [
      { question: "How long does the rail leg take?", answer: "It varies with train availability, the number of containers waiting and the season. The rail-out notice gives the departure date, and the arrival notice confirms when it has reached Birgunj. Ask your forwarder what transit times have looked like in recent weeks rather than relying on a fixed figure." },
      { question: "Can the container go by road instead?", answer: "Sometimes, if rail space is short or the cargo is urgent. Road from a southern port is a long haul, so it usually costs more. Your forwarder can compare the two when a container is waiting for a train." },
      { question: "Who do I chase if the container is not moving?", answer: "Your forwarder. It can see whether the hold-up is the release, the transit papers, the delivery order or the rail slot, and who needs to act. A container that is not moving usually has one missing paper or payment behind it." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "customs-clearance-in-nepal"], tool: "storage-charges" },
  },
  {
    slug: "fcl-or-lcl-for-a-nepal-import",
    topic: "sea",
    title: "FCL or LCL: how to ship a part load to Nepal",
    description: "When a full container is worth it for a Nepal import and when shared LCL space is better: volume, weight, handling, papers and time all change the answer.",
    intro: "A full container (FCL) is yours alone. Less than container load (LCL) shares a box with other shippers. For Nepal, the choice turns on more than the volume.",
    published,
    cover: "ship-terminal",
    coverCaption: "A full container travels sealed from the supplier to Nepal. A shared one is opened along the way.",
    sections: [
      {
        title: "The volume rule of thumb",
        blocks: [
          { type: "p", text: "LCL is charged per cubic metre or per tonne, whichever is greater, usually with a minimum of one cubic metre. A full container is charged per box. Somewhere in the middle there is a crossover where a 20-foot container costs about the same as the LCL charges, and past it the full box is cheaper." },
          { type: "p", text: "Where that crossover sits depends on the lane and the month, so ask for both prices once the volume gets into the low teens of cubic metres. The quote should include the charges at both ends, not just the ocean rate, because LCL carries handling charges at every station where the box is opened." },
        ],
      },
      {
        title: "Why Nepal changes the sums",
        blocks: [
          { type: "p", text: "A shared container for Nepal has to be unloaded somewhere, and your cargo then has to make its own way on. If the consolidator loads a box that travels to Birgunj and is opened there, your cargo is handled twice: once when it is loaded at origin and once at Birgunj. If the consolidation ends at an Indian port, it is unloaded there and loaded again for the inland leg, with transit papers of its own." },
          { type: "p", text: "Each handling adds cost, time and a chance of damage or a missing carton. That is often what pushes Nepal importers to a full container sooner than the volume alone would suggest." },
        ],
      },
      {
        title: "When LCL is the right call",
        blocks: [
          { type: "list", items: [
            "Small, regular orders where waiting to fill a container would hold stock back",
            "Samples and first orders from a new supplier",
            "Cargo that packs well on pallets and can take extra handling",
            "Lanes where a consolidator runs a box direct to Birgunj",
          ] },
        ],
      },
      {
        title: "When a full container is safer",
        blocks: [
          { type: "list", items: [
            "Fragile, high-value or easily damaged goods",
            "Cargo with a deadline, where a delay to someone else's papers would hold yours",
            "Heavy cargo, where the weight rather than the volume drives the LCL charge",
            "Several suppliers in one region, who can be consolidated into your own box at origin",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Is there a fixed volume where FCL becomes cheaper?", answer: "No fixed number. It depends on the lane, the season, the local charges and how the LCL is routed to Nepal. As a habit, ask for both prices once your cargo reaches about ten to fifteen cubic metres, and compare them delivered to your door." },
      { question: "Can I share a container with another importer I know?", answer: "Yes, if you and the other importer agree how the papers, the costs and the risk are split. Each consignee still clears its own goods, and a problem with one can hold the container. Agree in writing who pays for delays." },
      { question: "Is LCL slower than FCL?", answer: "Often, because the cargo waits at the origin station for the box to fill and is handled again at the far end. The difference may be days or more. If the date matters more than the cost, ask your forwarder for the realistic door-to-door timing of each." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "importing-to-nepal"], tool: "volume-weight" },
  },
  {
    slug: "how-lcl-reaches-nepal",
    topic: "sea",
    title: "How LCL cargo reaches Nepal, box by box",
    description: "The path of shared-container cargo from a supplier's door to a Nepal warehouse: the origin CFS, the consolidation box, transit, de-stuffing and delivery.",
    intro: "LCL cargo changes hands more often than a full container does. Knowing each hand-over tells you where to look when a carton goes quiet.",
    published,
    cover: "warehouse-racks",
    coverCaption: "LCL cargo spends part of its journey in container freight stations like this one.",
    sections: [
      {
        title: "The journey in six hand-overs",
        blocks: [
          { type: "steps", items: [
            { title: "Supplier to origin CFS", copy: "The supplier delivers the cartons or pallets to a container freight station by the consolidator's cut-off date. Late delivery means the next box, often a week later." },
            { title: "Into the shared container", copy: "The consolidator loads your cargo with other shippers' cargo and issues you a house bill of lading. The shipping line issues a master bill for the whole box." },
            { title: "Across the sea", copy: "The box sails to an Indian gateway, sometimes changing ships on the way." },
            { title: "Transit across India", copy: "Either the whole box travels on to Birgunj under transit, or it is unloaded at a station in India and your cargo moves on separately." },
            { title: "De-stuffing", copy: "The box is opened and the cargo sorted by house bill. Each importer's cargo is then cleared through Nepal customs." },
            { title: "Delivery", copy: "Your cargo goes to your door on a truck, sometimes shared with other consignees on the same route." },
          ] },
        ],
      },
      {
        title: "Where LCL goes wrong",
        blocks: [
          { type: "p", text: "Most LCL problems come from one of the other shippers in the box. If one consignee's papers are wrong, customs can hold the whole container until they are fixed, and your cargo waits with it. Ask your forwarder how a hold on one house bill is handled, and whether your cargo can be released on its own." },
          { type: "p", text: "Marks matter more in LCL than anywhere else. Every carton should carry your name, the destination and a count such as 3 of 12, matching the packing list. Unmarked cartons are the ones that end up in the wrong truck." },
        ],
      },
      {
        title: "What to send your supplier",
        blocks: [
          { type: "list", items: [
            "The consolidator's cut-off date and the station address",
            "Carton marks: consignee, destination, carton number of total",
            "A packing list with each carton's dimensions and weight",
            "An instruction to palletise and wrap if the cargo is small and loose",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Why did my LCL cargo arrive later than the container?", answer: "Once the box is opened, each consignment is cleared and delivered on its own. If your papers or payment were not ready, or the cargo was held for another importer's problem, it waits after the container has arrived. Ask your forwarder where in the de-stuffing your cargo is." },
      { question: "Can I insure LCL cargo?", answer: "Yes, and you should. Shared cargo is handled more often, so the risk of damage or loss is higher. Cover should run from the supplier's door to yours, including storage at the stations on the way." },
      { question: "What if a carton goes missing?", answer: "Report it in writing at once, with the carton number from the packing list and photographs of what arrived. The counts at each hand-over show where it was last seen. That is why clear marks and an itemised packing list matter so much in LCL." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "importing-to-nepal"], tool: "volume-weight" },
  },
  {
    slug: "choosing-a-container-for-nepal",
    topic: "sea",
    title: "20-foot, 40-foot or high cube: choosing a container",
    description: "Choosing a 20-foot, 40-foot or high cube container for cargo bound for Nepal, where road and rail weight limits can matter more than the box.",
    intro: "The container is chosen for the cargo, but for Nepal it must also suit the train, the truck, the border and the gate at the far end.",
    published,
    cover: "container-marks",
    coverCaption: "The markings on the door give the box's own weight and its maximum gross weight.",
    sections: [
      {
        title: "The three common boxes",
        blocks: [
          { type: "steps", items: [
            { title: "20-foot", copy: "About 33 cubic metres inside. Best for heavy, dense cargo such as machinery parts, tiles or steel, where the weight runs out before the space does." },
            { title: "40-foot", copy: "About twice the length and about 67 cubic metres. Suited to lighter cargo that fills space before it reaches the weight limit." },
            { title: "40-foot high cube", copy: "About 30 centimetres taller than a standard 40-foot, for roughly 76 cubic metres. Useful for bulky, light goods and tall machinery that fits under the roof." },
          ] },
          { type: "p", text: "These are approximate internal volumes. The real usable space depends on the packing, the pallet size and whether cargo can be stacked." },
        ],
      },
      {
        title: "Weight is where Nepal is different",
        blocks: [
          { type: "p", text: "A container's rating tells you what the box can carry. It does not tell you what the road, the bridge or the truck at the far end will accept. A 20-foot container loaded to its full rating can be heavier than an inland truck or a weighbridge rule allows on part of the route." },
          { type: "p", text: "Before the supplier loads a heavy box, ask your forwarder for the weight that works for the whole journey, including the last stretch to your warehouse. Overweight boxes get stopped, re-weighed and sometimes partly unloaded, and all of that is charged." },
        ],
      },
      {
        title: "Height and the last mile",
        blocks: [
          { type: "p", text: "A high cube on a trailer stands taller than a standard box. Most main roads take it, but a low gate, a covered loading bay or overhead wires near the warehouse may not. If the container is going to your door rather than being unloaded at the dry port, measure the gate before choosing the box." },
        ],
      },
      {
        title: "When none of them fit",
        blocks: [
          { type: "p", text: "Cargo too tall or too wide for a closed container goes on a flat-rack or in an open-top container, or travels as breakbulk. These need their own planning for the Indian port, the border and the road. Mention any piece over about two metres high or wide at the quote stage so the right equipment is booked." },
        ],
      },
    ],
    questions: [
      { question: "Can I load a 20-foot container to its full rated weight?", answer: "Not always safely for Nepal. The container may take it, but the truck, the road rules or the weighbridge on the inland leg may not. Ask your forwarder for a safe maximum gross weight for the whole route before the supplier loads." },
      { question: "Is a high cube more expensive than a standard 40-foot?", answer: "Often a little, depending on the line and the lane. For light, bulky cargo the extra space usually pays for itself. For heavy cargo it brings no benefit, because the weight limit is reached first." },
      { question: "What if my cargo is too tall for any closed container?", answer: "It can travel on a flat-rack or in an open-top, or as breakbulk. These need extra planning at the port and on Nepal's roads, so mention any tall or wide piece when you ask for a quote." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india"], tool: "volume-weight" },
  },
  {
    slug: "what-a-pre-alert-should-contain",
    topic: "sea",
    title: "The pre-alert: what to receive before the ship arrives",
    description: "A pre-alert tells the destination what is coming and when. What a good one contains, and what a Nepal importer should do the day it arrives.",
    intro: "The pre-alert is the origin's message that a shipment has sailed. For a Nepal import, the days between the pre-alert and the ship's arrival are when delays are prevented.",
    published,
    cover: "clipboard-sign",
    coverCaption: "The pre-alert starts the paperwork at the destination while the cargo is still at sea.",
    sections: [
      {
        title: "What a pre-alert should contain",
        blocks: [
          { type: "list", items: [
            "Copies of the house and master bills of lading, or the air waybill",
            "The vessel or flight, the departure date and the expected arrival",
            "Container and seal numbers, or the number of packages",
            "The commercial invoice and packing list",
            "How the bill will be released: original, telex release or sea waybill",
            "Any special handling: dangerous goods, over-dimensional pieces, temperature",
          ] },
        ],
      },
      {
        title: "What to do the day it arrives",
        blocks: [
          { type: "steps", items: [
            { title: "Compare it with the order", copy: "Check the consignee, the description and the quantities against your purchase order. A wrong consignee name found now is an amendment. Found at the port, it is a hold." },
            { title: "Confirm the release", copy: "If the bill is original, find out where the originals are and how they will reach the port. If it is telex, ask when the release will be sent." },
            { title: "Start the Nepal papers", copy: "Pass the invoice and packing list to your customs agent so the HS codes, the value and any permit can be checked before the cargo lands." },
            { title: "Plan the money", copy: "Estimate the duty, VAT and charges at both ends, so payment is ready when the cargo is." },
          ] },
        ],
      },
      {
        title: "When the pre-alert is late",
        blocks: [
          { type: "p", text: "Pre-alerts sometimes arrive after the ship. When that happens, everything that should have been done at sea has to be done at the port, while storage charges run. If a supplier or origin agent is regularly late, ask for the pre-alert within two working days of sailing as a condition of the order." },
        ],
      },
    ],
    questions: [
      { question: "Who sends the pre-alert?", answer: "Usually the origin agent of the forwarder handling the shipment, or the shipper if it booked directly. It goes to the destination forwarder and often to the importer. If you buy CIF, ask the supplier to make sure you receive it." },
      { question: "What if the pre-alert has errors?", answer: "Report them at once. Some errors can still be fixed at origin before the ship arrives, such as a wrong consignee spelling on the bill of lading. The same error found at the port means an amendment, fees and waiting." },
      { question: "Is a pre-alert needed for air shipments?", answer: "Yes. For air the time between departure and arrival is short, so the pre-alert matters even more. It should arrive with the flight details and copies of the air waybill, invoice and packing list the day the shipment flies." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "igm-amendments-explained",
    topic: "sea",
    title: "IGM amendments: fixing a manifest error in India",
    description: "Why an error on the Indian import manifest can hold Nepal-bound cargo at the port, how an amendment works, and how to stop it before sailing.",
    intro: "Before a ship reaches an Indian port, its cargo is declared on a manifest. If Nepal-bound cargo is declared wrongly, it can wait at the port until the record is corrected.",
    published,
    cover: "container-plate",
    coverCaption: "A container number typed wrongly on the manifest is enough to stop it.",
    sections: [
      {
        title: "What the manifest is",
        blocks: [
          { type: "p", text: "The Import General Manifest, or IGM, is the list of cargo the shipping line files with Indian customs for each ship. For Nepal, it matters because the cargo must be declared as transit cargo for Nepal. If it is manifested as an Indian import, or with the wrong consignee or details, the transit to Nepal cannot proceed on that record." },
        ],
      },
      {
        title: "Common errors",
        blocks: [
          { type: "list", items: [
            "Cargo declared for Indian import instead of transit to Nepal",
            "A consignee or notify party that does not match the bill of lading",
            "A wrong container number, seal number or package count",
            "A description too vague for the transit papers",
            "Weight differences between the manifest and the documents",
          ] },
        ],
      },
      {
        title: "How an amendment works",
        blocks: [
          { type: "p", text: "The line or its agent applies to Indian customs to amend the manifest, with supporting documents that show the correct details. Customs reviews and approves the change. Until it does, the cargo stays where it is, and port storage and line charges continue." },
          { type: "p", text: "Most amendments are approved, but they take time, and timing is the whole cost. That is why the checking belongs before the ship sails, when it is just a corrected draft." },
        ],
      },
      {
        title: "Preventing it",
        blocks: [
          { type: "p", text: "The manifest is built from the bill of lading. Get the draft bill right and the manifest usually follows. Ask your forwarder to check the draft against the invoice and packing list, and to confirm the transit wording the line needs for cargo bound for Nepal." },
        ],
      },
    ],
    questions: [
      { question: "Who pays for an IGM amendment?", answer: "Usually the party responsible for the error, though in practice the cost is often passed along the chain to the importer first. Fees and the storage charges that build up while it is approved can both apply. Fixing the draft bill before sailing avoids all of them." },
      { question: "How long does an amendment take?", answer: "It depends on the change and the customs office. A simple correction can be quick. A change of consignee or cargo description takes longer, because customs needs to be satisfied the new details are true." },
      { question: "Can my forwarder in Nepal file the amendment?", answer: "The amendment is filed in India by the shipping line or its agent. Your forwarder can push it along, supply the supporting documents and follow up with the line, which is often what keeps it moving." },
    ],
    related: { service: service.customs, guides: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
  },
  {
    slug: "electronic-seals-on-transit-containers",
    topic: "sea",
    title: "Electronic seals on India–Nepal transit containers",
    description: "Why transit containers bound for Nepal carry an electronic seal, what it records between the Indian port and the border, and what it means here.",
    intro: "Transit cargo for Nepal crosses India under customs control. An electronic seal lets the authorities follow a container on that leg without a physical escort.",
    published,
    cover: "ghat-trucks",
    coverCaption: "Transit containers travel across India sealed, under customs control.",
    sections: [
      {
        title: "Why transit is controlled",
        blocks: [
          { type: "p", text: "Goods moving through India to Nepal do not pay Indian import duty, because they are not entering the Indian market. In return, India needs assurance that the container reaches the border with the same goods inside. Bonds, transit papers and seals provide that assurance." },
          { type: "p", text: "Under the Electronic Cargo Tracking System, or ECTS, many transit containers carry an electronic seal that reports their position and whether the seal has been opened. It replaces much of the paper checking that used to happen along the way." },
        ],
      },
      {
        title: "What it means for you",
        blocks: [
          { type: "list", items: [
            "The seal is fitted at the Indian port and removed at the border, as part of the transit process",
            "The seal number goes on the transit records with the container number",
            "A broken or tampered seal triggers checks, so the container must not be opened on the way",
            "Charges for the seal are usually part of the gateway costs on your forwarder's invoice",
          ] },
        ],
      },
      {
        title: "What it does not do",
        blocks: [
          { type: "p", text: "An electronic transit seal is a customs control. It is not a tracking service for the importer, and its data is not normally shared with the cargo owner. For updates on where your container is, rely on your forwarder's milestones: the rail-out or truck dispatch, the border crossing and the arrival at the dry port." },
        ],
      },
    ],
    questions: [
      { question: "Can I open a transit container on the way to check my goods?", answer: "No. Opening a sealed transit container outside customs control breaks the transit and triggers checks. Any inspection happens at the border or the dry port, under customs supervision." },
      { question: "Does every Nepal transit container carry an electronic seal?", answer: "Not necessarily. Which containers are sealed, and how, depends on the route and the rules in force. Your forwarder will know whether your container needs one and will include any charge on the gateway costs." },
      { question: "Can I track my container with the seal?", answer: "The seal's data is for customs, not for cargo owners. Ask your forwarder for updates at each milestone instead: departure from the port, arrival at the border and arrival at the dry port." },
    ],
    related: { service: service.road, guides: ["sea-freight-through-india"] },
  },
  {
    slug: "the-delivery-order-explained",
    topic: "sea",
    title: "The delivery order: the paper that lets a container go",
    description: "The delivery order on a Nepal import: who issues it, what it needs, why it is needed at the Indian port, and how to have it ready before arrival.",
    intro: "A container does not leave the port because it has arrived. It leaves because the shipping line has issued a delivery order. For Nepal, that order is needed in India.",
    published,
    cover: "port-aerial",
    coverCaption: "The cargo can be on the quay for days before the paper that releases it is ready.",
    sections: [
      {
        title: "What the delivery order is",
        blocks: [
          { type: "p", text: "The delivery order, or DO, is the shipping line's instruction to release a container to a named party. The line issues it once two things are true: its charges are paid, and its bill of lading has been surrendered or released by telex." },
          { type: "p", text: "For a Nepal import the DO is needed at the Indian gateway, because that is where the container leaves the line's hands and starts its transit. The Nepal side has its own release, at customs in Birgunj." },
        ],
      },
      {
        title: "What holds it up",
        blocks: [
          { type: "list", items: [
            "Original bills still at the bank or with the courier",
            "A telex release on the house bill, but not yet on the master bill",
            "Unpaid destination charges, or a dispute over them",
            "A consignee name on the bill that does not match the request",
            "A pending manifest amendment",
          ] },
        ],
      },
      {
        title: "Getting it early",
        blocks: [
          { type: "p", text: "Lines will usually issue a DO before the ship berths if everything is in order. Getting it in advance means the container can be moved as soon as it is discharged and the transit papers are accepted. Ask your forwarder to confirm the DO is in hand before arrival, not after." },
          { type: "p", text: "Some DOs carry a validity date. If the container is not moved by then, the DO has to be extended, sometimes for a fee. When a delay is expected, say so early so the validity is set correctly." },
        ],
      },
    ],
    questions: [
      { question: "Is the delivery order the same as customs clearance?", answer: "No. The delivery order releases the container from the shipping line. Customs clearance releases the goods from customs. For a Nepal import, the line releases the box in India, and Nepal customs releases the goods at the border or dry port." },
      { question: "Can I get a delivery order without the original bill of lading?", answer: "Only if the bill has been telex-released or a sea waybill was used, or the line accepts a bank guarantee instead of the originals. Otherwise the original bill must be surrendered." },
      { question: "Why do I pay charges to the line before the DO?", answer: "Destination charges are payable to the line or its agent at the discharge port, and the line will not release the container until they are paid. Ask for an estimate of these charges before arrival." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "free-time-and-demurrage"] },
  },
  {
    slug: "destuff-at-birgunj-or-at-your-warehouse",
    topic: "sea",
    title: "Unload at Birgunj or take the full box to your door?",
    description: "Unload a Nepal import at the Birgunj dry port, or send the full container to your warehouse? Access, handling, free time and the empty compared.",
    intro: "Once a container clears customs at Birgunj, there are two ways to get the cargo home. The choice changes the cost, the risk and how long the line's container is out.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "Unloading at the dry port moves the cargo into trucks that suit the road ahead.",
    sections: [
      {
        title: "Option one: unload at the dry port",
        blocks: [
          { type: "p", text: "The container is opened at Birgunj and the cargo loaded into trucks. The empty goes back to the line at once, which stops the container detention clock early." },
          { type: "list", items: [
            "Good when your warehouse cannot take a container truck, or the road in is narrow",
            "Good when the cargo is going to several places",
            "Adds a handling, so fragile goods need care and a count at loading",
            "The trucks for the onward leg must be ready when the cargo is released",
          ] },
        ],
      },
      {
        title: "Option two: take the full container to you",
        blocks: [
          { type: "p", text: "The container travels on a trailer to your warehouse, is unloaded there, and the empty is brought back. The cargo stays sealed until it reaches you." },
          { type: "list", items: [
            "Good for fragile or high-value goods, with fewer hands on the cargo",
            "Needs a gate, road and yard that a container trailer can use",
            "The container is out longer, so detention may run",
            "Your team must be ready to unload the day it arrives",
          ] },
        ],
      },
      {
        title: "Questions that decide it",
        blocks: [
          { type: "list", items: [
            "How many free days are left on the container when it clears customs?",
            "Where does the line want the empty returned?",
            "Can a container trailer reach your door, and turn?",
            "How long will your team take to unload by hand or with a forklift?",
          ] },
          { type: "p", text: "Your forwarder can price both options. The cheaper line on paper is not always cheaper once the detention days are counted." },
        ],
      },
    ],
    questions: [
      { question: "Is cargo safe when it is unloaded at the dry port?", answer: "It can be, with care. Count and photograph the cargo at unloading, and make sure the trucks taking it on are covered and ready. Most loss and damage at this stage comes from cargo left waiting in the open." },
      { question: "Can I unload part of the container at Birgunj and take the rest?", answer: "It is possible but adds handling and paperwork, and the container is still out until it is empty and returned. It is usually simpler to choose one option for the whole container." },
      { question: "Who arranges the trucks after unloading?", answer: "Your forwarder, if it is handling delivery. The trucks should be booked before the container is released, so the cargo does not wait on the ground." },
    ],
    related: { service: service.delivery, guides: ["free-time-and-demurrage", "importing-to-nepal"], tool: "storage-charges" },
  },
  {
    slug: "returning-the-empty-container",
    topic: "sea",
    title: "Returning the empty: where, when and who pays",
    description: "A Nepal import is not finished until the empty container is back with the line. Where empties go, how detention is counted, and avoiding disputes.",
    intro: "The shipping line lends you the container. Until the empty is back where the line says, the clock is running, and the last bill of the shipment is often for those days.",
    published,
    cover: "container-yard",
    coverCaption: "An empty returned a day late is charged as a full day of detention.",
    sections: [
      {
        title: "Where the empty goes",
        blocks: [
          { type: "p", text: "The line names an empty depot, and the container has to be returned there. For Nepal imports the depot may be at the dry port in Birgunj, or back at the Indian gateway, depending on the line and its arrangements. The answer changes the cost of the return trip and the number of days it takes, so get it before the cargo arrives." },
        ],
      },
      {
        title: "How the days are counted",
        blocks: [
          { type: "p", text: "Container detention is counted from the day the line's free time ends to the day the empty is received at the depot. Some lines count the free time from discharge at the Indian port, others from arrival at Birgunj. Some combine port storage and container detention into one allowance, and others keep them separate." },
          { type: "p", text: "The free days are a commercial term between the line and the shipper or consignee, and can sometimes be extended when the booking is made. Asking for more free time on a Nepal booking is common and often cheaper than paying for the days later." },
        ],
      },
      {
        title: "Avoiding disputes",
        blocks: [
          { type: "list", items: [
            "Keep the depot's receipt for the empty, with the date and time",
            "Photograph the container's condition at unloading, especially any damage",
            "Sweep the container and remove dunnage and labels before it goes back",
            "Check the line's detention invoice against your own dates before paying",
          ] },
          { type: "p", text: "Damage found at the depot is charged to the consignee unless you can show it was there before you unloaded. A photograph of the doors and the inside, taken on the day, settles most arguments." },
        ],
      },
    ],
    questions: [
      { question: "What if the line's depot is full and refuses the empty?", answer: "It happens at busy times. Get the refusal in writing or recorded, with the date and time, so the extra days are not charged to you. Ask your forwarder to agree an alternative depot with the line." },
      { question: "Can I keep the container to use as storage?", answer: "Only by agreement with the line, and you pay detention for every day. It is usually far cheaper to unload into a warehouse." },
      { question: "What counts as damage when the empty goes back?", answer: "New dents, holes, broken fittings, and sometimes dirt or residue. Photographs of the container when it arrived full, and again when emptied, protect you from being charged for damage you did not cause." },
    ],
    related: { service: service.ocean, guides: ["free-time-and-demurrage"], tool: "storage-charges" },
  },
  {
    slug: "transshipment-and-feeder-vessels",
    topic: "sea",
    title: "Transshipment: why your container changed ships",
    description: "Many sailings to India's east coast change ships at a hub on the way. What transshipment means for a Nepal import's transit time and arrival.",
    intro: "A container leaving China or Europe for Nepal may not stay on one ship. Many services to India's east coast unload it at a hub and put it on a smaller vessel for the last sea leg.",
    published,
    cover: "ship-aerial",
    coverCaption: "Large ships serve the hubs. Smaller feeder ships carry containers on to many Indian ports.",
    sections: [
      {
        title: "Mother vessels and feeders",
        blocks: [
          { type: "p", text: "The biggest container ships call at a few hub ports. From there, smaller feeder vessels carry containers to ports the big ships do not call at. For India's east coast, hubs such as Colombo, Singapore and Port Klang often play that role. A Kolkata-bound container, in particular, usually arrives on a feeder because the river limits the size of ship that can reach the port." },
        ],
      },
      {
        title: "What it does to your dates",
        blocks: [
          { type: "p", text: "Each transshipment adds a wait at the hub, until the container is loaded on the next ship. If the feeder is full, or the first ship arrives late and misses the connection, the container can wait a week or more. The arrival date on the original booking is an estimate that assumes every connection works." },
          { type: "list", title: "Ask when you book", items: [
            "Is the service direct, or does it transship, and where?",
            "How often does the feeder from the hub sail?",
            "Will the line update the arrival date after transshipment?",
          ] },
        ],
      },
      {
        title: "Tracking a transshipped box",
        blocks: [
          { type: "p", text: "The container number stays the same, but the vessel name changes. When you track on the line's site, look for the discharge at the hub and the load on the onward vessel. A container shown as discharged at the hub with no onward loading for several days is waiting for space, and it is worth asking the line when it will move." },
        ],
      },
    ],
    questions: [
      { question: "Is a direct service always better?", answer: "It avoids the risk of a missed connection and is often faster, but it may sail less often or cost more. For cargo with a fixed date, a direct service is usually worth asking about." },
      { question: "Who is responsible if my container is left at the hub?", answer: "The line that issued the bill of lading carries it to the discharge port, including the transshipment. Delays are a normal risk of the service, and lines rarely compensate for them, which is why it helps to plan with a margin." },
      { question: "Does transshipment add charges?", answer: "Transshipment costs are usually built into the line's freight. Delays at the hub can still cost you indirectly, if they eat into the time you have before your own deadlines." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india"] },
  },
  {
    slug: "reading-a-sailing-schedule",
    topic: "sea",
    title: "ETD, ETA and cut-off: reading a sailing schedule",
    description: "The dates on a sailing schedule decoded for Nepal importers and exporters: cut-offs, ETD, ETA and what really decides when a container reaches Birgunj.",
    intro: "A sailing schedule is a page of dates, and each one means a different deadline. Reading it correctly is how you plan the cargo, the papers and the money.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Every date on a schedule is a deadline for someone.",
    sections: [
      {
        title: "The dates that matter",
        blocks: [
          { type: "steps", items: [
            { title: "Documentation cut-off", copy: "The last moment to give the line the shipping instructions for the bill of lading. Miss it and the cargo may be rolled to the next sailing even if it is at the port." },
            { title: "Cargo or gate cut-off", copy: "The last moment the full container can enter the terminal. For exports from Nepal, this is the date the box must reach the Indian port, which sets when it must leave Birgunj." },
            { title: "VGM cut-off", copy: "The deadline for the verified gross mass, the container's weighed total. No VGM, no loading." },
            { title: "ETD", copy: "Estimated time of departure. Estimated is the important word." },
            { title: "ETA", copy: "Estimated time of arrival at the discharge port, not at Nepal. Add the transit time to Birgunj on top." },
          ] },
        ],
      },
      {
        title: "Planning backwards",
        blocks: [
          { type: "p", text: "For an export, start from the vessel's cargo cut-off at the Indian port and count backwards: the road or rail transit from Birgunj, the export customs clearance in Nepal, the loading at your factory. For an import, start from the date you need the goods and count backwards through delivery, customs at Birgunj, the inland leg and the ocean transit." },
          { type: "p", text: "Build in a margin. Ships slip, trains wait and borders close for festivals. A plan that only works if every date holds is a plan for paying storage." },
        ],
      },
      {
        title: "When the schedule changes",
        blocks: [
          { type: "p", text: "Lines publish changes, but they reach you through your forwarder. Ask to be told of any change to the ETA of more than a day or two, so the papers and the money can move with it." },
        ],
      },
    ],
    questions: [
      { question: "Why did my container miss the vessel when it was at the port on time?", answer: "Usually because a document or the VGM missed its own cut-off, or the vessel was overbooked and the line rolled some containers to the next sailing. Ask the line or your forwarder which it was." },
      { question: "How reliable is an ETA?", answer: "It is an estimate that changes as the voyage goes on. Arrival dates can move by days because of weather, port congestion or transshipment. Treat the ETA as a target and confirm it as the ship gets closer." },
      { question: "Where do I find the schedule for my shipment?", answer: "Your forwarder or the line can give you the vessel, the voyage and the cut-offs. Lines also publish schedules on their websites, but the booking confirmation is what applies to your cargo." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "exporting-from-nepal"] },
  },
];
