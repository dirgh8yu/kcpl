export type ServicePoint = {
  title: string;
  detail: string;
};

export type ServiceContent = {
  number: string;
  eyebrow: string;
  title: string;
  intro: string;
  overviewTitle: string;
  description: string;
  image: string;
  imageAlt: string;
  points: ServicePoint[];
  contextTitle: string;
  contextCopy: string;
  related: { title: string; href: string }[];
};

export const serviceContent = {
  "air-freight": {
    number: "01",
    eyebrow: "Air freight forwarding",
    title: "When timing shapes the route.",
    intro: "International air-cargo coordination for time-sensitive shipments moving to and from Nepal.",
    overviewTitle: "Air freight connected beyond the flight.",
    description: "KCPL coordinates the air-freight journey around the cargo, required timing and destination. The plan connects preparation and documentation in Nepal with airport handovers, flight routing and destination arrangements through the relevant logistics counterparts.",
    image: "/images/air-freight.jpg",
    imageAlt: "Cargo aircraft being loaded during airport freight operations",
    points: [
      { title: "Cargo and timing review", detail: "Align the shipment plan with the cargo profile and required delivery window." },
      { title: "Route and schedule coordination", detail: "Review practical flight routing and the ground stages connected to it." },
      { title: "Documentation readiness", detail: "Coordinate the shipment documents needed for the planned movement." },
      { title: "Airport and counterpart handovers", detail: "Connect origin handling with destination-side logistics coordination." },
    ],
    contextTitle: "For cargo where time, handling and connection matter.",
    contextCopy: "Air freight is one stage of a wider journey. KCPL keeps the airport, ground-transport, documentation and destination arrangements working as one route.",
    related: [{ title: "Ocean Freight", href: "/services/sea-freight" }, { title: "Door-to-Door Delivery", href: "/services/door-to-door" }],
  },
  "sea-freight": {
    number: "02",
    eyebrow: "Ocean freight forwarding",
    title: "Ocean routes built around a landlocked market.",
    intro: "Containerised and consolidated ocean freight coordinated through suitable regional port and inland connections.",
    overviewTitle: "The ocean leg is only part of the route.",
    description: "For Nepal, ocean freight depends on the connection between origin, port, border, customs and inland delivery. KCPL coordinates those stages through the relevant gateways and international counterparts, keeping the wider movement aligned around the cargo plan.",
    image: "/images/ocean-freight.jpg",
    imageAlt: "Container vessel and cargo operations at a commercial port",
    points: [
      { title: "Container and consolidation planning", detail: "Coordinate the suitable shipment structure around cargo volume and route." },
      { title: "Port-gateway connection", detail: "Plan the inland link between Nepal and the relevant regional port." },
      { title: "Documentation and handovers", detail: "Align shipment documentation with port and border movement stages." },
      { title: "Onward delivery planning", detail: "Connect arrival, customs coordination and the planned inland destination." },
    ],
    contextTitle: "Designed for the full port-to-Nepal connection.",
    contextCopy: "KCPL approaches ocean freight as a connected inland and international route—not as an isolated port booking.",
    related: [{ title: "Road Freight", href: "/services/road-freight" }, { title: "Open Top Container", href: "/services/open-top-container" }],
  },
  "road-freight": {
    number: "03",
    eyebrow: "Road freight forwarding",
    title: "Across Nepal. Across borders.",
    intro: "Road-freight planning for domestic movements and cargo travelling between Nepal and India.",
    overviewTitle: "Ground routes shaped around real handovers.",
    description: "KCPL plans road movements around the cargo, collection point, border or customs requirements and final delivery location. Domestic and cross-border stages are coordinated as part of the complete shipment route.",
    image: "/images/services/road-freight-nepal.jpg",
    imageAlt: "Representative freight truck travelling on a Nepal trade corridor",
    points: [
      { title: "Domestic movement", detail: "Coordinate pickup and road transport between commercial locations in Nepal." },
      { title: "Nepal–India connection", detail: "Plan cross-border road stages through the appropriate operational route." },
      { title: "Gateway handovers", detail: "Align border and customs coordination with the vehicle movement." },
      { title: "First and final mile", detail: "Connect the main freight stage with collection and planned delivery." },
    ],
    contextTitle: "A practical link between cargo, gateway and destination.",
    contextCopy: "Road freight carries more than the load itself. KCPL coordinates the timing, documentation and operational handovers that keep the movement connected.",
    related: [{ title: "Customs Coordination", href: "/services/customs-clearance" }, { title: "Ground Transport", href: "/services/ground-transport" }],
  },
  "project-cargo": {
    number: "04",
    eyebrow: "Project cargo",
    title: "Complex cargo needs one coordinated plan.",
    intro: "Transport planning for large, complex or high-value equipment that requires non-standard movement.",
    overviewTitle: "Plan the movement before the cargo moves.",
    description: "Project cargo can involve multiple transport stages, special handling, route constraints and carefully timed handovers. KCPL coordinates the route and participating logistics parties around the cargo’s specific requirements.",
    image: "/images/services/specialist-project-cargo.jpg",
    imageAlt: "Representative project cargo movement with an oversized industrial transformer on a multi-axle trailer",
    points: [
      { title: "Cargo and route assessment", detail: "Review dimensions, handling needs and the practical movement path." },
      { title: "Multi-stage coordination", detail: "Connect the transport modes and operational parties involved in the route." },
      { title: "Special-handling planning", detail: "Account for lifting, loading and non-standard transfer requirements." },
      { title: "Delivery-sequence alignment", detail: "Coordinate movement timing around the planned receiving stage." },
    ],
    contextTitle: "For movements that cannot rely on a standard freight pattern.",
    contextCopy: "The priority is a clear operational sequence: understand the cargo, define the route, coordinate each handover and keep the delivery plan visible.",
    related: [{ title: "Break Bulk Cargo", href: "/services/break-bulk-cargo" }, { title: "Open Top Container", href: "/services/open-top-container" }],
  },
  "break-bulk-cargo": {
    number: "05",
    eyebrow: "Break bulk cargo",
    title: "A practical route beyond the standard container.",
    intro: "Coordination for machinery, vehicles, construction materials and other non-containerised loads.",
    overviewTitle: "Cargo handled piece by piece, route by route.",
    description: "When cargo cannot move inside a standard container, the plan must account for its dimensions, lifting and handling points, port or terminal processes and inland connections. KCPL coordinates those requirements as one movement.",
    image: "/images/services/specialist-break-bulk.jpg",
    imageAlt: "Representative break bulk operation loading individual industrial cargo pieces onto a general cargo vessel",
    points: [
      { title: "Cargo-profile review", detail: "Consider dimensions, weight and the required loading method." },
      { title: "Port and terminal coordination", detail: "Align non-containerised handling with the wider freight route." },
      { title: "Machinery and vehicle movements", detail: "Plan suitable handling for individual large cargo units." },
      { title: "Inland transport connection", detail: "Coordinate the road stage between gateway and destination." },
    ],
    contextTitle: "Built around cargo that travels outside the box.",
    contextCopy: "Break bulk movements depend on careful alignment between equipment, handling points and transport stages. KCPL keeps those interfaces connected.",
    related: [{ title: "Project Cargo", href: "/services/project-cargo" }, { title: "Ground Transport", href: "/services/ground-transport" }],
  },
  "open-top-container": {
    number: "06",
    eyebrow: "Open top container",
    title: "Access for cargo beyond standard dimensions.",
    intro: "Container planning for oversized cargo requiring top-loading or non-standard access.",
    overviewTitle: "A container option shaped around access.",
    description: "Open top containers can accommodate cargo that cannot be loaded through standard container doors. KCPL coordinates the container choice with cargo dimensions, loading requirements, the ocean leg and the connected inland route.",
    image: "/images/services/specialist-open-top.jpg",
    imageAlt: "Representative open top container operation lowering oversized machinery through the open roof",
    points: [
      { title: "Cargo-dimension review", detail: "Assess the dimensions and access requirements that affect container planning." },
      { title: "Top-loading coordination", detail: "Align the loading method with the cargo and handling sequence." },
      { title: "Ocean-freight connection", detail: "Coordinate the specialist container within the wider port route." },
      { title: "Inland and delivery stages", detail: "Connect port movement with border, road and destination planning." },
    ],
    contextTitle: "Non-standard access, coordinated as a complete route.",
    contextCopy: "The container is one decision. KCPL connects that choice to handling, ocean freight, inland movement and the receiving plan.",
    related: [{ title: "Ocean Freight", href: "/services/sea-freight" }, { title: "Project Cargo", href: "/services/project-cargo" }],
  },
  warehousing: {
    number: "07",
    eyebrow: "Warehousing",
    title: "Storage connected to the shipment plan.",
    intro: "Cargo warehousing and handling coordinated around broader freight requirements.",
    overviewTitle: "A controlled pause within a moving route.",
    description: "KCPL can coordinate warehousing as part of a wider freight movement, helping align cargo receiving, storage, preparation and release with the next planned transport stage.",
    image: "/images/services/warehousing.jpg",
    imageAlt: "Representative cargo warehouse with pallets and handling equipment",
    points: [
      { title: "Receiving coordination", detail: "Align inbound cargo receipt with the wider movement plan." },
      { title: "Pre-shipment storage", detail: "Coordinate storage between preparation and dispatch stages." },
      { title: "Release planning", detail: "Match cargo availability with the planned freight schedule." },
      { title: "Handling requirements", detail: "Arrange handling around the known cargo profile and next movement." },
    ],
    contextTitle: "Storage should support the route—not interrupt it.",
    contextCopy: "KCPL coordinates warehousing in relation to the shipment timetable, cargo handovers and the next transport decision.",
    related: [{ title: "Packaging & Storage", href: "/services/packaging-storage" }, { title: "Ground Transport", href: "/services/ground-transport" }],
  },
  "packaging-storage": {
    number: "08",
    eyebrow: "Packaging & storage",
    title: "Prepare the cargo for the journey ahead.",
    intro: "Packaging and storage coordinated around transport and handling requirements.",
    overviewTitle: "Preparation affects every stage that follows.",
    description: "Cargo preparation can shape loading, handling and transport decisions later in the route. KCPL coordinates packaging and storage requirements as part of the shipment plan, with the next movement kept in view.",
    image: "/images/services/packaging-storage.jpg",
    imageAlt: "Representative cargo crate being secured for freight transport",
    points: [
      { title: "Packaging requirement review", detail: "Consider the cargo profile and planned handling environment." },
      { title: "Pre-dispatch preparation", detail: "Coordinate packaging before the scheduled movement begins." },
      { title: "Storage alignment", detail: "Connect temporary storage with the intended dispatch timetable." },
      { title: "Handling readiness", detail: "Prepare the cargo for the planned transfers along the route." },
    ],
    contextTitle: "Cargo prepared with the complete route in mind.",
    contextCopy: "The objective is practical readiness: packaging, storage and dispatch coordinated around how the cargo will actually move.",
    related: [{ title: "Warehousing", href: "/services/warehousing" }, { title: "Door-to-Door Delivery", href: "/services/door-to-door" }],
  },
  "ground-transport": {
    number: "09",
    eyebrow: "Ground transport",
    title: "Connect every freight stage on the ground.",
    intro: "Road transport coordinated with collection, airport, port, customs and delivery requirements.",
    overviewTitle: "The link between every major freight stage.",
    description: "Ground transport connects air and ocean freight with origin pickup, border or customs handovers and final delivery. KCPL plans these road stages around the wider route rather than treating them as separate movements.",
    image: "/images/services/road-freight-nepal.jpg",
    imageAlt: "Representative commercial freight truck on a Nepal highway",
    points: [
      { title: "Origin collection", detail: "Coordinate the first road stage from the agreed collection point." },
      { title: "Airport and port connection", detail: "Align ground movement with the main international freight leg." },
      { title: "Border and customs transfer", detail: "Connect vehicle timing with gateway coordination requirements." },
      { title: "Final-mile delivery", detail: "Plan the last road stage through to the agreed destination." },
    ],
    contextTitle: "One ground plan connecting the wider shipment.",
    contextCopy: "KCPL uses ground transport to keep freight stages connected—from collection and gateway transfer through to delivery.",
    related: [{ title: "Road Freight", href: "/services/road-freight" }, { title: "Door-to-Door Delivery", href: "/services/door-to-door" }],
  },
  "door-to-door": {
    number: "10",
    eyebrow: "Door-to-door delivery",
    title: "One journey, coordinated end to end.",
    intro: "Pickup-to-delivery logistics planned through one clear point of coordination.",
    overviewTitle: "Bring the shipment stages into one plan.",
    description: "Door-to-door service connects origin collection, freight movement, border or port handovers and final delivery. KCPL coordinates those stages around the agreed route and cargo requirements.",
    image: "/images/services/door-to-door.jpg",
    imageAlt: "Representative commercial cargo handover at a receiving entrance",
    points: [
      { title: "Origin pickup", detail: "Coordinate cargo collection at the start of the planned movement." },
      { title: "Freight-mode planning", detail: "Connect air, ocean or road freight with the complete route." },
      { title: "Gateway handovers", detail: "Align customs, border or port stages with onward movement." },
      { title: "Final delivery", detail: "Coordinate the last transport stage to the agreed destination." },
    ],
    contextTitle: "A clearer journey from first pickup to final handover.",
    contextCopy: "The value is coordination across the interfaces. KCPL keeps the participating stages connected through one shipment plan.",
    related: [{ title: "Air Freight", href: "/services/air-freight" }, { title: "Ground Transport", href: "/services/ground-transport" }],
  },
  "customs-clearance": {
    number: "11",
    eyebrow: "Customs coordination",
    title: "Documentation and gateways handled with clarity.",
    intro: "Customs documentation and clearance coordination supporting cargo movement through Nepal’s trade gateways.",
    overviewTitle: "Present where the route crosses systems.",
    description: "KCPL combines its operational network with personnel positioned across Nepal’s customs entry points to coordinate shipment documentation, operational communication and the handovers required for cargo movement.",
    image: "/images/services/road-freight-nepal.jpg",
    imageAlt: "Representative freight movement approaching a Nepal trade corridor",
    points: [
      { title: "Shipment-document review", detail: "Coordinate the available cargo and transport documentation for the planned route." },
      { title: "Entry-point coordination", detail: "Connect shipment activity with personnel at Nepal customs gateways." },
      { title: "Border and gateway handovers", detail: "Align the operational transfer between participating transport stages." },
      { title: "Route communication", detail: "Keep the relevant parties informed as the cargo moves through the gateway." },
    ],
    contextTitle: "Customs coordination as part of the route—not an isolated step.",
    contextCopy: "KCPL connects documentation and entry-point activity with the transport plan before and after the customs stage.",
    related: [{ title: "Road Freight", href: "/services/road-freight" }, { title: "Ocean Freight", href: "/services/sea-freight" }],
  },
} satisfies Record<string, ServiceContent>;

export const freightServiceKeys = ["air-freight", "sea-freight", "road-freight"] as const;
export const specialistServiceKeys = ["project-cargo", "break-bulk-cargo", "open-top-container"] as const;
export const handlingServiceKeys = ["warehousing", "packaging-storage", "ground-transport", "door-to-door", "customs-clearance"] as const;
