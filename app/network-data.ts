export type NetworkGroup = "operations" | "gateways" | "origins" | "destinations";

export type NetworkPoint = {
  id: string;
  name: string;
  coordinates: readonly [longitude: number, latitude: number];
  groups: readonly NetworkGroup[];
};

// Country-level export markers indicate markets, not a particular consignee or KCPL office.
export const networkPoints: readonly NetworkPoint[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.324, 27.717], groups: ["operations"] },
  { id: "birgunj", name: "Birgunj", coordinates: [84.882, 27.01], groups: ["operations", "gateways"] },
  { id: "nepalgunj", name: "Nepalgunj", coordinates: [81.617, 28.05], groups: ["operations"] },
  { id: "surkhet", name: "Surkhet", coordinates: [81.636, 28.6], groups: ["operations"] },
  { id: "raxaul", name: "Raxaul", coordinates: [84.85, 26.98], groups: ["operations", "gateways"] },
  { id: "kolkata", name: "Kolkata", coordinates: [88.364, 22.573], groups: ["operations", "gateways"] },
  { id: "visakhapatnam", name: "Visakhapatnam", coordinates: [83.219, 17.687], groups: ["gateways"] },
  { id: "haldia", name: "Haldia", coordinates: [88.07, 22.066], groups: ["gateways"] },
  { id: "shanghai", name: "Shanghai", coordinates: [121.474, 31.23], groups: ["origins"] },
  { id: "ningbo", name: "Ningbo", coordinates: [121.55, 29.87], groups: ["origins"] },
  { id: "qingdao", name: "Qingdao", coordinates: [120.383, 36.067], groups: ["origins"] },
  { id: "shekou", name: "Shekou", coordinates: [113.91, 22.49], groups: ["origins"] },
  { id: "hong-kong", name: "Hong Kong", coordinates: [114.17, 22.32], groups: ["origins"] },
  { id: "bangkok", name: "Bangkok", coordinates: [100.502, 13.756], groups: ["origins"] },
  { id: "port-klang", name: "Port Klang", coordinates: [101.398, 3.0], groups: ["origins"] },
  { id: "singapore", name: "Singapore", coordinates: [103.82, 1.35], groups: ["origins"] },
  { id: "united-states", name: "United States", coordinates: [-98.58, 39.83], groups: ["destinations"] },
  { id: "canada", name: "Canada", coordinates: [-106.35, 56.13], groups: ["destinations"] },
  { id: "united-kingdom", name: "United Kingdom", coordinates: [-2.49, 54.5], groups: ["destinations"] },
  { id: "germany", name: "Germany", coordinates: [10.45, 51.17], groups: ["destinations"] },
  { id: "netherlands", name: "Netherlands", coordinates: [5.29, 52.13], groups: ["destinations"] },
  { id: "switzerland", name: "Switzerland", coordinates: [8.23, 46.82], groups: ["destinations"] },
  { id: "australia", name: "Australia", coordinates: [133.78, -25.27], groups: ["destinations"] },
  { id: "south-korea", name: "South Korea", coordinates: [127.98, 36.35], groups: ["destinations"] },
  { id: "brazil", name: "Brazil", coordinates: [-51.93, -14.24], groups: ["destinations"] },
];

export function networkGroupNames(group: NetworkGroup) {
  return networkPoints.filter((point) => point.groups.includes(group)).map((point) => point.name);
}
