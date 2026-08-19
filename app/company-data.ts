export const company = {
  name: "Kapileshwor Cargo Pvt. Ltd.",
  shortName: "KCPL",
  founded: 2015,
  managingDirector: "Ramesh Mishra",
  addressLines: [
    "Pragatipath Finance Complex, 2nd Floor",
    "Mhepi Road, Sorakhutte",
    "Kathmandu, Nepal",
  ],
  phones: ["+977-1-4987510", "4027206"],
  email: "admin@kapileshworcargo.com.np",
  website: "kapileshworcargo.com.np",
} as const;

export const locations = ["Kathmandu", "Birgunj", "Nepalgunj", "Surkhet", "Raxaul", "Kolkata"] as const;

export const affiliations = [
  { name: "JCtrans", detail: "International logistics network" },
  { name: "LCCI", detail: "Lalitpur Chamber of Commerce & Industry" },
  { name: "NEFFA", detail: "Nepal Freight Forwarders Association" },
] as const;

export const serviceGroups = {
  freight: [
    { title: "Air Freight", href: "/services/air-freight" },
    { title: "Ocean Freight", href: "/services/sea-freight" },
    { title: "Road Freight", href: "/services/road-freight" },
  ],
  specialist: [
    { title: "Project Cargo", href: "/services/project-cargo" },
    { title: "Break Bulk Cargo", href: "/services/break-bulk-cargo" },
    { title: "Open Top Container", href: "/services/open-top-container" },
  ],
  logistics: [
    { title: "Warehousing", href: "/services/warehousing" },
    { title: "Packaging & Storage", href: "/services/packaging-storage" },
    { title: "Ground Transport", href: "/services/ground-transport" },
    { title: "Door-to-Door Delivery", href: "/services/door-to-door" },
  ],
} as const;
