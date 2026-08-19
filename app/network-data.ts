export type NetworkLocationType = "head-office" | "branch" | "customs-coverage";

export type NetworkLocation = {
  id: string;
  name: string;
  country: "Nepal" | "India";
  latitude: number;
  longitude: number;
  type: NetworkLocationType;
  displayLabel: string;
  description: string;
  address?: string;
  phone?: string;
  email?: string;
  coordinateSource: string;
};

export const networkLocations: NetworkLocation[] = [
  {
    id: "kathmandu",
    name: "Kathmandu",
    country: "Nepal",
    latitude: 27.70169,
    longitude: 85.3206,
    type: "head-office",
    displayLabel: "Head Office",
    description: "KCPL head office and primary coordination point.",
    address: "Pragatipath Finance Complex, 2nd Floor, Mhepi Road, Sorakhutte, Kathmandu, Nepal",
    phone: "+977-1-4987510",
    email: "admin@kapileshworcargo.com.np",
    coordinateSource: "https://www.geonames.org/1283240/kathmandu.html",
  },
  {
    id: "birgunj",
    name: "Birgunj",
    country: "Nepal",
    latitude: 27.01736,
    longitude: 84.88047,
    type: "branch",
    displayLabel: "Nepal location",
    description: "Verified KCPL operational location in Nepal.",
    coordinateSource: "https://www.geonames.org/search.html?country=NP&q=Parsa",
  },
  {
    id: "nepalgunj",
    name: "Nepalgunj",
    country: "Nepal",
    latitude: 28.05,
    longitude: 81.61667,
    type: "branch",
    displayLabel: "Nepal location",
    description: "Verified KCPL operational location in Nepal.",
    coordinateSource: "https://www.geonames.org/search.html?country=NP&featureClass=P&q=",
  },
  {
    id: "surkhet",
    name: "Surkhet",
    country: "Nepal",
    latitude: 28.59669,
    longitude: 81.61658,
    type: "branch",
    displayLabel: "Nepal location",
    description: "Verified KCPL operational location in Nepal.",
    coordinateSource: "https://www.geonames.org/search.html?country=NP&featureClass=P&q=",
  },
  {
    id: "raxaul",
    name: "Raxaul",
    country: "India",
    latitude: 26.97982,
    longitude: 84.85065,
    type: "branch",
    displayLabel: "Cross-border location",
    description: "Verified KCPL cross-border operational location in India.",
    coordinateSource: "https://www.geonames.org/search.html?country=IN&featureClass=P&q=&startRow=300",
  },
  {
    id: "kolkata",
    name: "Kolkata",
    country: "India",
    latitude: 22.56263,
    longitude: 88.36304,
    type: "branch",
    displayLabel: "India location",
    description: "Verified KCPL operational location in India.",
    coordinateSource: "https://www.geonames.org/1275004/kolkata.html",
  },
];

// Customs-entry-point personnel are verified as a coverage category, but no
// individual points are plotted until KCPL confirms their exact locations.
export const customsCoverageLocations: NetworkLocation[] = [];

export const networkRoutes = [
  { id: "ktm-birgunj", from: "kathmandu", to: "birgunj", stage: "domestic" },
  { id: "birgunj-raxaul", from: "birgunj", to: "raxaul", stage: "cross-border" },
  { id: "raxaul-kolkata", from: "raxaul", to: "kolkata", stage: "cross-border" },
] as const;
