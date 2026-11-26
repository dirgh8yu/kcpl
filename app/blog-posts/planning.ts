import type { BlogPost } from "../blog-data.ts";
import { published, service } from "./links.ts";

export const planningPosts: readonly BlogPost[] = [
  {
    slug: "freight-around-festivals",
    topic: "planning",
    title: "Freight around Dashain, Tihar and India's festivals",
    description: "Festivals on both sides of the border slow ports, customs and trucking. How to plan Nepal freight around Dashain, Tihar, Durga Puja, Diwali and Chhath.",
    intro: "Autumn is festival season in Nepal and in eastern India. Offices close, drivers go home and ports slow down, and cargo that arrives in the middle of it waits.",
    published,
    cover: "kathmandu",
    coverCaption: "Dashain and Tihar slow Nepal down for weeks each autumn.",
    sections: [
      {
        title: "The festivals that matter",
        blocks: [
          { type: "steps", items: [
            { title: "Durga Puja", copy: "The great festival of Kolkata and West Bengal. Port processing and trucking in Kolkata can slow or stop for several days." },
            { title: "Dashain", copy: "Nepal's biggest festival, usually in September or October. Offices close, many workers travel home, and transport is scarce." },
            { title: "Diwali and Tihar", copy: "The festival of lights on both sides of the border, a few weeks after Dashain." },
            { title: "Chhath", copy: "Soon after Diwali, widely observed in Bihar and Nepal's Terai, including around Raxaul and Birgunj. Drivers and labour are hard to find." },
          ] },
          { type: "p", text: "Dates follow the lunar calendar and move every year. Check the year's dates when you plan the autumn's shipments." },
        ],
      },
      {
        title: "What happens to freight",
        blocks: [
          { type: "list", items: [
            "Before the festivals, a rush to clear and move cargo, with queues at the border",
            "During them, closed offices, fewer trucks and slower ports",
            "After them, a backlog that takes days to clear",
            "Free days keep running through holidays, unless agreed otherwise",
          ] },
        ],
      },
      {
        title: "How to plan",
        blocks: [
          { type: "list", items: [
            "Ask suppliers to ship early enough for cargo to clear before the holidays start",
            "Avoid arrivals at the Indian port during Durga Puja and at Birgunj during Dashain and Chhath",
            "Ask for extra free days on bookings that will arrive in festival weeks",
            "Have customs papers and payments ready before offices close",
            "Plan stock to cover the weeks when nothing moves",
          ] },
        ],
      },
      {
        title: "Exporters too",
        blocks: [
          { type: "p", text: "Exports from Nepal pass through the same borders and the same Indian ports. A shipment for a buyer's Christmas season that leaves Nepal during Dashain may miss its vessel. Plan export production to finish before the festivals, not during them." },
        ],
      },
    ],
    questions: [
      { question: "When do the festivals fall each year?", answer: "They follow the lunar calendar and move from year to year, usually between September and November. Check the official holiday lists for the year." },
      { question: "Do customs offices close during Dashain?", answer: "Government offices observe public holidays. Some services may continue in a limited way, but expect slower clearance around the main holidays." },
      { question: "Can I get extra free days for festival weeks?", answer: "Ask the line at booking. Some will agree, especially for cargo arriving during known closures." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "exporting-from-nepal"] },
  },
  {
    slug: "monsoon-freight-in-nepal",
    topic: "planning",
    title: "Monsoon freight in Nepal: landslides and closures",
    description: "From June to September, rain closes Nepal's roads and border routes without warning. How to plan monsoon freight with buffers and safe places to wait.",
    intro: "Every monsoon, roads in Nepal close for hours or days as landslides fall and rivers rise. Freight still moves, but only plans with room in them keep it moving.",
    published,
    cover: "ghat-road",
    coverCaption: "Wet hill roads set the pace of freight from June to September.",
    sections: [
      {
        title: "What the monsoon does",
        blocks: [
          { type: "p", text: "The monsoon usually runs from about June to September. Landslides block highways, especially in the hills between the Terai and the Kathmandu valley, and on the roads to the Chinese border. Floods cut roads and bridges in the plains. Closures can last hours or days, and trucks queue on both sides." },
          { type: "p", text: "In September 2026, floods and landslides left import and export trucks and containers stuck at border points and on highways beyond their free time, and charges built up while nobody could move them." },
        ],
      },
      {
        title: "Planning with buffers",
        blocks: [
          { type: "list", items: [
            "Add days to every road leg planned for the monsoon months",
            "Ask for extra free days on containers that will be inland during the monsoon",
            "Keep more stock of critical items before the rains start",
            "Avoid heavy and over-dimensional moves on hill roads in the wettest weeks",
            "Have a safe, dry place for cargo to wait if a road ahead closes",
          ] },
        ],
      },
      {
        title: "Protecting the cargo",
        blocks: [
          { type: "p", text: "Cargo waiting in the rain gets wet. Make sure trucks are covered and tarpaulins are sound, and that packing can stand moisture. For cargo waiting at a border or a yard, ask where it will be kept and whether it is under cover. Moisture damage found weeks later is hard to claim." },
        ],
      },
      {
        title: "Staying informed",
        blocks: [
          { type: "p", text: "Road conditions change by the hour in the monsoon. A forwarder with people at the border and along the route hears about closures early and can hold cargo somewhere safe rather than sending it into a queue. Ask your forwarder to tell you when a shipment is held, where and why." },
        ],
      },
    ],
    questions: [
      { question: "Which roads close most often?", answer: "Hill highways and roads to the northern border close most often. Plains roads can flood. Conditions vary every year." },
      { question: "Can a forwarder guarantee monsoon delivery dates?", answer: "No. A forwarder can plan buffers and alternatives, but closures are outside anyone's control." },
      { question: "Who pays detention when roads are closed?", answer: "Lines usually still charge. That is why extra free days and early clearance matter in the monsoon." },
    ],
    related: { service: service.road, guides: ["importing-to-nepal", "free-time-and-demurrage"], tool: "storage-charges" },
  },
  {
    slug: "nepali-calendar-on-freight-paperwork",
    topic: "planning",
    title: "The Nepali calendar on freight paperwork",
    description: "Nepal's official calendar, Bikram Sambat, runs about 56 years and 8 months ahead. Why it matters on freight papers, and how to avoid date mix-ups.",
    intro: "Nepal's official calendar is Bikram Sambat, not the Gregorian calendar used by the rest of a shipment's documents. Dates in both can sit on the same file.",
    published,
    cover: "tariff-ledger",
    coverCaption: "A shipment file in Nepal often carries dates in two calendars.",
    sections: [
      {
        title: "Two calendars",
        blocks: [
          { type: "p", text: "Bikram Sambat, or BS, is about 56 years and 8 months ahead of the Gregorian calendar. Its year begins in mid-April, and its months, Baisakh to Chaitra, do not line up with Gregorian months. Nepal's fiscal year runs from mid-July, so fiscal year 2083/84 runs from mid-July 2026 to mid-July 2027." },
        ],
      },
      {
        title: "Where BS dates appear",
        blocks: [
          { type: "list", items: [
            "Government documents, permits and many official letters",
            "Tax and VAT records, and some local invoices",
            "Notices of holidays and office closures",
            "Budget and tariff changes, announced for the Nepali fiscal year",
          ] },
          { type: "p", text: "International documents such as bills of lading, air waybills and foreign invoices use Gregorian dates. A file can easily hold both." },
        ],
      },
      {
        title: "Avoiding mix-ups",
        blocks: [
          { type: "list", items: [
            "Write both dates on internal records when a deadline matters",
            "Check the validity of permits and letters in the calendar they were issued in",
            "Convert holiday dates to Gregorian when telling overseas partners about closures",
            "Remember that the fiscal year end in mid-July is a busy time for offices and payments",
          ] },
        ],
      },
      {
        title: "The budget date",
        blocks: [
          { type: "p", text: "Nepal's federal budget is presented in late May each year, and new customs rates can take effect quickly. Importers with large orders arriving around that time should ask their customs agent how a change in rates would apply to goods already on the water." },
        ],
      },
    ],
    questions: [
      { question: "How do I convert a BS date?", answer: "Use a reliable converter. The difference is not a fixed number of days, because the months have different lengths." },
      { question: "Do customs documents use BS dates?", answer: "Many Nepal government documents use BS dates. International documents use Gregorian dates." },
      { question: "Why does the fiscal year matter for freight?", answer: "Budgets, tariffs and many administrative deadlines follow it. Expect busy offices around the year end in mid-July." },
    ],
    related: { service: service.customs, guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"] },
  },
  {
    slug: "storing-cargo-before-delivery",
    topic: "planning",
    title: "Storing cargo before delivery: when it pays",
    description: "Sometimes cargo should wait before final delivery: for a site, a duty letter or a sale. When storage between legs pays, and what to ask the warehouse.",
    intro: "Not every shipment should go straight to the consignee. Sometimes holding it in the right place for a while is cheaper and safer than rushing it to the wrong one.",
    published,
    cover: "warehouse-racks",
    coverCaption: "Storage on the way can be cheaper than waiting at a port or a site.",
    sections: [
      {
        title: "When storage pays",
        blocks: [
          { type: "list", items: [
            "The site is not ready, and cargo would otherwise sit at a port on demurrage",
            "Papers such as a duty concession are late, and the cargo needs somewhere to wait",
            "Several suppliers' goods need consolidating into one delivery",
            "Exports need packing, labelling or consolidation before dispatch",
            "Stock is released in parts against sales or call-offs",
          ] },
        ],
      },
      {
        title: "What to ask the warehouse",
        blocks: [
          { type: "list", items: [
            "Is it covered, secure and dry, and suited to the cargo's weight and size?",
            "How is cargo received and recorded: count, photographs, condition notes?",
            "How is it released: against whose instruction, and with what record?",
            "What are the charges for handling in, storage and handling out?",
            "Is storage in the warehouse covered by your insurance?",
          ] },
        ],
      },
      {
        title: "KCPL's storage",
        blocks: [
          { type: "p", text: "KCPL has more than 1,000 square metres of storage for air cargo and more than 6,000 square metres for road cargo. Storage is offered as part of a movement, not on its own: consolidation, export packing, holding cargo until a site is ready, and release against instruction." },
        ],
      },
      {
        title: "Plan it, do not drift into it",
        blocks: [
          { type: "p", text: "The expensive storage is the kind nobody planned: a container on detention at a dry port because the receiver was not ready. Decide before the cargo moves where it will wait if it has to, and what that costs, so a delay becomes a choice rather than a bill." },
        ],
      },
    ],
    questions: [
      { question: "Does KCPL offer storage only, without transport?", answer: "No. Storage is part of a movement KCPL handles." },
      { question: "Is bonded storage available?", answer: "Ask about your case. Storage options depend on whether the goods have cleared customs and on the location." },
      { question: "How is cargo in storage recorded?", answer: "With a count and condition record on receipt, and release against written instruction." },
    ],
    related: { service: service.warehouse, guides: ["importing-to-nepal", "free-time-and-demurrage"], tool: "storage-charges" },
  },
  {
    slug: "proof-of-delivery-checklist",
    topic: "planning",
    title: "A proof-of-delivery checklist for importers",
    description: "A shipment is finished when the consignee has the cargo and the record says so. What a useful proof of delivery contains, with a receiver's checklist.",
    intro: "A movement is not finished when the cargo reaches Nepal. It is finished when the consignee has it and the record says so. That record is the proof of delivery.",
    published,
    cover: "clipboard-sign",
    coverCaption: "A signature on the right paper closes the shipment.",
    sections: [
      {
        title: "What a proof of delivery is for",
        blocks: [
          { type: "list", items: [
            "Showing the buyer, the seller and any bank that the goods arrived",
            "Recording the condition and count at the moment of delivery",
            "Supporting claims for damage or shortage",
            "Closing the shipment for invoicing and payment",
            "Giving project managers a record they can match to the package list",
          ] },
        ],
      },
      {
        title: "What it should contain",
        blocks: [
          { type: "list", items: [
            "The consignee's name and the delivery address",
            "The shipment reference, and the bill of lading or air waybill number",
            "The number of packages delivered, by package number where possible",
            "The date and time of delivery",
            "The receiver's name and signature, and a company stamp where used",
            "Remarks on any damage, shortage or wet packing",
            "Photographs of the cargo at unloading",
          ] },
        ],
      },
      {
        title: "For receivers",
        blocks: [
          { type: "p", text: "Count before you sign. Look at the packing for damage, tears and water marks. If something is wrong, write it on the delivery receipt in plain words before signing, and photograph it. A clean signature on a damaged delivery makes a claim much harder." },
        ],
      },
      {
        title: "Circulating it",
        blocks: [
          { type: "p", text: "Send the signed proof of delivery to the buyer, the seller or their agent, and anyone else who needs it, the same day. KCPL circulates unloading photographs and signed receipts as each delivery is completed, so the record reaches everyone while the details are fresh." },
        ],
      },
    ],
    questions: [
      { question: "Is a photograph enough as proof of delivery?", answer: "Photographs support it, but a signed receipt with the package count and date is the core record." },
      { question: "Who should sign the delivery receipt?", answer: "A person authorised by the consignee, named in advance." },
      { question: "How quickly should the proof be shared?", answer: "The same day, while the details are fresh." },
      { question: "What if the receiver is not there when the cargo arrives?", answer: "The delivery may have to wait, be left with someone not authorised to sign, or go back to the warehouse, and each has a cost and a risk. Name a receiver and a backup before dispatch, give the driver both phone numbers, and agree what happens if neither can be reached. A delivery signed by the wrong person is a weak proof of delivery." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
  {
    slug: "receiving-a-delivery",
    topic: "planning",
    title: "Receiving a delivery: what to check before you sign",
    description: "The minutes between a truck arriving and the receiver signing decide whether damage can be claimed. What to prepare and check when cargo reaches you.",
    intro: "The receiver who signs for a delivery has more power over a later claim than anyone else in the chain. A few minutes of checking at the gate decide it.",
    published,
    cover: "warehouse-forklift",
    coverCaption: "Count, look and record before the receipt is signed.",
    sections: [
      {
        title: "Before the truck arrives",
        blocks: [
          { type: "list", items: [
            "Know what is coming: the packing list, the number of packages, the weights",
            "Have unloading equipment and people ready",
            "Clear space to unload and to inspect",
            "Name one person to receive and sign",
          ] },
        ],
      },
      {
        title: "At the gate",
        blocks: [
          { type: "steps", items: [
            { title: "Check the seal", copy: "For a container, check the seal number against the papers before it is cut. A different or broken seal is recorded before opening." },
            { title: "Count", copy: "Count packages as they come off, against the packing list." },
            { title: "Look", copy: "Check every package for damage, tears, crushing, water marks or tampering." },
            { title: "Record", copy: "Photograph the cargo, especially anything wrong, with the package number visible." },
            { title: "Remark and sign", copy: "Write any problem on the receipt in plain words, then sign. Keep a copy." },
          ] },
        ],
      },
      {
        title: "Words that help",
        blocks: [
          { type: "p", text: "Remarks such as received in good order are only true if they are. Write what you see instead: two cartons crushed on one corner, one crate wet, package 14 missing. Vague remarks such as subject to inspection carry little weight in a claim." },
        ],
      },
      {
        title: "After signing",
        blocks: [
          { type: "p", text: "Open damaged packages carefully and photograph the contents before moving anything. Report hidden damage in writing as soon as it is found, because time limits for claims can be short. Tell your forwarder the same day, so the right parties are notified." },
        ],
      },
    ],
    questions: [
      { question: "Can I sign received in good order and claim later?", answer: "It makes a claim much harder. Write what you see instead." },
      { question: "What if the driver refuses to wait while I check?", answer: "Note it on the receipt and report it. A reasonable check is part of delivery." },
      { question: "Should I open cartons in front of the driver?", answer: "For visibly damaged cartons, yes, if possible, with photographs." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
  {
    slug: "cargo-insurance-for-nepal-imports",
    topic: "planning",
    title: "Cargo insurance for Nepal imports: what to ask for",
    description: "Carrier liability rarely covers the full value of lost or damaged goods. What cargo insurance a Nepal importer needs, and how to fit it to the route.",
    intro: "Carriers are liable for cargo only to limited amounts, and often not at all. Cargo insurance is how an importer protects the value of the goods on a long route.",
    published,
    cover: "ship-aerial",
    coverCaption: "A Nepal import crosses sea, port, rail and road. The cover should too.",
    sections: [
      {
        title: "Why carrier liability is not enough",
        blocks: [
          { type: "p", text: "International conventions and carriers' terms limit what a shipping line, an airline or a trucker pays for lost or damaged cargo, usually to an amount per kilo or per package that is far below the goods' value. Some losses, such as those from bad weather or general average at sea, may not be the carrier's liability at all." },
        ],
      },
      {
        title: "Kinds of cover",
        blocks: [
          { type: "p", text: "Marine cargo insurance is usually written on standard clauses, from the broadest all-risks cover to narrower named-perils cover. All-risks cover suits most manufactured goods. Narrower cover may be cheaper but leaves gaps. Regular importers often take an open policy that covers every shipment automatically, declared as it moves." },
        ],
      },
      {
        title: "Fit the cover to the route",
        blocks: [
          { type: "list", items: [
            "Cover from the supplier's warehouse to yours, not just port to port",
            "Include the transit across India and the road in Nepal",
            "Include storage in transit, such as waiting at a border or dry port",
            "Insure for the full value, commonly the CIF value plus a margin",
            "Check exclusions for packing, delay and specific goods",
          ] },
          { type: "p", text: "If you buy CIF, the seller buys the insurance, often at the minimum level required, and possibly only to the Indian port. Check the certificate, and top up the cover for the rest of the journey if needed." },
        ],
      },
      {
        title: "Before a loss happens",
        blocks: [
          { type: "p", text: "Know the policy's notice requirements and keep the insurer's contact with the shipment file. When a loss happens, the steps in the first days decide the claim. Our note on making a cargo claim goes through them." },
        ],
      },
    ],
    questions: [
      { question: "Who arranges the insurance?", answer: "The importer or the seller, depending on the Incoterm, usually through an insurer or broker. Tell your forwarder who holds the cover and what its notice rules are, so the shipment records support a claim if one is needed." },
      { question: "How much does cargo insurance cost?", answer: "It depends on the goods, the route, the value and the cover. It is usually a small percentage of the value." },
      { question: "Does insurance cover delay?", answer: "Usually not. Delay is commonly excluded from cargo policies." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
  {
    slug: "making-a-cargo-claim",
    topic: "planning",
    title: "Making a cargo claim: notice, survey and documents",
    description: "When cargo arrives damaged or short, the first days decide the claim. The notices, survey and documents a Nepal importer needs, and the time limits.",
    intro: "Damaged or missing cargo can usually be claimed. Whether the claim is paid depends on what was done in the first days after the loss was found.",
    published,
    cover: "cribbing",
    coverCaption: "The evidence for a claim is gathered on the day, not reconstructed later.",
    sections: [
      {
        title: "On the day",
        blocks: [
          { type: "steps", items: [
            { title: "Record it", copy: "Note the damage or shortage on the delivery receipt, and photograph the cargo, the packing and the package numbers." },
            { title: "Keep it", copy: "Keep the damaged goods and packing as they are. Do not repair or discard anything until the insurer or surveyor agrees." },
            { title: "Notify", copy: "Tell your insurer and your forwarder in writing at once. Ask for a survey if the loss is significant." },
            { title: "Hold the carrier", copy: "Send the carrier a written notice of loss, holding it responsible." },
          ] },
        ],
      },
      {
        title: "Time limits",
        blocks: [
          { type: "p", text: "Carriers' conventions and contracts set short deadlines for written notice, often counted in days from delivery, and longer ones for starting a formal claim. For international air cargo, written complaints about damage are generally due within 14 days of receipt. Sea, rail and road have their own limits. Missing them can end a claim before it starts, so give notice first and gather documents after." },
        ],
      },
      {
        title: "Documents a claim needs",
        blocks: [
          { type: "list", items: [
            "The insurance policy or certificate",
            "The commercial invoice and packing list",
            "The bill of lading or air waybill",
            "The delivery receipt with remarks, and photographs",
            "The survey report, if a surveyor attended",
            "Repair estimates or proof of the loss amount",
            "Copies of notices sent to carriers, and their replies",
          ] },
        ],
      },
      {
        title: "Why the hand-over records matter",
        blocks: [
          { type: "p", text: "A carrier pays only for losses that happened in its care. A Nepal import passes through several carriers, so a claim is strongest when the record shows where the damage happened. Counts and photographs at each hand-over are what make that possible." },
        ],
      },
    ],
    questions: [
      { question: "Can I claim from the forwarder?", answer: "Claims against carriers and forwarders depend on their terms and the law that applies, and liability is usually limited. Insurance is the main route for recovery." },
      { question: "What if the damage is found weeks later?", answer: "Report it at once, but expect questions about where it happened. Hand-over records are your best evidence." },
      { question: "Should I repair goods before the survey?", answer: "No, unless the insurer agrees. Keep the goods and packing as found." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
  {
    slug: "your-first-import-into-nepal",
    topic: "planning",
    title: "Your first import into Nepal: a planning checklist",
    description: "A first import into Nepal has more steps than later ones. A checklist from registration and supplier terms to customs, payment and delivery.",
    intro: "The first import is the one that teaches you the route. Most of the delay on a first shipment comes from steps that could have been done before the order was placed.",
    published,
    cover: "kathmandu",
    coverCaption: "Most first-shipment problems are solved before the order is placed.",
    sections: [
      {
        title: "Before you order",
        blocks: [
          { type: "list", items: [
            "Register the business for trade: company, tax and EXIM details in one matching name",
            "Agree the HS code with a customs agent, and check for permits",
            "Estimate duty and VAT on the expected value",
            "Ask your bank how the payment will be made and what documents it needs",
            "Choose an Incoterm and a named place you understand",
          ] },
        ],
      },
      {
        title: "When you order",
        blocks: [
          { type: "list", items: [
            "Give the supplier your exact registered name and address for all documents",
            "Ask for draft invoice and packing list before shipment",
            "Agree marks and labels for the packages",
            "Confirm who books the freight, and to where",
            "Arrange insurance from the supplier's door to yours",
          ] },
        ],
      },
      {
        title: "While it travels",
        blocks: [
          { type: "list", items: [
            "Check the draft bill of lading or air waybill",
            "Confirm how and when the bill will be released",
            "Send the documents to your customs agent before arrival",
            "Have the duty, VAT and charges ready to pay",
            "Prepare your warehouse to receive",
          ] },
        ],
      },
      {
        title: "On arrival",
        blocks: [
          { type: "p", text: "Customs clearance, payment, release and delivery follow. Check the delivery before you sign, record anything wrong, and keep the whole file. Your second import will be faster because of it." },
        ],
      },
    ],
    questions: [
      { question: "How long does a first import take?", answer: "Longer than later ones, because registrations, permits and supplier documents are new. Allow time for the paperwork as well as the transport." },
      { question: "Do I need a customs agent?", answer: "Most imports are declared through a licensed customs agent. A forwarder such as KCPL coordinates the agent, the transport and the documents together, so they work to one plan." },
      { question: "What is the most common first-import mistake?", answer: "Documents in a name that does not match the importer's registration." },
      { question: "Should my first order be small?", answer: "A smaller first order lets you learn the route, the supplier's documents and the clearance with less money at risk. It costs more per unit in freight, but the lessons carry over to every order after it. Many importers start with a trial shipment, fix what went wrong, and then scale up with the same supplier and forwarder." },
    ],
    related: { service: service.customs, guides: ["importing-to-nepal", "customs-clearance-in-nepal"], tool: "duty-estimate" },
  },
  {
    slug: "briefing-a-freight-forwarder",
    topic: "planning",
    title: "How to brief a freight forwarder in five lines",
    description: "A complete freight enquiry gets a reliable quote the first time. The details a forwarder needs for air, sea, road and project cargo, in five lines.",
    intro: "Most freight quotes take longer than they should because the first email leaves out something the forwarder needs. Five lines are usually enough to get it right first time.",
    published,
    cover: "clipboard-sign",
    coverCaption: "A complete enquiry saves a round of questions.",
    sections: [
      {
        title: "The five lines",
        blocks: [
          { type: "steps", items: [
            { title: "What", copy: "The commodity, in plain words, with the HS code if you know it. Say if anything is dangerous, perishable or regulated." },
            { title: "How much", copy: "Number of packages, gross weight, and dimensions of each package or the total volume. For containers, the type and number." },
            { title: "From where", copy: "The supplier's address or the port or airport of loading, and the Incoterm you are buying or selling on." },
            { title: "To where", copy: "The delivery address in Nepal or abroad, and what access it has for trucks and unloading." },
            { title: "When", copy: "The date the cargo is ready, and the date it is needed." },
          ] },
        ],
      },
      {
        title: "Extra lines by mode",
        blocks: [
          { type: "list", items: [
            "Air: whether to the airport or the door",
            "Sea: whether full container or shared, and the origin port",
            "Road: collection and delivery points, and access at both ends",
            "Customs: the value, and any licence or exemption held",
            "Project: piece-by-piece dimensions and weights, total packages, site access and completion date",
            "Storage: the volume, how long, and whether handling is needed",
          ] },
        ],
      },
      {
        title: "Why it matters",
        blocks: [
          { type: "p", text: "A quote is only as good as the information behind it. A forwarder who has to guess the weight or the delivery point will either ask, which takes a day, or assume, which changes the price later. Send what you know, and say what you do not." },
          { type: "p", text: "KCPL replies to quote requests within one working day. The quote form on this site asks for these details in order." },
        ],
      },
    ],
    questions: [
      { question: "What if I do not know the weight yet?", answer: "Give your best estimate and say it is an estimate. The quote will be adjusted when actual figures are known." },
      { question: "Do I need the HS code for a quote?", answer: "Not for freight, but it helps for duty estimates and checking permits." },
      { question: "Can I send an enquiry in Nepali?", answer: "Yes. KCPL works in English and Nepali, so write in whichever is easier." },
    ],
    related: { service: service.ocean, guides: ["importing-to-nepal", "exporting-from-nepal"] },
  },
  {
    slug: "tracking-a-nepal-shipment",
    topic: "planning",
    title: "Tracking a Nepal shipment: which number to watch",
    description: "A Nepal shipment carries several reference numbers, each tracked in a different place. Which number to watch at each stage, from origin to door.",
    intro: "A shipment into Nepal is tracked by different numbers at different stages. Knowing which one to use, and where, saves a lot of asking.",
    published,
    cover: "container-plate",
    coverCaption: "The container number follows the box. The bill of lading follows the cargo.",
    sections: [
      {
        title: "The numbers",
        blocks: [
          { type: "steps", items: [
            { title: "Booking number", copy: "The line's or airline's reference for the space, used before the bill or waybill is issued." },
            { title: "Bill of lading or air waybill", copy: "The main reference for the cargo, used for release and customs. Lines track by bill of lading; airlines by the eleven-digit waybill." },
            { title: "House bill or house waybill", copy: "Your forwarder's reference when cargo is consolidated. The carrier tracks the master; your forwarder tracks the house." },
            { title: "Container number", copy: "Four letters and seven digits, painted on the box. Lines and terminals track containers by it." },
            { title: "Your own references", copy: "Purchase order and invoice numbers, which tie everything together in your records." },
          ] },
        ],
      },
      {
        title: "Where to look at each stage",
        blocks: [
          { type: "list", items: [
            "At sea: the line's tracking, by container or bill of lading number",
            "At the Indian port and on transit: your forwarder's updates, such as rail-out notices",
            "At Birgunj: arrival at the dry port and customs progress, from your forwarder and customs agent",
            "In the air: the airline's tracking, by air waybill",
            "On delivery: the delivery receipt and photographs",
          ] },
        ],
      },
      {
        title: "Ask for milestones",
        blocks: [
          { type: "p", text: "Carrier tracking stops at the edge of the carrier's own work. For the Indian transit and the Nepal side, updates come from people. Ask your forwarder for a message at each milestone: sailed, arrived at the Indian port, released, left for Nepal, arrived at the border, cleared, delivered. KCPL shares shipment updates by email, with a tracking link or code where one is available." },
        ],
      },
    ],
    questions: [
      { question: "Why does carrier tracking stop at the Indian port?", answer: "The carrier's service ends there for many Nepal imports, and the transit is handled by others. Your forwarder's updates fill the gap." },
      { question: "What is a rail-out notice?", answer: "A message that a container has left the port by train, with the train number and date." },
      { question: "Does KCPL offer a tracking page?", answer: "KCPL shares updates by email, with a tracking link or code where one is available. The Track a shipment page explains how to use it." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal", "sea-freight-through-india"] },
  },
  {
    slug: "a-nepal-partner-for-overseas-forwarders",
    topic: "planning",
    title: "For overseas forwarders: what a Nepal partner handles",
    description: "Overseas forwarders shipping to or from Nepal need a partner for the India transit and the Nepal side. What that partner handles, and what to agree.",
    intro: "A forwarder abroad with cargo for Nepal can book the ocean or air leg. Everything after the Indian port or Kathmandu airport needs a partner on the ground.",
    published,
    cover: "ship-terminal",
    coverCaption: "The overseas forwarder runs the main leg. The Nepal partner runs the rest.",
    sections: [
      {
        title: "On imports into Nepal",
        blocks: [
          { type: "list", items: [
            "Checking the draft bill of lading for the transit wording Nepal cargo needs",
            "Following up the release, and the delivery order at the Indian port",
            "Filing the transit papers and arranging rail or road to Nepal",
            "Customs clearance at Birgunj or another Nepal customs point",
            "Delivery to the consignee, unloading records and proof of delivery",
            "Empty container return, and detention tracking",
          ] },
        ],
      },
      {
        title: "On exports from Nepal",
        blocks: [
          { type: "list", items: [
            "Collection from the shipper and export customs clearance in Nepal",
            "Transit through India to the port, and carting before the cut-off",
            "Air export bookings, carting and screening at Kathmandu",
            "Supplying shipper data for advance filings at the destination",
            "Dispatch details and documents to the overseas agent",
          ] },
        ],
      },
      {
        title: "What to agree at the start",
        blocks: [
          { type: "list", items: [
            "How the consignee and notify party appear on the bills",
            "Who invoices whom, in which currency, and when",
            "Free days and who pays detention",
            "How pre-alerts, updates and proof of delivery are shared",
          ] },
          { type: "p", text: "KCPL works with overseas agents on both imports and exports, with staff in Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata. Our page for agents and partners has more on how we work together." },
        ],
      },
    ],
    questions: [
      { question: "Does KCPL handle exports as well as imports?", answer: "Yes, by air from Kathmandu and by sea through Indian ports." },
      { question: "In which currency does KCPL invoice agents?", answer: "International charges are commonly settled in dollars. Agree the arrangement at the start." },
      { question: "Is KCPL part of a forwarder network?", answer: "KCPL is a founding member of the Cargo Plus Logistics (CPL) network and a member of the Nepal Freight Forwarders Association." },
      { question: "What should a pre-alert to KCPL include?", answer: "Copies of the house and master bills of lading or air waybills, the invoice and packing list, the vessel or flight with dates, container and seal numbers, the release method, and any special handling such as dangerous goods or over-dimensional pieces. Send it within two working days of departure, so the Indian transit and the Nepal clearance can be prepared before arrival." },
    ],
    related: { service: { href: "/agents", label: "For overseas agents and partners" }, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "one-team-gateway-to-door",
    topic: "planning",
    title: "Why one team from gateway to door saves days",
    description: "A Nepal shipment passes a port, a transit, a border and a delivery, often with different firms. Why one team across them all cuts delay and cost.",
    intro: "A container for Nepal is handled at the Indian port, on the transit, at the border, through customs and on delivery. Each hand-over is a place where a shipment can stop.",
    published,
    cover: "howrah-bridge",
    coverCaption: "From Kolkata to the Nepal border is one journey with many hand-overs.",
    sections: [
      {
        title: "Where the gaps are",
        blocks: [
          { type: "p", text: "When different firms handle each stage, each one does its part and waits to be told the next part is ready. A container cleared for transit at the port waits for a truck that was booked after it was cleared. A truck at the border waits for a customs agent who was told it had arrived. Each wait is short. Together they are days, and the storage and detention run through all of them." },
        ],
      },
      {
        title: "What one team changes",
        blocks: [
          { type: "list", items: [
            "Each step is booked before the last one finishes",
            "Documents are checked once, against every stage's needs",
            "Problems are seen early by someone who can act on them",
            "One party is answerable to the importer for the whole route",
            "Records from each hand-over end up in one file",
          ] },
        ],
      },
      {
        title: "How KCPL is set up",
        blocks: [
          { type: "p", text: "KCPL has staff in Kolkata, at the gateway, in Raxaul and Birgunj on both sides of the main border, in Kathmandu, and in Nepalgunj and Surkhet in the west. The Indian and Nepal legs are booked against one schedule, so a container is not standing at Raxaul waiting for a truck that was arranged after it arrived." },
        ],
      },
      {
        title: "When it matters most",
        blocks: [
          { type: "p", text: "One team matters most when something goes wrong: a release is late, a road closes, a document needs correcting. Then the question is not who is responsible, but who is already working on it." },
        ],
      },
    ],
    questions: [
      { question: "Does one team mean one company does everything?", answer: "Not necessarily. It means one party coordinates every step and is answerable for the whole route." },
      { question: "Where are KCPL's staff based?", answer: "In Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata." },
      { question: "Can one team still face delays?", answer: "Yes. Weather, closures and authorities' decisions are outside anyone's control. One team sees them sooner and responds faster." },
    ],
    related: { service: service.road, guides: ["sea-freight-through-india", "importing-to-nepal"] },
  },
  {
    slug: "deliveries-inside-kathmandu-valley",
    topic: "planning",
    title: "Deliveries inside the Kathmandu valley",
    description: "Delivering in the Kathmandu valley means narrow lanes, traffic and tight unloading space. How to plan the truck size, timing, access and receiving.",
    intro: "The last few kilometres of a Nepal import are often inside the Kathmandu valley. Narrow lanes, busy roads and tight loading areas make them slower than the map suggests.",
    published,
    cover: "kathmandu",
    coverCaption: "The valley's lanes decide the size of truck that can reach a door.",
    sections: [
      {
        title: "Size the truck to the street",
        blocks: [
          { type: "p", text: "Many warehouses, shops and offices in the valley sit on lanes too narrow for a container trailer or a large truck. Cargo for these addresses is often moved into smaller vehicles before the last leg, at a dry port, a warehouse or a transfer point. Knowing the access in advance avoids a truck that cannot turn into the street." },
        ],
      },
      {
        title: "Timing",
        blocks: [
          { type: "list", items: [
            "Local rules can restrict when heavy vehicles may enter or unload in parts of the valley",
            "Traffic at peak hours can turn a short drive into a long one",
            "Receivers need to be open, staffed and ready when the truck arrives",
            "Festivals and public holidays close many businesses",
          ] },
          { type: "p", text: "Agree a delivery window with the receiver, and check it against local traffic rules for the vehicle being used." },
        ],
      },
      {
        title: "Unloading",
        blocks: [
          { type: "p", text: "Many valley addresses have no forklift or loading dock, so cargo is unloaded by hand. Heavy pieces need equipment brought with the delivery, or a plan to unload elsewhere. Tell your forwarder what the address has: a dock, a forklift, a crane, or only people." },
        ],
      },
      {
        title: "What to send",
        blocks: [
          { type: "list", items: [
            "The full address, with a map pin or directions",
            "A contact who will be there, with a phone number",
            "The receiving hours",
            "A photograph of the street and the entrance",
            "Unloading equipment available at the address",
          ] },
        ],
      },
    ],
    questions: [
      { question: "Can a container trailer reach my shop?", answer: "Many valley streets cannot take one. Smaller trucks are usually used for the last leg." },
      { question: "Are there delivery time restrictions in the valley?", answer: "Local rules can limit heavy vehicles at certain times or in certain areas. Check for your address." },
      { question: "Who unloads the goods?", answer: "Agree it in advance. Many deliveries rely on the receiver's staff or hired labour." },
    ],
    related: { service: service.delivery, guides: ["importing-to-nepal"] },
  },
];
