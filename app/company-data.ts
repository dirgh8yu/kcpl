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
  phones: ["+977-1-4987510"],
  email: "admin@kapileshworcargo.com.np",
  website: "kapileshworcargo.com.np",
  instagram: "https://www.instagram.com/kapileshworcargo/",
} as const;

export const locations = ["Kathmandu", "Birgunj", "Nepalgunj", "Surkhet", "Raxaul", "Kolkata"] as const;

export const affiliations = [
  { name: "JCtrans", detail: "International logistics network", image: "/images/affiliations/jctrans.png", href: "https://www.jctrans.com/en/", width: 272, height: 80, tone: "dark" },
  { name: "LCCI", detail: "Lalitpur Chamber of Commerce & Industry", image: "/images/affiliations/lcci.svg", href: "https://lcci.org.np/", width: 384, height: 98, tone: "light" },
  { name: "NEFFA", detail: "Nepal Freight Forwarders Association", image: "/images/affiliations/neffa.png", href: "https://neffa.org.np/", width: 390, height: 150, tone: "light" },
  { name: "CPL", detail: "Cargo Plus Logistics Network", image: "/images/affiliations/cpl-network.png", href: "https://www.cplfamily.com/", width: 1024, height: 606, tone: "light" },
] as const;
