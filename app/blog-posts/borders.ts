import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const borderPosts: readonly BlogPost[] = [
  {
    slug: "china-to-nepal-sea-or-road",
    topic: "borders",
    title: "China to Nepal: by sea through India, or by road",
    description: "Cargo from China reaches Nepal by sea through an Indian port, or by road over the Himalayan border. How the two routes compare on risk, size and time.",
    intro: "A shipment from China can reach Nepal by sea through India, or overland across the Tibetan border. The map makes the road look obvious. The freight desk often chooses the sea.",
    published,
    cover: "ship-terminal",
    coverCaption: "Most container cargo from China still reaches Nepal by sea, through an Indian gateway.",
    sections: [
      {
        title: "The sea route",
        blocks: [
          { type: "p", text: "Containers sail from Chinese ports such as Shanghai, Ningbo, Qingdao or Shekou to Kolkata, Haldia or Visakhapatnam, then cross India in transit to the dry port at Birgunj. The route is long in kilometres, but it runs on regular shipping and rail services, takes full containers of any weight the road allows, and handles over-dimensional cargo on flat-racks and open-tops." },
          { type: "p", text: "For full containers, heavy machinery and project equipment, it is usually the dependable choice. Its risks are the familiar ones: a late release of the bill of lading, a missed connection at a transshipment hub, and congestion at the gateway." },
        ],
      },
      {
        title: "The road route",
        blocks: [
          { type: "p", text: "Overland, cargo travels by truck across China to the Tibetan border and enters Nepal at Rasuwagadhi, opposite Kerung, or at Tatopani, opposite Zhangmu. Chinese consolidators run regular LCL services from cities such as Guangzhou to these crossings. Cargo is usually handed from Chinese to Nepali trucks at or near the border and cleared at the Nepal customs office there." },
          { type: "p", text: "The road is shorter, but its last stretches are mountain roads that are narrow, steep and exposed to landslides in the monsoon. Crossings have closed for long periods in the past, for reasons from earthquakes to public health. Large or heavy pieces may not suit the road at all." },
        ],
      },
      {
        title: "How to choose",
        blocks: [
          { type: "list", items: [
            "Full containers, heavy units and project cargo: usually by sea",
            "Smaller, lighter consignments from southern China: often by road LCL",
            "Cargo needed during the monsoon: check the state of the border roads first, or plan the sea route",
            "Tight deadlines: compare door-to-door dates, not the distance on a map",
            "Over-dimensional pieces: by sea, after a route survey",
          ] },
          { type: "p", text: "Whichever route you choose, the Nepal customs papers are the same in principle: a correct invoice, a matching packing list, the transport document and any permits. What changes is where the clearance happens and how long the cargo can safely wait there." },
        ],
      },
      {
        title: "Ask for both",
        blocks: [
          { type: "p", text: "When you send an enquiry for cargo from China, ask your forwarder to price both routes with realistic dates. The difference is sometimes small enough that reliability decides it, and sometimes large enough to change how you order." },
        ],
      },
    ],
    questions: [
      { question: "Is the road route always cheaper from China?", answer: "Not always. Road LCL can be competitive for small, light consignments from southern China, but full containers, heavy goods and over-dimensional cargo usually cost less and travel more safely by sea. Compare door-to-door prices with realistic dates for your actual cargo." },
      { question: "Can a full container come by road over the northern border?", answer: "Cargo crossing the northern border is usually handed over between trucks, and the mountain roads limit size and weight. Large volumes often travel more reliably by sea. Ask your forwarder about the current situation before planning a full load by road." },
      { question: "Do Nepal customs rules differ by route?", answer: "The rules are the same. The clearance happens at a different office, the northern border for road cargo and usually Birgunj for sea cargo, and each office has its own working conditions." },
    ],
    related: { service: service.ocean, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "shipping-through-kerung-and-rasuwagadhi",
    topic: "borders",
    title: "Shipping through Kerung and Rasuwagadhi",
    description: "What to plan for when cargo from China enters Nepal at Rasuwagadhi, opposite Kerung: consolidation, the border hand-over, customs and the road south.",
    intro: "Rasuwagadhi, opposite Kerung in Tibet, is one of Nepal's main road crossings with China. It works well when the plan respects the mountains on either side.",
    published,
    cover: "nepal-road",
    coverCaption: "The road from the northern border down to Kathmandu is a mountain road for most of its length.",
    sections: [
      {
        title: "How cargo crosses",
        blocks: [
          { type: "steps", items: [
            { title: "Consolidation in China", copy: "Cargo is collected from suppliers and loaded at a consolidator's warehouse, often in southern China, for trucking to the border." },
            { title: "Chinese export formalities", copy: "The goods are declared for export from China, usually handled by the consolidator or its broker." },
            { title: "The hand-over", copy: "At the border, cargo moves from Chinese to Nepali transport. Every package should be counted and checked against the packing list here." },
            { title: "Nepal customs", copy: "Import clearance happens at the Nepal customs office for the crossing, with duty and VAT paid before release." },
            { title: "The road south", copy: "Nepali trucks carry the cargo down to Kathmandu or onward, over a narrow mountain road." },
          ] },
        ],
      },
      {
        title: "What to plan for",
        blocks: [
          { type: "p", text: "The crossing itself is only part of the journey. The road between the border and the Kathmandu valley climbs and drops through steep, landslide-prone country. In the monsoon it can close for hours or days, and trucks queue at both ends until it reopens." },
          { type: "list", items: [
            "Allow extra days from June to September, when landslides are most frequent",
            "Pack for rough roads and repeated handling: strong cartons, strapping and pallets",
            "Avoid very long or very heavy pieces unless the road has been checked for them",
            "Keep copies of every document with the cargo, as well as with your agent",
          ] },
        ],
      },
      {
        title: "Papers that make it smooth",
        blocks: [
          { type: "p", text: "The commercial invoice and packing list should describe each item clearly, with HS codes and values that match. Mixed consolidations with vague descriptions such as general goods are the ones customs stops. If your cargo shares a truck with other importers, ask the consolidator how a problem with someone else's papers is handled, so yours is not held with it." },
        ],
      },
      {
        title: "When the crossing closes",
        blocks: [
          { type: "p", text: "Border crossings with China have closed before, sometimes for long periods. For goods you cannot be without, keep a fallback: a second supplier, a buffer of stock, or the sea route through India for the next order. Ask your forwarder about the current state of the crossing before placing a large order on it." },
        ],
      },
    ],
    questions: [
      { question: "How long does cargo take from southern China by this route?", answer: "It depends on the consolidator's schedule, the border's working days and the state of the roads on both sides. In the monsoon, closures can add days. Ask for recent transit times rather than a brochure figure." },
      { question: "Can I visit the border to check my cargo?", answer: "Cargo is inspected and cleared under customs control, and your agent there is the best person to check it. Ask for a package count and photographs at the hand-over." },
      { question: "What if my goods are damaged at the hand-over?", answer: "Have your agent record the damage with photographs and package numbers before the Nepali truck leaves, and notify your insurer and the consolidator in writing at once. Damage reported later is much harder to place." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "lcl-from-guangzhou-via-tatopani",
    topic: "borders",
    title: "LCL from Guangzhou to Nepal over the Tatopani border",
    description: "How shared-truck LCL cargo moves from southern China to Nepal through Tatopani: consolidation, the cut-off, marks, the border hand-over and Nepal customs.",
    intro: "For smaller orders from southern China, a shared truck to the Tatopani border is a common route into Nepal. It rewards importers who prepare their suppliers well.",
    published,
    cover: "ghat-road",
    coverCaption: "Road LCL from China ends with a long climb through the hills.",
    sections: [
      {
        title: "How the service works",
        blocks: [
          { type: "p", text: "A consolidator in China collects small consignments from many suppliers into its warehouse, loads them on trucks to the border, and hands them over to a Nepali partner for customs and delivery. You pay by the cubic metre or the tonne for your share. The service runs on a schedule, and each truck has a cut-off date for cargo to reach the warehouse." },
        ],
      },
      {
        title: "Preparing the supplier",
        blocks: [
          { type: "list", items: [
            "Give the supplier the consolidator's warehouse address and the cut-off date",
            "Ask for every carton to be marked with your name, the destination and its number, such as 4 of 20",
            "Ask for a packing list that gives each carton's size and weight",
            "Ask for an invoice that names each item properly, with quantities and unit prices",
            "Ask for strong export cartons: the cargo will be handled several times",
          ] },
          { type: "p", text: "A supplier who delivers late misses the truck, and the next one may be a week away. One who delivers unmarked cartons risks your cargo being mixed with someone else's." },
        ],
      },
      {
        title: "At the border",
        blocks: [
          { type: "p", text: "The hand-over from Chinese to Nepali transport is where shortages and damage are found. Ask your agent for a count of your packages at the border, and photographs of anything damaged. Claims are much easier to make with a record from the hand-over than with one from your warehouse days later." },
          { type: "p", text: "Customs clearance follows at the Nepal office for the crossing. Duty and VAT are assessed on the declared value and the HS codes. In a shared consignment, each importer's goods are declared and cleared separately." },
        ],
      },
      {
        title: "Know the road",
        blocks: [
          { type: "p", text: "The road from Tatopani to Kathmandu runs through steep valleys where landslides are common in the monsoon. Crossings on the Chinese border have also closed for long periods in the past. For anything time-critical, ask about the current state of the route before your supplier ships." },
        ],
      },
    ],
    questions: [
      { question: "Can I pay the Chinese consolidator directly?", answer: "Payment arrangements depend on your agreement and Nepal's foreign exchange rules, which your bank applies. Ask your bank and your Nepal agent how freight for this route is invoiced and paid before you book." },
      { question: "What happens if my supplier misses the truck?", answer: "The cargo waits at the consolidator's warehouse for the next departure, which may be a week or more later. Give your supplier the cut-off date with some margin." },
      { question: "Is Tatopani or Rasuwagadhi better?", answer: "It depends on the consolidator's service, the roads at that time of year and the state of each crossing. Your forwarder can tell you which one is running more reliably when you are ready to ship." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "hs-codes-and-import-duty"], tool: "volume-weight" },
  },
  {
    slug: "india-to-nepal-by-road",
    topic: "borders",
    title: "India to Nepal by road: factory gate to Nepal customs",
    description: "How goods bought from an Indian factory travel by truck to Nepal: the Indian export papers, the border crossing, Nepal customs and delivery to your site.",
    intro: "Most of Nepal's trade with India moves by road. A truck leaves a factory in India, crosses at a border point such as Raxaul, and clears Nepal customs on the other side.",
    published,
    cover: "ghat-trucks",
    coverCaption: "Trucks from Indian factories carry most of what Nepal buys from India.",
    sections: [
      {
        title: "The journey",
        blocks: [
          { type: "steps", items: [
            { title: "At the factory", copy: "The supplier raises an export invoice and a packing list, and loads the truck. The truck needs papers to move inside India as well as to leave it." },
            { title: "Indian export clearance", copy: "At the border, the supplier's customs broker files the export declaration with Indian customs at the land customs station or check post." },
            { title: "Crossing", copy: "Once Indian customs releases the truck, it crosses into Nepal." },
            { title: "Nepal import clearance", copy: "The importer's customs agent declares the goods to Nepal customs. Duty and VAT are assessed and paid, and the cargo may be inspected." },
            { title: "Delivery", copy: "The truck continues to your warehouse or site, or the cargo is moved to a Nepali truck for the last leg." },
          ] },
        ],
      },
      {
        title: "Choosing the border point",
        blocks: [
          { type: "p", text: "Nepal has many customs points along the Indian border. The right one is usually the one closest to your destination that handles your kind of cargo: Birgunj for Kathmandu and central Nepal, Biratnagar for the east, Bhairahawa for the west-central hills, and Nepalgunj for the mid-west. Busy points can mean queues of trucks, so ask how long the crossing is taking that week." },
        ],
      },
      {
        title: "Where it goes wrong",
        blocks: [
          { type: "list", items: [
            "The invoice description is too vague for customs on either side",
            "The weight on the papers does not match the weighbridge",
            "The Nepal importer's details are wrong on the invoice",
            "The Indian broker and the Nepal agent are not talking, so the truck waits between them",
            "The truck arrives on a holiday or after hours, and waits",
          ] },
          { type: "p", text: "The last two are why it helps to have one party coordinating both sides of the border. The Indian clearance, the crossing and the Nepal clearance are booked against one plan, so a truck is not standing at the border waiting for someone to be told it has arrived." },
        ],
      },
      {
        title: "What to agree with your supplier",
        blocks: [
          { type: "p", text: "Agree who arranges and pays for each part: the truck, the Indian export clearance, the crossing and the Nepal side. Agree the border point. Ask for the invoice and packing list before the truck is loaded, so they can be checked against what Nepal customs will expect." },
        ],
      },
    ],
    questions: [
      { question: "Can my Indian supplier deliver to my door in Nepal?", answer: "Some can, through their own transporter and a Nepal agent. More often, the supplier delivers to the border or hands over to your forwarder. Agree in writing who does each part and who pays." },
      { question: "How long does the border crossing take?", answer: "It depends on the queue, the papers and the day. With documents checked in advance and payment ready, a crossing can be quick. With papers started on arrival, or on a holiday, it can take days." },
      { question: "Do I need insurance for a road shipment from India?", answer: "It is strongly advised. Road transport carries risks of accident, theft and weather, and carriers' liability is limited. Make sure the cover includes the transit and any waiting at the border." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "raxaul-and-birgunj-crossing",
    topic: "borders",
    title: "Raxaul and Birgunj: how the main crossing works",
    description: "Raxaul and Birgunj sit on Nepal's busiest trade route with India. How trucks, rail containers and customs work at the crossing, and where delays build.",
    intro: "Raxaul in India and Birgunj in Nepal face each other across the border on the main road from Kolkata to Kathmandu. A large share of Nepal's imports passes between them.",
    published,
    cover: "kathmandu",
    coverCaption: "Much of what the Kathmandu valley imports from India and overseas comes through Birgunj.",
    sections: [
      {
        title: "Two ways in",
        blocks: [
          { type: "p", text: "Cargo reaches Birgunj by road, crossing from Raxaul, or by rail into the inland container depot just outside the town. Trucks carry goods from Indian factories and from the port of Kolkata. Rail brings sea containers from Kolkata, Haldia and Visakhapatnam. The two flows meet Nepal customs at different places, so it is worth knowing which one your cargo is on." },
        ],
      },
      {
        title: "By road",
        blocks: [
          { type: "p", text: "Trucks clear Indian customs on the Raxaul side and Nepal customs on the Birgunj side. The crossing handles a heavy flow of trade, and queues of trucks can build up, especially before festivals, after holidays and when papers are not ready. A truck whose clearance has been prepared in advance spends far less time in the queue than one whose papers are started when it arrives." },
        ],
      },
      {
        title: "By rail",
        blocks: [
          { type: "p", text: "Containers by rail arrive at the dry port, where they are cleared through Nepal customs, released, and either taken out on a trailer or unloaded there. The free days at the dry port start on arrival, so the clearance papers should be ready before the train is." },
        ],
      },
      {
        title: "Making the crossing quick",
        blocks: [
          { type: "list", items: [
            "Send the invoice, packing list and transport document to your Nepal agent before the cargo reaches the border",
            "Check that the descriptions, weights and package counts agree on every paper",
            "Have the duty and VAT payment ready before the cargo arrives",
            "Plan around the major festivals on both sides of the border",
            "Book the onward truck or trailer so it is waiting when the cargo is released",
          ] },
        ],
      },
      {
        title: "Why one plan matters here",
        blocks: [
          { type: "p", text: "At Raxaul and Birgunj, the Indian clearance, the crossing and the Nepal clearance are three steps handled by different offices. A shipment moves fastest when one team is watching all three and booking each step as the last one finishes. KCPL has staff on both sides of this crossing for that reason." },
        ],
      },
    ],
    questions: [
      { question: "Why is there a queue of trucks at the border?", answer: "Trade volumes are high, and trucks wait for clearance on both sides. Queues grow before festivals, after holidays and when many trucks arrive with incomplete papers. Pre-checked documents shorten your time in it." },
      { question: "Does my truck need to wait at Raxaul or Birgunj?", answer: "That depends on where the clearance is and whether the papers are ready. A good plan keeps the truck moving from Indian clearance to Nepal clearance with as little waiting as possible." },
      { question: "Is the dry port the same as the road border?", answer: "No. The road crossing handles trucks. The dry port, a short distance away, handles containers that arrive by rail. Both are on the Birgunj side and deal with Nepal customs." },
    ],
    related: { service: service.road, guides: ["customs-clearance-in-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "freight-for-eastern-nepal-via-jogbani",
    topic: "borders",
    title: "Eastern Nepal freight through Jogbani and Biratnagar",
    description: "For cargo bound for eastern Nepal, the Jogbani and Biratnagar crossing is often closer than Birgunj. When it makes sense, and planning the hill roads.",
    intro: "Not every import for Nepal should cross at Birgunj. For Biratnagar, Itahari and the eastern hills, the crossing at Jogbani and Biratnagar can save a long drive across the Terai.",
    published,
    cover: "ghat-tunnel",
    coverCaption: "Roads into the eastern hills set the size of truck a delivery can use.",
    sections: [
      {
        title: "Why cross in the east",
        blocks: [
          { type: "p", text: "Biratnagar is one of Nepal's largest industrial centres, and the eastern hills beyond it hold many hydropower and transmission projects. Cargo for these places that crosses at Birgunj has to travel east across the Terai after clearance. Crossing at Jogbani, on the Indian side, and clearing at Biratnagar puts the cargo much closer to where it is going." },
        ],
      },
      {
        title: "What arrives this way",
        blocks: [
          { type: "list", items: [
            "Trucks from Indian factories, especially in eastern India",
            "Containers trucked from Kolkata for consignees in the east",
            "Project cargo for sites in the eastern hills, such as cable drums and tower steel",
            "Goods for industries around Biratnagar and Itahari",
          ] },
        ],
      },
      {
        title: "Planning the hills",
        blocks: [
          { type: "p", text: "Beyond the plains, roads into the eastern hills climb through narrow sections with tight bends. A truck that crosses the border easily may not reach a hill site fully loaded. For project cargo, the route from the border to the site is surveyed before the truck size is chosen, and loads may be split or moved to smaller trucks for the last stretch." },
          { type: "p", text: "Monsoon rains close hill roads more often than plains roads. Deliveries planned for June to September need extra days and a place to hold the cargo safely if a road closes." },
        ],
      },
      {
        title: "The papers are the same",
        blocks: [
          { type: "p", text: "The customs process at Biratnagar follows the same rules as at Birgunj: a correct invoice and packing list, the transport document, any permits or exemption letters, and duty and VAT paid before release. What differs is the local office, the local queue and who your agent knows there. Ask your forwarder which crossing they recommend for your consignee, and why." },
        ],
      },
    ],
    questions: [
      { question: "Can containers by rail go to Biratnagar?", answer: "Rail-linked container services for Nepal centre on Birgunj. For the east, containers are commonly trucked from Kolkata, or cleared at Birgunj and moved east. Ask which is better for your cargo and consignee." },
      { question: "Is clearance slower at Biratnagar than Birgunj?", answer: "Not necessarily. Each office has its own workload. What matters most is that your documents are complete and your agent knows the office." },
      { question: "Can project cargo for the eastern hills cross here?", answer: "Yes, if the route from the border to the site has been surveyed and suits the loads. Over-dimensional cargo needs that survey before the crossing is chosen." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "reaching-western-nepal",
    topic: "borders",
    title: "Reaching western Nepal: Nepalgunj and Surkhet",
    description: "How freight reaches Nepalgunj, Surkhet and the mid-west: crossing at Rupaidiha, the roads north, and deliveries far from the Birgunj corridor.",
    intro: "Western Nepal is a long way from the Birgunj corridor. For Nepalgunj, Surkhet and the mid-west, cargo often crosses closer to home, at Rupaidiha and Nepalgunj.",
    published,
    cover: "nepal-road",
    coverCaption: "From Nepalgunj, deliveries head north into the hills towards Surkhet.",
    sections: [
      {
        title: "Two ways west",
        blocks: [
          { type: "p", text: "Cargo for the mid-west can clear at Birgunj and then travel west across Nepal, or it can travel across India and cross at Rupaidiha into Nepalgunj. For heavy cargo and full containers, the second route often means fewer kilometres on Nepal's roads and less handling. The choice depends on the origin, the cargo and where the consignee actually is." },
        ],
      },
      {
        title: "A recorded movement",
        blocks: [
          { type: "p", text: "In one movement, six 40-foot containers travelled from Shanghai through Kolkata to Nepalgunj on DDU terms. The work included checking the draft bill of lading, following up the original documents, customs at Kolkata, dispatch, and unloading at Nepalgunj. Photographs and a delivery receipt were sent on 17 April 2026." },
          { type: "p", text: "The lesson is not that every container should go to Nepalgunj. It is that the gateway, the crossing and the last stretch were planned as one journey, with records at each hand-over." },
        ],
      },
      {
        title: "Beyond Nepalgunj",
        blocks: [
          { type: "p", text: "From the plains, roads climb north towards Surkhet and further into the hills. Project sites in the mid-west often sit at the end of narrow roads where a full-length trailer cannot go. Conductor drums, tower steel and transformers for these sites are planned truck by truck, with the route surveyed first and deliveries phased to what the site can receive." },
          { type: "list", title: "Ask before booking", items: [
            "Can the consignee's site take a container trailer, or must cargo be unloaded at Nepalgunj?",
            "Is there secure, level space to hold cargo if the site is not ready?",
            "Who signs for the cargo at the site, and what record do they need?",
            "What happens if a hill road closes in the monsoon?",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Is it cheaper to clear at Nepalgunj or at Birgunj?", answer: "It depends on the origin and the cargo. For goods coming across northern India, crossing at Nepalgunj can cut a long drive inside Nepal. For containers arriving by rail at Birgunj, it may be simpler to clear there. Ask for both." },
      { question: "Can a 40-foot container reach Surkhet?", answer: "Possibly, depending on the exact address, the road and the season. Many deliveries in the hills move into smaller trucks first. A short survey of the road answers it." },
      { question: "What does KCPL do in the west?", answer: "KCPL has staff in Nepalgunj and Surkhet who handle clearance coordination, deliveries and records for consignees and project sites in the mid-west." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "nepal-customs-points-for-freight",
    topic: "borders",
    title: "Nepal's customs points: which ones matter for freight",
    description: "Nepal has customs offices along both borders, but only some suit commercial freight. How to tell which crossing fits your cargo, and why it matters.",
    intro: "Nepal's Department of Customs runs offices along the borders with India and China. Only some see regular commercial freight, and choosing the right one matters.",
    published,
    cover: "clipboard-sign",
    coverCaption: "The customs office decides where the papers are checked, and that decides where the cargo waits.",
    sections: [
      {
        title: "The map",
        blocks: [
          { type: "p", text: "The Department of Customs lists more than twenty customs offices on the border with India, from Kanchanpur in the far west to Mechi and Pashupatinagar in the east. On the border with China, the department's own site names Rasuwa, Tatopani and Mustang among its offices. Our network page lists the points, west to east." },
          { type: "p", text: "A few of these offices handle most commercial freight: Birgunj, Biratnagar, Bhairahawa and Nepalgunj on the Indian border, and Rasuwa and Tatopani on the Chinese border. Smaller offices may handle local trade but have less experience with containers, project cargo or unusual goods." },
        ],
      },
      {
        title: "What to weigh",
        blocks: [
          { type: "list", items: [
            "Distance from the border to the consignee, and the roads between",
            "Whether the office regularly handles your kind of cargo",
            "Space at the border to hold or unload cargo while it is cleared",
            "Rail access, if the cargo is a container coming by train",
            "How long the queue is at that point, that month",
          ] },
        ],
      },
      {
        title: "The busy offices",
        blocks: [
          { type: "steps", items: [
            { title: "Birgunj", copy: "The main gateway for Kathmandu and central Nepal, with a road crossing and a rail-linked dry port." },
            { title: "Biratnagar", copy: "The main crossing for eastern Nepal's industry and the eastern hills." },
            { title: "Bhairahawa", copy: "For the west-central region, including Butwal and the roads to Pokhara." },
            { title: "Nepalgunj", copy: "For the mid-west, including Surkhet and the hills beyond." },
            { title: "Rasuwa and Tatopani", copy: "The main road crossings for cargo from China, subject to the mountain roads behind them." },
          ] },
        ],
      },
      {
        title: "Ask before you commit",
        blocks: [
          { type: "p", text: "Before your supplier ships, agree the customs point with your forwarder and write it into the transport papers. Changing it later means new papers and new waiting." },
        ],
      },
    ],
    questions: [
      { question: "Can I clear at any customs office I choose?", answer: "In principle, goods can be declared at customs offices on the route, but some offices handle only certain goods or volumes, and the transport documents must name the point. Agree it before shipping." },
      { question: "Are the China-border offices all open for trade?", answer: "Not all of them handle regular commercial freight, and crossings have closed for long periods in the past. Check the current status of the crossing you plan to use." },
      { question: "Where can I see the full list of customs points?", answer: "The Department of Customs publishes its offices. KCPL's network page lists the points on both borders, from west to east." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "importing-to-nepal"] },
  },
  {
    slug: "delhi-to-kathmandu-road-or-air",
    topic: "borders",
    title: "Delhi to Kathmandu cargo: road or air?",
    description: "Moving goods from Delhi to Kathmandu by truck or by air: how weight, value, urgency and paperwork decide, and why the cheaper mode is not always best.",
    intro: "Between Delhi and Kathmandu, cargo can go by road in a few days or by air in a few hours. The right choice depends on what the goods are and what a delay would cost.",
    published,
    cover: "ghat-tunnel",
    coverCaption: "By road, the time on the highway is predictable. The time at the border is not.",
    sections: [
      {
        title: "By road",
        blocks: [
          { type: "p", text: "A truck from Delhi crosses northern India to a border point and clears customs on both sides before continuing to Kathmandu. It suits most commercial cargo: it carries heavy and bulky goods, costs far less per kilo than air, and full or part loads are easy to arrange." },
          { type: "p", text: "The time on the road is predictable. The time at the border is not. A clearance that starts when the truck arrives, or a truck that reaches the border on a holiday, can add days." },
        ],
      },
      {
        title: "By air",
        blocks: [
          { type: "p", text: "Flights between Delhi and Kathmandu carry cargo in the hold. Air suits small, valuable or urgent consignments: spare parts for a stopped machine, samples, medical supplies or documents. Air freight is charged on the greater of the actual weight and the volume weight, so a large, light box costs more than its weight suggests." },
        ],
      },
      {
        title: "How to decide",
        blocks: [
          { type: "list", items: [
            "What does a day's delay cost you? If it is more than the price difference, fly it",
            "Is the cargo light and compact, or heavy and bulky?",
            "Is the cargo accepted by air? Some goods, such as many batteries and chemicals, need dangerous goods handling",
            "Do you need it in Kathmandu or somewhere the airport is far from?",
          ] },
        ],
      },
      {
        title: "Paperwork for both",
        blocks: [
          { type: "p", text: "Either way, the goods leave India as an export and enter Nepal as an import. The supplier's export invoice and packing list, the transport document and the Nepal customs declaration are needed by road or air. Customs at Kathmandu airport and at the land border apply the same duty rules." },
        ],
      },
    ],
    questions: [
      { question: "Can road cargo from Delhi be tracked?", answer: "Your forwarder can give you milestones: dispatch, arrival at the border, clearance and delivery. Not every transporter offers live tracking, so ask what updates you will receive." },
      { question: "Is there a weight limit for air cargo from Delhi?", answer: "Each flight and aircraft has limits on piece size and weight. Heavy or bulky items may need a different flight, or the road. Send the dimensions of the largest piece when you ask." },
      { question: "Do I pay the same duty by road and by air?", answer: "The duty rate is set by the goods, not the mode. The customs value may differ slightly because freight costs to the customs point are taken into account." },
    ],
    related: { service: service.air, guides: ["air-freight-to-kathmandu", "importing-to-nepal"], tool: "volume-weight" },
  },
  {
    slug: "buying-from-an-indian-supplier",
    topic: "borders",
    title: "Buying from an Indian supplier: papers a truck needs",
    description: "When an Indian supplier ships to Nepal by road, the truck needs papers for both countries. What to ask your supplier for so it is not stopped on the way.",
    intro: "A truck from an Indian factory to Nepal is an export from India before it is an import into Nepal. Both countries' papers have to be right for it to cross without waiting.",
    published,
    cover: "tariff-ledger",
    coverCaption: "Most border delays begin with an invoice that was not checked before the truck was loaded.",
    sections: [
      {
        title: "The Indian side",
        blocks: [
          { type: "p", text: "Your supplier exports the goods from India. That means an export invoice, a packing list, and the documents Indian law asks for when goods move by road inside India, such as an e-way bill for consignments above a value threshold. At the border, the supplier's customs broker files the export declaration with Indian customs." },
          { type: "p", text: "Ask your supplier which broker they use at the border, and share your Nepal agent's contact with them. The two need to coordinate on the day the truck arrives." },
        ],
      },
      {
        title: "The Nepal side",
        blocks: [
          { type: "list", items: [
            "An invoice with your name and address exactly as registered in Nepal",
            "A clear description of each item, with quantity and unit price",
            "HS codes, as a starting point for the Nepal classification",
            "A packing list that matches the invoice and gives weights",
            "Any licence, permit or exemption letter the goods need in Nepal",
            "Your payment documents, as your bank requires for imports from India",
          ] },
        ],
      },
      {
        title: "Common stoppers",
        blocks: [
          { type: "list", items: [
            "A pro forma invoice sent with the truck instead of the final one",
            "A different value or quantity on the invoice and the packing list",
            "A description that customs cannot classify, such as spare parts",
            "Weights that differ from the weighbridge by more than a small margin",
            "A truck number on the papers that does not match the truck",
          ] },
        ],
      },
      {
        title: "Check before loading",
        blocks: [
          { type: "p", text: "Ask the supplier to send the invoice and packing list before the truck is loaded, not as it leaves. Your Nepal agent can then check them against what Nepal customs will expect, and corrections are made while they are still cheap." },
        ],
      },
    ],
    questions: [
      { question: "Can I pay my Indian supplier in Indian rupees?", answer: "Trade with India is commonly paid in Indian rupees through banks, under Nepal's foreign exchange rules. Your bank will tell you which payment methods and documents apply to your import." },
      { question: "Who files the Indian export declaration?", answer: "The supplier, through its customs broker in India. Make sure the supplier has a broker at the border point you are using." },
      { question: "What if the truck is stopped inside India?", answer: "Usually it is a paperwork question about the goods' movement within India, and the supplier or its transporter must resolve it. Make sure the supplier's papers are complete before loading." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "part-loads-from-india",
    topic: "borders",
    title: "Part loads from India: sharing a truck to Nepal",
    description: "Not every order fills a truck. How part loads from India to Nepal work, what can go wrong when your cargo shares a truck, and how to protect it.",
    intro: "Many Nepal importers buy from India in quantities that do not fill a truck. Sharing one with other consignments is cheaper, and needs a little more care.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "Part loads are built up at a warehouse before the truck leaves for the border.",
    sections: [
      {
        title: "How part loads work",
        blocks: [
          { type: "p", text: "A transporter or forwarder collects consignments from several suppliers, often in one city or region, and loads them on one truck to the border. You pay for your share, by weight or by volume. At the border, each consignment is declared to Nepal customs separately, under its own importer." },
        ],
      },
      {
        title: "The risks",
        blocks: [
          { type: "list", items: [
            "A problem with one consignee's papers can hold the whole truck",
            "More loading and unloading means more chance of damage or loss",
            "The truck leaves when it is full, not when your goods are ready",
            "Cartons from different suppliers look alike and can be mixed up",
          ] },
        ],
      },
      {
        title: "Protecting your consignment",
        blocks: [
          { type: "list", items: [
            "Ask how a hold on someone else's goods is handled, and whether yours can be cleared and released separately",
            "Mark every package with your name, destination and its number of the total",
            "Ask for a loading count and photographs when the truck is loaded",
            "Have your own invoice, packing list and permits ready before the truck reaches the border",
            "Insure the cargo, with the cover written for road transit",
          ] },
        ],
      },
      {
        title: "When to take a full truck",
        blocks: [
          { type: "p", text: "Once your order is more than half a truck, the price gap narrows, and a full truck brings a fixed departure, one set of papers and no one else's problems. For valuable or fragile goods, or anything with a deadline, ask for both prices and weigh the risk as well as the cost." },
        ],
      },
    ],
    questions: [
      { question: "How is a part load priced?", answer: "Usually by weight or by volume, whichever is greater, with a minimum charge. Ask whether the price includes the border clearance and delivery in Nepal, or only transport to the border." },
      { question: "Can my part load travel with goods I do not know?", answer: "Yes, that is how part loads work. That is why marks, a clear packing list and insurance matter, and why you should ask how problems with other consignments are handled." },
      { question: "Is it faster to wait for a full truck?", answer: "A full truck leaves when you are ready. A part load leaves when the truck is full. If the date matters, ask your forwarder when the next part-load truck is expected to depart." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "customs-clearance-in-nepal"] },
  },
  {
    slug: "chinese-holidays-and-nepal-orders",
    topic: "borders",
    title: "Chinese New Year and Golden Week: planning orders",
    description: "Chinese factories and logistics slow down around Chinese New Year and Golden Week. How Nepal importers can plan orders, space and stock around them.",
    intro: "Twice a year, China's factories and much of its logistics slow down for national holidays. Nepal importers who buy from China feel it weeks before and after.",
    published,
    cover: "port-aerial",
    coverCaption: "The weeks before a Chinese holiday are among the busiest of the year at Chinese ports.",
    sections: [
      {
        title: "The two holidays",
        blocks: [
          { type: "steps", items: [
            { title: "Chinese New Year", copy: "Usually in late January or February. Factories often close for one to several weeks while workers travel home, and production takes time to recover afterwards." },
            { title: "Golden Week", copy: "The national holiday at the start of October. Shorter, but factories, trucking and some port operations slow down around it." },
          ] },
        ],
      },
      {
        title: "What happens around them",
        blocks: [
          { type: "p", text: "In the weeks before each holiday, exporters rush to ship before closing. Container space gets tight, rates can rise, and bookings get rolled to later sailings. After the holiday, factories reopen slowly, and orders placed before the break may ship weeks late." },
          { type: "p", text: "For Nepal, this lands on top of the usual transit times through India. Cargo that leaves China just before Chinese New Year may arrive close to Nepal's own spring season. Cargo shipped just before Golden Week often arrives at Birgunj around Dashain and Tihar, when Nepal's offices and transport slow down for their own festivals." },
        ],
      },
      {
        title: "How to plan",
        blocks: [
          { type: "list", items: [
            "Place orders for the holiday season early, and agree a ship-by date with the supplier",
            "Book container space early when shipping in the weeks before a holiday",
            "Hold extra stock of fast-moving goods to cover the gap",
            "Ask suppliers for their closing and reopening dates in writing",
            "Check how the arrival date falls against Dashain, Tihar and Indian festivals",
          ] },
        ],
      },
      {
        title: "Road cargo too",
        blocks: [
          { type: "p", text: "Consolidators running road services to the Tibetan border also pause around the holidays. If you use road LCL from China, ask for the last truck before each holiday and the first one after it." },
        ],
      },
    ],
    questions: [
      { question: "When should I place orders before Chinese New Year?", answer: "Early enough for production to finish and the cargo to ship before factories close. Ask your supplier for its last production and shipping dates, and work back from them." },
      { question: "Do freight rates rise before the holiday?", answer: "They often do, as exporters rush to ship before factories close. Booking early helps secure space and a known rate." },
      { question: "Will my cargo be delayed if it is already at sea?", answer: "Cargo at sea keeps moving. The delay usually hits orders not yet produced or shipped, and port and inland operations in China during the holiday." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
];
