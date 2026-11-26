import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const projectPosts: readonly BlogPost[] = [
  {
    slug: "route-survey-for-oversized-cargo",
    topic: "project",
    title: "The route survey: planning oversized cargo in Nepal",
    description: "Before an oversized load moves in Nepal, someone drives the route. What a route survey records, and how it shapes the trailer, the dates and the price.",
    intro: "An oversized movement is decided by the route before it is decided by the rate. The route survey is where that decision is made, one bridge and one bend at a time.",
    published,
    cover: "mountain-approach",
    coverCaption: "A survey records the road as the load will meet it, from the cab of a heavy vehicle.",
    sections: [
      {
        title: "Why survey at all",
        blocks: [
          { type: "p", text: "Nepal's roads were built for ordinary trucks. A transformer, a turbine casing or a long steel section can be heavier, taller, wider or longer than anything the road normally carries. The only way to know whether it will pass is to look: at every bridge, every bend, every overhead line and every climb, from the gateway to the site." },
        ],
      },
      {
        title: "What a survey records",
        blocks: [
          { type: "list", items: [
            "Bridges and culverts, with their condition and any known load limits",
            "Overhead power, telephone and cable lines, and their heights",
            "Bends, with the space a long trailer needs to swing through them",
            "Climbs and descents steep enough to need extra pulling or braking power",
            "Narrow sections, and places where traffic can pass or the load can wait",
            "Town centres, markets and checkpoints where the load must move at set times",
            "The site itself: the gate, the ground and the space to unload",
          ] },
        ],
      },
      {
        title: "What it decides",
        blocks: [
          { type: "steps", items: [
            { title: "The trailer", copy: "The number of axle lines, the deck height and whether the deck must rise or fall under obstructions." },
            { title: "The works", copy: "Lines to lift, barriers to remove, ground to level or strengthen, and who must give permission." },
            { title: "The schedule", copy: "How many days the move takes, which hours it can travel, and where it stops overnight." },
            { title: "The price", copy: "All of the above, which is why a serious quote for oversized cargo follows the survey rather than coming before it." },
          ] },
        ],
      },
      {
        title: "What to send for a survey",
        blocks: [
          { type: "p", text: "Send the heaviest and largest pieces' dimensions and weights from the packing list or the drawings, the lifting points, the gateway or factory the cargo starts from, and the site location with a contact who knows the access road. The more precise the figures, the fewer surprises on the road." },
        ],
      },
    ],
    questions: [
      { question: "How long before shipment should the survey happen?", answer: "As early as the cargo's dimensions are known, ideally before the equipment is ordered or shipped. If the survey finds works are needed, such as lifting lines or strengthening ground, those take time to arrange." },
      { question: "Can a survey guarantee the move will go smoothly?", answer: "No. Roads change, weather intervenes and new obstructions appear. A survey reduces the surprises; it does not remove them. A recheck close to the move date is wise for long projects." },
      { question: "Who gives permission to move oversized loads?", answer: "Depending on the route, permissions may be needed from road authorities, utilities whose lines must be lifted, and local authorities. The survey identifies which apply." },
    ],
    related: { service: service.project, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "flat-rack-and-open-top-to-nepal",
    topic: "project",
    title: "Flat-rack and open-top containers to Nepal",
    description: "Cargo too tall or wide for a closed container can reach Nepal on a flat-rack or in an open-top. How they work, and what over-height cargo needs.",
    intro: "Some cargo is too tall to go through a container door or too wide to fit inside. Flat-racks and open-tops let it travel on container ships and still reach Nepal.",
    published,
    cover: "port-lift",
    coverCaption: "Out-of-gauge units need their own lifting plan at every hand-over.",
    sections: [
      {
        title: "Two special containers",
        blocks: [
          { type: "steps", items: [
            { title: "Open-top", copy: "A container with no fixed roof, covered by a tarpaulin. Cargo is loaded from above by crane, so tall machinery that fits the floor but not the door can travel. If the cargo stands above the side walls, it is over-height." },
            { title: "Flat-rack", copy: "A floor with end walls and no sides or roof. Cargo can be wider and taller than a normal container, loaded from the top or the sides, and lashed to the floor." },
          ] },
        ],
      },
      {
        title: "What over-height and over-width change",
        blocks: [
          { type: "p", text: "Cargo that sticks out of a container's normal outline is out of gauge. Ships can carry it, but only in certain positions, so space is limited and costs more. At the Indian port it needs special handling to lift, and on the road it may need a trailer and a route that fits its height and width." },
          { type: "p", text: "For Nepal, the inland leg is often the harder part. A unit that fits the ship may meet low overhead lines or narrow roads between the border and the site." },
        ],
      },
      {
        title: "What to plan",
        blocks: [
          { type: "list", items: [
            "Exact dimensions and weight of the unit, with lifting and lashing points",
            "Whether the unit can be lifted from the top, the sides, or both",
            "How it will be protected from rain: tarpaulins and waterproof wrapping",
            "The route from the Indian port to Nepal and the site, surveyed for height and width",
            "Lifting equipment at the port, the border and the site",
          ] },
        ],
      },
      {
        title: "A second set of eyes on lashing",
        blocks: [
          { type: "p", text: "Out-of-gauge units shift if they are badly secured. Ask for photographs of the lashing at loading, and check them on arrival at each hand-over. Loose lashings found at the border are fixed for a few hundred rupees. Found on a hill road, they can end the journey." },
        ],
      },
    ],
    questions: [
      { question: "Is an open-top cheaper than a flat-rack?", answer: "It depends on the line and availability. An open-top suits tall cargo that fits within the walls. A flat-rack suits cargo that is wider or needs side loading. The cargo's shape usually decides." },
      { question: "Can these containers travel by rail to Birgunj?", answer: "Out-of-gauge cargo may not suit rail, depending on its dimensions. Many such units travel by road from the Indian port." },
      { question: "Are these containers always available?", answer: "Not always at every port. Book early, especially for project shipments that need several units." },
    ],
    related: { service: service.project, guides: ["sea-freight-through-india"] },
  },
  {
    slug: "breakbulk-through-kolkata",
    topic: "project",
    title: "Breakbulk through Kolkata: cargo that won't fit a box",
    description: "Some project cargo is too big for any container and travels as breakbulk. How it reaches Nepal through Kolkata, and what the importer prepares.",
    intro: "When a piece is too large or heavy for any container, it travels loose in the ship's hold or on deck. For Nepal, that breakbulk cargo usually comes in through Kolkata.",
    published,
    cover: "howrah-bridge",
    coverCaption: "Kolkata is the usual gateway for Nepal's breakbulk and project cargo.",
    sections: [
      {
        title: "What breakbulk is",
        blocks: [
          { type: "p", text: "Breakbulk cargo is loaded piece by piece rather than in containers: transformers, steel structures, large machinery, cable drums in bulk. It is lifted by the ship's cranes or the port's, stowed in the hold or on deck, and discharged the same way. It suits cargo that is too big for containers, or shipments large enough to fill much of a ship." },
        ],
      },
      {
        title: "Why Kolkata",
        blocks: [
          { type: "p", text: "Kolkata has long been the gateway for Nepal's project cargo. It is closest by road to the main border crossings, and its port and trucking market are used to heavy and over-dimensional loads heading north. From the port, breakbulk moves by trailer or truck to the border, clears customs on both sides and continues to the site." },
        ],
      },
      {
        title: "A recorded movement",
        blocks: [
          { type: "p", text: "In one infrastructure movement, a breakbulk shipment of 308 packages was handled through Kolkata, cleared through Birgunj and delivered in phases to an inland project site. All 308 packages were delivered to the site by 31 August 2025, with delivery reports and photographs recorded along the way." },
        ],
      },
      {
        title: "What the importer prepares",
        blocks: [
          { type: "list", items: [
            "A packing list with every piece's dimensions, weight and package number",
            "Drawings with lifting points for the heavy pieces",
            "The transit and customs documents, including any duty concession letters",
            "A delivery plan: which pieces the site needs first, and when",
            "Insurance that covers loading, discharge and the inland road",
          ] },
          { type: "p", text: "Breakbulk shipments arrive all at once, but sites can rarely take them all at once. Plan where the cargo waits between the port and the site, and how it is protected while it does." },
        ],
      },
    ],
    questions: [
      { question: "Can breakbulk be insured?", answer: "Yes, and the cover should include loading, discharge and the inland leg, where most handling risk lies." },
      { question: "How long does breakbulk take to clear the port?", answer: "It depends on the volume, the documents and the availability of trucks and trailers for onward transport. Planning the inland transport before arrival shortens it." },
      { question: "Does breakbulk need different customs papers?", answer: "The core documents are the same: invoice, packing list, bill of lading and transit papers. The packing list must be precise for every piece." },
    ],
    related: { service: service.project, guides: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
  },
  {
    slug: "phased-delivery-to-a-live-site",
    topic: "project",
    title: "Phased delivery to a live construction site",
    description: "Project sites rarely take all their cargo at once. How phased deliveries to Nepal sites are planned, recorded and receipted, from first drop to last.",
    intro: "A construction site is busy, short of space and working to its own schedule. Delivering to it means delivering when it is ready, in the order it needs, with a record each time.",
    published,
    cover: "site-yard",
    coverCaption: "Cargo waits in a secure yard until the site is ready for it.",
    sections: [
      {
        title: "Why deliver in phases",
        blocks: [
          { type: "p", text: "Foundations are poured in stages. Erection crews work through the equipment in order. Inspections happen before each step. A site that receives everything on the first day has to store it, guard it and move it around, often in mud and rain. Phased deliveries bring each piece when it is needed." },
        ],
      },
      {
        title: "How a phased plan works",
        blocks: [
          { type: "steps", items: [
            { title: "Agree the sequence", copy: "The site lists what it needs, in what order and by when. The forwarder matches packages to each phase." },
            { title: "Hold the rest", copy: "Cargo not yet needed waits in a secure yard or warehouse, covered and recorded." },
            { title: "Call off each phase", copy: "The site confirms each delivery a few days ahead: date, gate, unloading equipment and receiver." },
            { title: "Record each drop", copy: "Photographs at unloading, a signed receipt by package number, and any damage or shortage reported in writing the same day." },
          ] },
        ],
      },
      {
        title: "What the record proves",
        blocks: [
          { type: "p", text: "At the end of a project, someone will ask whether everything arrived. A receipt for every phase, by package number, answers that in minutes. On one infrastructure movement through Kolkata and Birgunj, all 308 packages were delivered to site by 31 August 2025, in phases, against site records." },
        ],
      },
      {
        title: "What the site should provide",
        blocks: [
          { type: "list", items: [
            "One named receiver for each delivery, with authority to sign",
            "Unloading equipment and crew, or notice that the delivery must bring them",
            "Hardstanding near the work area, clear of traffic",
            "Notice of site closures, inspections and holidays",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Who pays for storage between phases?", answer: "Agree it in the contract. Storage between phases is part of the logistics cost, and leaving it unagreed leads to disputes." },
      { question: "What if the site cancels a delivery at the last minute?", answer: "The truck may have to wait or return, and both cost money. Agree notice periods and charges for cancellations in advance." },
      { question: "Can phased delivery reduce damage?", answer: "Yes. Cargo that waits in a secure yard is handled less on site and is less exposed to construction traffic and weather." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
  {
    slug: "moving-conductor-drums",
    topic: "project",
    title: "Moving conductor drums to transmission line sites",
    description: "Conductor drums are heavy, round and needed in a set order. How they move from Indian factories to Nepal's transmission line sites, truck by truck.",
    intro: "A transmission line is strung from drums of conductor, one section at a time. Getting the right drums to the right tower site, in the right order, is the logistics job.",
    published,
    cover: "substation",
    coverCaption: "Every span of a transmission line starts as a drum delivered to the right place.",
    sections: [
      {
        title: "Heavy, round and numbered",
        blocks: [
          { type: "p", text: "Conductor drums are heavy, and they can roll. Each drum carries a length of conductor matched to a section of the line, so drums are not interchangeable once the stringing schedule is set. They often come from factories in India, by truck, through the border crossing nearest to the line." },
        ],
      },
      {
        title: "Planning the trucks",
        blocks: [
          { type: "list", items: [
            "Group drums into truck lots by the section of line they serve",
            "Match the lots to the stringing schedule, so the first sections arrive first",
            "Chock and lash each drum so it cannot roll on hill roads",
            "Check that each delivery point has a crane or loader to lift drums off",
            "Choose the border point closest to the line, not the busiest one",
          ] },
        ],
      },
      {
        title: "The papers",
        blocks: [
          { type: "p", text: "Large projects move dozens or hundreds of truckloads. Each truck needs its own invoice, packing list and customs clearance, and many projects need an employer's dispatch authorisation or a duty concession letter before goods move. Keeping the papers for each lot together, by truck number and drum number, is what keeps the trucks moving." },
        ],
      },
      {
        title: "At the far end",
        blocks: [
          { type: "p", text: "Line sites are spread out along the route, often in the hills, with narrow access roads. Drums may go to a central store first and then out to tower sites on smaller vehicles. Each hand-over is counted and recorded by drum number, because a missing drum stops a stringing crew." },
        ],
      },
    ],
    questions: [
      { question: "Can drums be rolled to unload them?", answer: "Only on prepared ground and with control, and many contractors forbid it. Cranes or loaders are safer for heavy drums." },
      { question: "What if a drum is damaged in transit?", answer: "Record it at once, with the drum number and photographs. Damaged conductor may be unusable, which can hold up stringing for that section." },
      { question: "Do empty drums go back?", answer: "Sometimes, if the supplier wants them returned. Agree it at the start, because return transport adds cost." },
    ],
    related: { service: service.project, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "dispatch-authorisation-on-projects",
    topic: "project",
    title: "Dispatch authorisation on employer-run projects",
    description: "On many Nepal infrastructure projects, equipment cannot leave the factory without the employer's approval. How that fits into the freight plan.",
    intro: "On many large projects, the employer inspects or approves equipment before it is shipped. Until that dispatch authorisation is issued, the freight plan waits.",
    published,
    cover: "clipboard-sign",
    coverCaption: "On employer-run projects, the approval to ship is part of the shipping papers.",
    sections: [
      {
        title: "What it is",
        blocks: [
          { type: "p", text: "On infrastructure projects run by a public employer, the contract often says that equipment must be inspected, tested or approved before it is dispatched from the factory. The employer, or its engineer, then issues a dispatch authorisation or clearance. Without it, the contractor may not be paid for the goods, and the goods may not be accepted at site." },
        ],
      },
      {
        title: "Why freight cares",
        blocks: [
          { type: "list", items: [
            "Trucks and containers booked for a date the authorisation misses sit idle and are charged",
            "Customs and duty concession papers may refer to the authorised list of goods",
            "The authorised quantities and descriptions must match the invoice and packing list",
            "Partial authorisations split one shipment into several",
          ] },
        ],
      },
      {
        title: "Planning around it",
        blocks: [
          { type: "steps", items: [
            { title: "Know the steps", copy: "Find out what the contract requires before dispatch: inspection, tests, documents, and who signs." },
            { title: "Book on the approval, not the hope", copy: "Firm up trucks and sailings once the authorisation date is known, with provisional bookings before it." },
            { title: "Match the papers", copy: "Use the authorised goods list as the basis for the invoice and packing list." },
            { title: "Keep a copy with every load", copy: "Customs, the site and the employer may each ask to see it." },
          ] },
        ],
      },
      {
        title: "When it is late",
        blocks: [
          { type: "p", text: "A late authorisation is not a freight problem the forwarder can solve. What a forwarder can do is tell you early what waiting will cost, hold transport options open, and move quickly once approval comes." },
        ],
      },
    ],
    questions: [
      { question: "Can goods be shipped before the authorisation and held?", answer: "Sometimes, if the contract allows it and holding costs are acceptable. Check the contract first, because unauthorised dispatch can cause payment or acceptance problems." },
      { question: "Does dispatch authorisation replace customs clearance?", answer: "No. It is a contract approval between the employer and the contractor. Customs clearance is separate." },
      { question: "Who should send the authorisation to the forwarder?", answer: "The contractor, as soon as it is issued, with the approved goods list." },
    ],
    related: { service: service.project, guides: ["customs-clearance-in-nepal"] },
  },
  {
    slug: "matching-every-package",
    topic: "project",
    title: "Project cargo documents: matching every package",
    description: "Project shipments can run to hundreds of packages across many trucks. Why every package must match the papers, and how to keep the count straight to site.",
    intro: "A project shipment can have hundreds of packages, split across ships, trucks and phases. If the papers and the packages stop matching, customs and the site both stop.",
    published,
    cover: "site-yard",
    coverCaption: "Every package on site should be traceable to a line on a packing list.",
    sections: [
      {
        title: "One number per package",
        blocks: [
          { type: "p", text: "Every package should carry a unique number, painted or tagged where it can be seen, and that number should appear on the packing list with the package's contents, dimensions and weight. When a shipment is split, each part's documents list exactly which package numbers it carries." },
        ],
      },
      {
        title: "Where counts go wrong",
        blocks: [
          { type: "list", items: [
            "A packing list for the whole order sent with a shipment that holds only part of it",
            "Loose items such as bolts, cables and spares packed together without a list",
            "Packages repacked at a port or warehouse without updating the papers",
            "Different numbering on the supplier's list and the contractor's list",
            "A truck that leaves with one package more or less than its papers say",
          ] },
        ],
      },
      {
        title: "Keeping the count straight",
        blocks: [
          { type: "steps", items: [
            { title: "At loading", copy: "Count and photograph packages into each container or truck, against its packing list." },
            { title: "At each hand-over", copy: "Count again at the port, the border and any warehouse, and record differences the same day." },
            { title: "At customs", copy: "Declare exactly what each consignment carries, so an examination finds what the papers say." },
            { title: "At site", copy: "Receipt by package number, not by truck, so missing items are found at once." },
          ] },
        ],
      },
      {
        title: "Why it is worth the effort",
        blocks: [
          { type: "p", text: "Customs needs the papers to match the goods to clear them, including any duty concession. The site needs to know what has arrived to plan the work. The insurer needs to know what was lost. One clean count, kept from factory to site, serves all three." },
        ],
      },
    ],
    questions: [
      { question: "What if the supplier's numbering is confusing?", answer: "Agree one numbering system for the project before shipping, and ask the supplier to mark packages accordingly." },
      { question: "Can loose items travel without a list?", answer: "They should not. Bolts, cables and spares go missing easily. Pack them in numbered cases with their own lists." },
      { question: "How do I report a missing package?", answer: "In writing, the same day, with the package number, the shipment reference and where the count was taken." },
    ],
    related: { service: service.project, guides: ["customs-clearance-in-nepal"] },
  },
  {
    slug: "damages-and-discrepancies",
    topic: "project",
    title: "Damages and discrepancies: recording every hand-over",
    description: "Damage found at site is hard to pin on anyone. Damage recorded at the hand-over where it happened can be claimed. How to record it on a project.",
    intro: "Cargo changes hands many times between a factory and a Nepal site. Damage that nobody records at the hand-over where it happened becomes damage nobody pays for.",
    published,
    cover: "cribbing",
    coverCaption: "Each hand-over is a chance to record the cargo's condition, and the last chance to do it for that leg.",
    sections: [
      {
        title: "Every hand-over is a checkpoint",
        blocks: [
          { type: "p", text: "Each time cargo passes from one party to another, the receiving party takes responsibility for it. That is the moment to check it: the count, the packing, the visible condition, and any shock or tilt indicators. If something is wrong, it is written on the receipt before signing, and reported in writing the same day." },
        ],
      },
      {
        title: "What a good record contains",
        blocks: [
          { type: "list", items: [
            "The date, place and parties at the hand-over",
            "Package numbers received, and any missing",
            "Photographs of each package, and close-ups of any damage",
            "The condition of the packing, lashing and covers",
            "Remarks on the receipt, signed by both sides",
            "A written report of damages and discrepancies, sent the same day",
          ] },
        ],
      },
      {
        title: "Common mistakes",
        blocks: [
          { type: "list", items: [
            "Signing a clean receipt and finding damage later",
            "Photographing only the damaged part, with nothing to show which package it is",
            "Opening damaged packing before the carrier or surveyor has seen it",
            "Reporting by phone, with nothing in writing",
          ] },
        ],
      },
      {
        title: "Why it matters",
        blocks: [
          { type: "p", text: "Insurance claims and carrier claims depend on proving where damage happened. A report made at the hand-over, with photographs and a remark on the receipt, is strong evidence. A report made weeks later at site is often met with the question of where the damage occurred, and nobody can answer it." },
        ],
      },
    ],
    questions: [
      { question: "Can I refuse damaged cargo?", answer: "In some cases, but refusing often leaves the cargo in limbo. It is usually better to accept with written remarks and notify everyone." },
      { question: "How soon must damage be reported?", answer: "As soon as it is found, in writing. Contracts and conventions set short time limits for notice." },
      { question: "Who decides whether damaged equipment is usable?", answer: "The manufacturer or a technical surveyor, not the transporter or forwarder." },
    ],
    related: { service: service.project, guides: ["importing-to-nepal"] },
  },
  {
    slug: "insurance-on-project-cargo",
    topic: "project",
    title: "Insurance on project cargo: the evidence a claim needs",
    description: "Project cargo insurance pays only when a claim is backed by evidence. What cover to check, and the records to keep from the factory to the site.",
    intro: "Insurance for project cargo is usually arranged by the contractor or the employer. Whether it pays out depends on what was recorded during the move.",
    published,
    cover: "port-lift",
    coverCaption: "The heaviest lifts are where insurers look first.",
    sections: [
      {
        title: "Check the cover",
        blocks: [
          { type: "list", items: [
            "Which legs are covered: sea, port, inland road, storage, unloading at site",
            "Whether storage in transit, such as waiting for a duty letter, is covered and for how long",
            "Whether loading and unloading with cranes and jacks is covered",
            "The basis of the insured value, and whether it includes freight and duty",
            "Exclusions, such as poor packing or delay",
            "Who must be notified of a loss, and how quickly",
          ] },
          { type: "p", text: "The forwarder does not usually provide the insurance on project cargo, but it should know the policy's notice requirements so it can act on them." },
        ],
      },
      {
        title: "The evidence a claim needs",
        blocks: [
          { type: "list", items: [
            "The policy or certificate, and the invoice that sets the value",
            "The packing list, showing which package was affected",
            "Receipts from each hand-over, with remarks where damage was seen",
            "Photographs at loading and at the point damage was found",
            "A survey report, where the insurer appoints a surveyor",
            "Repair or replacement costs, with supporting documents",
          ] },
        ],
      },
      {
        title: "Act quickly",
        blocks: [
          { type: "p", text: "Most policies require prompt notice. When damage is found, notify the insurer, keep the damaged goods and packing as they are until a surveyor has seen them, and hold carriers responsible in writing. Moving or repairing damaged goods before the survey can weaken the claim." },
        ],
      },
    ],
    questions: [
      { question: "Does the forwarder's liability cover project cargo?", answer: "Forwarders' and carriers' liability is limited and rarely covers the value of project equipment. Cargo insurance is the main protection." },
      { question: "Is waiting time in storage covered?", answer: "Only if the policy covers storage in transit, and often for a limited period. Check it before cargo waits for papers." },
      { question: "Who appoints the surveyor?", answer: "Usually the insurer, or the policyholder with the insurer's agreement." },
      { question: "What usually goes wrong with project cargo claims?", answer: "Most weak claims share the same gaps: no record of the cargo's condition at the hand-over where the damage happened, damaged packing thrown away before the surveyor came, and notice given weeks late. The cover itself is rarely the problem. The evidence is. Agree before the move who photographs and records each hand-over, and who notifies the insurer." },
    ],
    related: { service: service.project, guides: ["importing-to-nepal"] },
  },
  {
    slug: "hydropower-equipment-logistics",
    topic: "project",
    title: "Hydropower equipment: turbines, steel and hill roads",
    description: "Hydropower sites sit at the end of Nepal's hardest roads. How turbines, generators, steel and electrical equipment are planned and delivered to them.",
    intro: "Nepal's hydropower plants are built where the water falls, which is rarely where the roads are good. Getting the equipment there is a project of its own.",
    published,
    cover: "mountain-approach",
    coverCaption: "The last stretch to a hydropower site is often the hardest part of the journey.",
    sections: [
      {
        title: "What moves",
        blocks: [
          { type: "p", text: "A hydropower project brings in turbines and generators, transformers, switchgear, gates and valves, penstock steel, cables and many smaller items. Some pieces are heavy and indivisible. Others are long, such as steel sections. Most come from overseas or from Indian factories, through the gateways and border points into Nepal." },
        ],
      },
      {
        title: "The road is the constraint",
        blocks: [
          { type: "p", text: "Access roads to hydropower sites follow river valleys, with narrow sections, tight bends, steep grades and bridges built for local traffic. The heaviest and largest pieces are planned first, because they decide whether the road needs work. Smaller cargo follows the same road, but has more options." },
          { type: "list", items: [
            "Survey the access road early, before equipment is ordered if possible",
            "Ask manufacturers about splitting heavy items into shippable parts",
            "Plan the heaviest deliveries for the dry season",
            "Arrange lifting at site, or set-down by jacks and sleepers where no crane can reach",
          ] },
        ],
      },
      {
        title: "Papers and duty",
        blocks: [
          { type: "p", text: "Equipment for qualifying electricity projects may be eligible for customs duty concessions, on a recommendation from the authorities. The application takes time and must match the goods. Starting it with the equipment order, rather than with the shipment, avoids cargo waiting at the border." },
        ],
      },
      {
        title: "KCPL's record",
        blocks: [
          { type: "p", text: "KCPL has supported more than ten hydropower and infrastructure projects since 2015, with route surveys, gateway handling, customs and phased site delivery. Each project starts with the same question: what is the largest piece, and what is the road like?" },
        ],
      },
    ],
    questions: [
      { question: "When should logistics planning start on a hydropower project?", answer: "At the design and procurement stage, when the size of the largest pieces is decided. That is when splitting a piece or improving a road is cheapest." },
      { question: "Can heavy equipment reach sites in the monsoon?", answer: "Sometimes, but the risk of closures and soft ground is higher. Plan the heaviest moves for the dry season where possible." },
      { question: "Who maintains access roads during the move?", answer: "It varies by project. Agree in advance who repairs damage and who clears blockages." },
    ],
    related: { service: service.project, guides: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
  },
  {
    slug: "repair-and-return-shipments",
    topic: "project",
    title: "Sending equipment out for repair, and back",
    description: "When equipment in Nepal must go abroad for repair, it travels twice and clears customs twice. How to plan it so it comes back without a dispute.",
    intro: "A failed transformer part, a pump or a control panel sometimes has to go back to its maker. The trip out is an export. The trip back is an import. Both need planning.",
    published,
    cover: "container-yard",
    coverCaption: "A repair shipment has to prove it is the same equipment coming back.",
    sections: [
      {
        title: "Two journeys, two clearances",
        blocks: [
          { type: "p", text: "Equipment sent abroad for repair leaves Nepal as an export and comes back as an import. On the way back, customs will want to know what was done to it and what it is worth, and will look for proof that it is the same equipment that left." },
        ],
      },
      {
        title: "Records to keep from the start",
        blocks: [
          { type: "list", items: [
            "The make, model and serial numbers of the equipment",
            "Photographs of the equipment and its plates before it leaves",
            "The export declaration and transport documents for the outward journey",
            "The repairer's quotation and, later, its invoice for the repair",
            "A list of any parts replaced",
          ] },
          { type: "p", text: "Ask your customs agent before the equipment leaves how the return will be assessed. The answer decides which documents you need from the repairer." },
        ],
      },
      {
        title: "Packing for two trips",
        blocks: [
          { type: "p", text: "Equipment that failed in service often comes out of its housing without its original crate. Pack it as carefully as new equipment, and ask the repairer to return it in packing at least as good. Drain oils and fluids where transport rules require it, and record that you did." },
        ],
      },
      {
        title: "Choosing the route",
        blocks: [
          { type: "p", text: "Repair shipments to China, for example, can go by sea through Kolkata or overland over the northern border, depending on size, urgency and the state of the crossings. Shipments to India usually go by road. Ask for the route and timing both ways, because the plant is usually waiting for the equipment to come back." },
        ],
      },
    ],
    questions: [
      { question: "Will I pay duty again when the equipment returns?", answer: "It depends on the rules for re-imports after repair and on the documents you keep. Ask your customs agent before the equipment leaves." },
      { question: "Can the repairer ship it back directly?", answer: "Yes, but make sure they use the right consignee details and send you the documents in advance." },
      { question: "Should repair shipments be insured?", answer: "Yes, both ways. Equipment going for repair is often valuable and already fragile." },
    ],
    related: { service: service.project, guides: ["exporting-from-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "logistics-in-a-tender",
    topic: "project",
    title: "Logistics in a tender: what an EPC needs from a forwarder",
    description: "EPC contractors bidding for Nepal projects need logistics figures they can stand behind. What a budgetary quote contains, and what it must assume.",
    intro: "When a contractor prices a Nepal project tender, logistics is a line in the bid. A forwarder's job at that stage is to give a number with its assumptions in plain view.",
    published,
    cover: "tariff-ledger",
    coverCaption: "A tender figure is only as good as the assumptions written under it.",
    sections: [
      {
        title: "What the contractor needs",
        blocks: [
          { type: "list", items: [
            "A budgetary cost per unit that scales: per truck, per container, per tonne or per package",
            "Costs split by country, so the India and Nepal parts can be priced and paid separately",
            "Duty and VAT shown separately from freight, with the basis stated",
            "The route and border point assumed for each destination",
            "Validity, and what would change the figure",
          ] },
        ],
      },
      {
        title: "Assumptions to state",
        blocks: [
          { type: "list", items: [
            "Cargo dimensions and weights assumed, or the packing list used",
            "Which loads are over-dimensional, and the permits and escorts assumed",
            "Where cargo waits if paperwork is late, and for how long",
            "Who provides unloading at site",
            "Who arranges insurance",
            "Exchange rate and fuel price basis",
          ] },
          { type: "p", text: "A budgetary figure without its assumptions cannot be checked or updated. With them, the contractor can see what changed when the real shipment differs." },
        ],
      },
      {
        title: "Credibility counts",
        blocks: [
          { type: "p", text: "Tender evaluators may look at whether the logistics provider has done similar work. A forwarder named in a bid should be able to show relevant experience: project movements handled, gateway and border presence, and the documents it routinely manages. KCPL is a founding member of the Cargo Plus Logistics (CPL) network and a member of the Nepal Freight Forwarders Association, and has staff in Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata." },
        ],
      },
      {
        title: "After the award",
        blocks: [
          { type: "p", text: "Once the project is won, the budgetary quote becomes a working plan: route surveys, firm rates for the first lots, and a schedule tied to the project's milestones. Bring the forwarder in early. Most logistics problems on projects are cheaper to solve on paper than on the road." },
        ],
      },
    ],
    questions: [
      { question: "How accurate is a budgetary quote?", answer: "It is an estimate on stated assumptions, not a firm price. Its value is that the assumptions are visible and can be updated." },
      { question: "Will KCPL hold tender rates for the whole project?", answer: "Rates depend on carriers, fuel and currency over time. A review mechanism for long projects is more realistic than a fixed rate." },
      { question: "Can KCPL be named in our tender?", answer: "Speak to us first, so we can confirm the scope, the assumptions and the documents you need from us." },
    ],
    related: { service: service.project, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "getting-a-site-ready-to-receive",
    topic: "project",
    title: "Getting a site ready to receive heavy cargo",
    description: "A heavy delivery can arrive on time and still fail at the site gate. What a Nepal project site should prepare before the heavy trailers arrive.",
    intro: "The last hundred metres of a heavy delivery are inside the site. If the site is not ready, a load that crossed two countries waits outside the gate.",
    published,
    cover: "sleepers",
    coverCaption: "Level, firm ground and a plan for set-down make the last hundred metres simple.",
    sections: [
      {
        title: "The access",
        blocks: [
          { type: "list", items: [
            "A gate wide and high enough for the loaded trailer, with room to turn in",
            "A road inside the site firm enough for the axle loads, in any weather",
            "No overhead lines or structures lower than the loaded height",
            "Space for the trailer to manoeuvre and leave",
          ] },
        ],
      },
      {
        title: "The set-down area",
        blocks: [
          { type: "p", text: "Heavy cargo needs firm, level ground where it will be unloaded. Soft ground lets jacks and crane outriggers sink, and wet ground gets worse with every truck. Compacted hardstanding, steel plates or timber mats may be needed. If the cargo will be set down on sleepers and later moved to its foundation, the path between the two must be planned too." },
        ],
      },
      {
        title: "Equipment and people",
        blocks: [
          { type: "list", items: [
            "A crane of the right capacity, or jacks and sleepers for set-down without one",
            "A lifting plan for each heavy piece, agreed before the day",
            "A named receiver with authority to sign for the cargo",
            "Someone to take photographs and record the condition at unloading",
          ] },
        ],
      },
      {
        title: "Tell the forwarder",
        blocks: [
          { type: "p", text: "Before the first delivery, share the site layout, photographs of the access and the set-down area, the lifting arrangements and the receiving hours. The forwarder can then match the trailer and the timing to the site, rather than finding out at the gate." },
        ],
      },
    ],
    questions: [
      { question: "Who provides the crane?", answer: "Either the site or the delivery, as agreed in advance. Leaving it unclear is one of the commonest reasons a heavy delivery waits." },
      { question: "What if it rains on delivery day?", answer: "Wet ground can make unloading unsafe. Have a plan to delay, use mats or plates, or unload elsewhere." },
      { question: "Can deliveries happen at night?", answer: "Sometimes, if permitted and safe. Night deliveries need lighting and a receiver on site." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
];
