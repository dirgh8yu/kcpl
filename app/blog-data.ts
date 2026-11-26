import type { GuideSlug } from "./guide-data.ts";
import type { ToolSlug } from "./tool-data.ts";

/*
 * The blog. English only until someone at KCPL checks a translation, so these
 * pages have no /ne, /hi or /zh twin (see englishOnlyPath in site-i18n.ts).
 *
 * Facts-only rule: every claim here is in KCPL's own record or is general freight
 * practice. No volumes, prices, transit promises or client names beyond the
 * approved list. KCPL photographs are captioned as KCPL's; the rest are
 * illustrative Unsplash photographs listed in docs/public-photo-sources.md.
 */

export type BlogPhoto = { src: string; width: number; height: number; alt: string; kcpl: boolean; position?: string };

/* KCPL's own photographs carry information, so they get real alt text. Each was
 * cropped where needed so no face and no other company's branding shows. */
export const blogPhotos = {
  "mountain-approach": { src: "/images/blog/mountain-approach.jpg", width: 1280, height: 960, kcpl: true, position: "50% 60%", alt: "A narrow road cut into a steep, wooded hillside, seen from the cab of a heavy vehicle" },
  "port-lift": { src: "/images/blog/port-lift.jpg", width: 700, height: 960, kcpl: true, alt: "A power transformer on a hydraulic modular trailer in a wet port yard, with more transformers on trailers behind it" },
  cribbing: { src: "/images/blog/cribbing.jpg", width: 1280, height: 960, kcpl: true, alt: "Four workers packing timber blocks under a power transformer raised on cribbing" },
  sleepers: { src: "/images/blog/sleepers.jpg", width: 860, height: 960, kcpl: true, alt: "A power transformer resting on stacked timber sleepers on gravel, with covered equipment behind it" },
  "site-yard": { src: "/images/blog/site-yard.jpg", width: 1280, height: 960, kcpl: true, alt: "Three power transformers parked on levelled ground beside corrugated sheds" },
  "freight-train": { src: "/images/unsplash/freight-train.jpg", width: 2000, height: 1500, kcpl: false, alt: "" },
  "clipboard-sign": { src: "/images/unsplash/clipboard-sign.jpg", width: 2000, height: 1334, kcpl: false, alt: "" },
  "container-yard": { src: "/images/unsplash/container-yard.jpg", width: 2000, height: 1125, kcpl: false, alt: "" },
} satisfies Record<string, BlogPhoto>;

export type BlogPhotoKey = keyof typeof blogPhotos;

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "figure"; photo: BlogPhotoKey; caption: string }
  | { type: "pair"; photos: readonly [BlogPhotoKey, BlogPhotoKey]; caption: string }
  | { type: "list"; title?: string; items: readonly string[] }
  | { type: "steps"; items: readonly { title: string; copy: string }[] };

export type BlogPost = {
  slug: string;
  title: string;
  /** 140 to 155 characters, for search results. */
  description: string;
  intro: string;
  published: string;
  cover: BlogPhotoKey;
  coverCaption: string;
  sections: readonly { title: string; blocks: readonly BlogBlock[] }[];
  related: { service: { href: string; label: string }; guides: readonly GuideSlug[]; tool?: ToolSlug };
};

export const blogIndex = {
  title: "Notes from the route",
  metaTitle: "Blog",
  intro: "How freight really moves into and out of Nepal: the papers, the borders and the heavy lifts, written by the team that plans them.",
  description: "Notes from KCPL's freight desk on moving cargo into and out of Nepal: project cargo, Indian gateways, Birgunj clearance and the papers that release it.",
  more: "More notes",
  read: "Read the note",
  related: "Keep reading",
  author: "Kapileshwor Cargo",
  kcplCredit: "Photograph: KCPL",
  illustrative: "Illustrative photograph",
  minutes: "min read",
};

export const blogPosts: readonly BlogPost[] = [
  {
    slug: "moving-power-transformers-to-nepal",
    title: "How a power transformer reaches a Nepal substation",
    description: "How KCPL plans a power transformer move into Nepal: the route survey, the lift at the port, the papers, holding the unit and setting it down at site.",
    intro: "A transformer travels as one piece, so its heaviest and tallest moment decides the whole plan. The move is worked out backwards, from the plinth it will stand on to the port where it lands.",
    published: "2026-11-27",
    cover: "mountain-approach",
    coverCaption: "The way in to a hill site, seen from the cab. The bends, the edge and the overhead lines all go on the survey.",
    sections: [
      {
        title: "The road is surveyed before the rate is quoted",
        blocks: [
          { type: "p", text: "A large power transformer cannot be split into smaller loads. Its transport weight and height choose the trailer, and the trailer chooses the road. So the first piece of work is not a price. It is a trip along the route, from the gateway to the site, listing everything the load has to pass." },
          { type: "p", text: "On many Nepal projects the last stretch is the hardest. The way in to a hydropower plant or a hill substation is often a narrow road cut into the slope, with tight bends, steep climbs and bridges built for ordinary trucks." },
          { type: "list", title: "What the survey records", items: [
            "Bridges and culverts, against the loaded axle weights",
            "Overhead power and telephone lines lower than the loaded height",
            "Bends too tight for the trailer, and where it can swing wide",
            "Steep climbs where a second prime mover may be needed",
            "Places to stop, wait and let traffic pass",
            "Ground at the site that will hold the trailer and the jacks",
          ] },
        ],
      },
      {
        title: "At the port, one lift on to a modular trailer",
        blocks: [
          { type: "p", text: "Units built overseas usually come in by sea through Kolkata, KCPL's main gateway for project cargo. Units made in India come by road from the factory. At the port the transformer is lifted straight on to a hydraulic modular trailer, which spreads the weight across many axle lines and can raise or lower its deck under low structures and at the unloading point." },
          { type: "figure", photo: "port-lift", caption: "A transformer set on a hydraulic modular trailer in the port yard, with more units already loaded behind it." },
          { type: "p", text: "Before the lift, the packing list has to match the unit: the transport weight, the dimensions, and the lifting and lashing points on the drawing. A wrong figure means a wrong trailer, and that is an expensive thing to find out at the quay." },
        ],
      },
      {
        title: "The papers move ahead of the cargo",
        blocks: [
          { type: "p", text: "A transformer that reaches the border before its documents waits there, usually at a daily charge. The file for project cargo normally holds the commercial invoice, a packing list with every piece's weight and dimensions, the bill of lading, the insurance details and, on employer-run projects, the employer's dispatch authorisation." },
          { type: "p", text: "Goods for qualifying electricity projects may be cleared at a concessional rate of customs duty, on the right recommendation letter. Nepal's authorities decide who qualifies. What a forwarder controls is time: the application starts early, and the plan already says where the cargo waits, and at what cost, if the letter is late." },
        ],
      },
      {
        title: "Setting it down without a crane",
        blocks: [
          { type: "p", text: "Many sites have no crane big enough for the unit, so the transformer is set down instead. It is jacked up off the trailer a little at a time and packed underneath with timber sleepers. The trailer drives out, the unit is lowered on to the stack, and from there it is slid across to its plinth." },
          { type: "pair", photos: ["cribbing", "sleepers"], caption: "Left, packing timber under a raised transformer. Right, a unit resting on sleepers with its transport covers still on." },
          { type: "p", text: "It is slow work for a small crew with hydraulic jacks, and it is the part of the move where the survey of the ground pays for itself." },
        ],
      },
      {
        title: "Holding, then delivering in phases",
        blocks: [
          { type: "p", text: "A substation rarely takes every unit on the same day. Foundations, the employer's inspection and the erection crew decide when a transformer can go to its plinth. Until then it waits somewhere level and secure, covered, with its condition recorded." },
          { type: "figure", photo: "site-yard", caption: "Three transformers parked on levelled ground, waiting for their turn at site." },
          { type: "p", text: "Each delivery is recorded as it happens: photographs at unloading, a signed receipt, and any damage or shortfall reported in writing on the day. On one infrastructure movement through Kolkata and Birgunj, all 308 packages reached the project site by 31 August 2025, delivered in phases against site records." },
        ],
      },
      {
        title: "What to send for a project cargo quote",
        blocks: [
          { type: "list", items: [
            "Each piece's dimensions and weight, from the packing list or the drawing",
            "The number of packages, and which of them are over-dimensional",
            "Where the cargo starts: the factory address or the port of loading",
            "The site, its access road, and who receives at the gate",
            "When the site needs each unit, and when the project must finish",
            "Who arranges the insurance, and on what terms",
          ] },
        ],
      },
    ],
    related: { service: { href: "/services/project-cargo", label: "Project and specialist cargo" }, guides: ["sea-freight-through-india", "customs-clearance-in-nepal"] },
  },
  {
    slug: "container-at-birgunj-what-happens-next",
    title: "Your container has reached Birgunj. What happens next?",
    description: "What happens between a sea container reaching the Birgunj dry port and you collecting it: release, transit, rail, customs, duty and the empty return.",
    intro: "Rail to the Birgunj dry port is the usual way a sea container reaches Nepal. Arriving is not the end. A few steps decide whether you collect in days or pay for waiting.",
    published: "2026-11-27",
    cover: "freight-train",
    coverCaption: "Containers for Nepal usually make the inland leg by rail.",
    sections: [
      {
        title: "Before it leaves the Indian port",
        blocks: [
          { type: "p", text: "Most sea containers for Nepal land at Kolkata, Haldia or Visakhapatnam and travel on to the inland container depot at Birgunj. The container cannot start that journey until three things are in place." },
          { type: "steps", items: [
            { title: "The bill of lading is released", copy: "The shipping line hands over the container only against an original bill of lading or a telex release. A missing release is the most common reason a box sits at the port." },
            { title: "The transit papers are filed", copy: "Cargo crosses India to Nepal in transit, under customs control. The papers for each bill of lading are lodged at the port before the container moves." },
            { title: "The delivery order is issued", copy: "Once the line's charges are paid and the bill is surrendered, the line issues a delivery order. Arranged in advance, it lets the container leave as soon as it is cleared for transit." },
          ] },
        ],
      },
      {
        title: "On the train",
        blocks: [
          { type: "p", text: "From the port, containers usually go north by train to the Birgunj dry port. The rail operator sends a rail-out notice with the train number when the container leaves, and another when it arrives. Those two notices are the dates to watch: they tell you when your clearance papers and your payment need to be ready." },
        ],
      },
      {
        title: "Clearing customs at Birgunj",
        blocks: [
          { type: "p", text: "Import clearance happens at the dry port. The customs declaration goes in with the commercial invoice, the packing list, the bill of lading and any licence or permit the goods need. Customs assesses duty from the declared value and the HS code, adds VAT at 13%, and may pick the container for inspection." },
          { type: "p", text: "The fastest clearances are the ones where the papers already agree: the same consignee, the same description, the same package count and weights on the invoice, the packing list and the bill of lading. A mismatch is a query, and a query costs a day." },
        ],
      },
      {
        title: "Collecting it, and returning the empty",
        blocks: [
          { type: "p", text: "Once released, the container goes to your warehouse by truck, or the cargo is unloaded at the dry port and carried loose. Either way, the clock that matters is the shipping line's free time. Every day the empty is not back after free time ends is charged as detention, so find out whether it is counted from the day the container lands at the Indian port or from the day it reaches Birgunj. Lines differ, and the difference is paid as detention." },
          { type: "figure", photo: "container-yard", caption: "Ask where the free time starts: at the Indian port, or at Birgunj." },
          { type: "list", title: "Ask for these at the start", items: [
            "The free days at the port and at the dry port",
            "The free days on the container before detention starts",
            "Where the empty container has to be returned",
            "Whether your warehouse can take a full container, or the cargo must be unloaded at Birgunj",
          ] },
        ],
      },
    ],
    related: { service: { href: "/services/ocean-freight", label: "Ocean freight" }, guides: ["free-time-and-demurrage", "sea-freight-through-india", "importing-to-nepal"], tool: "storage-charges" },
  },
  {
    slug: "telex-release-or-original-bill-of-lading",
    title: "Telex release or original bill of lading: what to ask for",
    description: "How the bill of lading is released, on paper or by telex, often decides when a Nepal-bound container leaves the Indian port. What importers should ask for.",
    intro: "The bill of lading is the document that releases your cargo. Whether it is released on paper or by message often decides if a Nepal-bound container leaves the Indian port on time.",
    published: "2026-11-27",
    cover: "clipboard-sign",
    coverCaption: "Most release problems start on paper, long before the container moves.",
    sections: [
      {
        title: "Three ways a container is released",
        blocks: [
          { type: "steps", items: [
            { title: "Original bill of lading", copy: "The line issues a set of paper originals, usually three. One has to be surrendered at the destination port before the cargo is released. If the originals are still at a bank or in a courier bag, the container waits." },
            { title: "Telex release", copy: "The shipper surrenders the originals at origin, and the line tells its office at the destination port to release without paper. Nothing needs to travel, which is why it is the usual way to keep a Nepal import moving." },
            { title: "Sea waybill", copy: "A non-negotiable document. The named consignee takes delivery without surrendering anything. It suits a buyer and seller who trust each other and do not need the bill as security." },
          ] },
        ],
      },
      {
        title: "Why it matters more for Nepal",
        blocks: [
          { type: "p", text: "For a Nepal import the release is needed at the Indian port, not in Nepal. The delivery order there depends on it, and so does the start of the transit to Birgunj. A container waiting for paper at Kolkata or Visakhapatnam runs up port storage and line detention before its journey to Nepal has even begun." },
          { type: "p", text: "When the goods are paid by letter of credit, the bank may hold the originals until it has paid. Build the courier time from the bank to the port agent into the plan, or agree a telex release with the seller once payment is made." },
        ],
      },
      {
        title: "Two bills, two releases",
        blocks: [
          { type: "p", text: "When a forwarder handles the ocean leg there are often two bills: the master bill of lading from the shipping line to the forwarder's agent, and the house bill from the forwarder to you. Both have to be released. A telex release on the house bill does not move the container while the master bill is still held at origin." },
        ],
      },
      {
        title: "Check the draft before it is issued",
        blocks: [
          { type: "p", text: "Most release delays begin as typing errors. Before the bill is final, check the draft against the invoice and the packing list." },
          { type: "list", items: [
            "Consignee and notify party, exactly as they will appear on the customs declaration",
            "The description of goods and the HS code, as on the invoice",
            "The number of packages and the gross weight, as on the packing list",
            "Container and seal numbers",
            "Place of delivery, and any transit wording your forwarder asks for",
          ] },
          { type: "p", text: "A correction after the bill is issued usually means a fee from the line and, once the manifest has been filed in India, an amendment that takes days." },
        ],
      },
    ],
    related: { service: { href: "/services/customs-clearance", label: "Customs and documentation" }, guides: ["sea-freight-through-india", "importing-to-nepal", "customs-clearance-in-nepal"] },
  },
];

export const blogSlugs = blogPosts.map((post) => post.slug);

export function blogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

/** About 200 words a minute, counted from everything the reader reads. */
export function readingMinutes(post: BlogPost) {
  const text = [post.intro, ...post.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => {
    if (block.type === "p") return [block.text];
    if (block.type === "list") return [block.title ?? "", ...block.items];
    if (block.type === "steps") return block.items.flatMap((item) => [item.title, item.copy]);
    return [block.caption];
  })])].join(" ");
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
}
