import nepalAdm0 from "./data/nepal-adm0-boundary.json";

type Bounds = { west: number; east: number; south: number; north: number };
type Position = [longitude: number, latitude: number];

type NepalBoundaryData = {
  features: Array<{
    geometry: {
      type: "Polygon";
      coordinates: Position[][];
    };
  }>;
};

// geoBoundaries NPL ADM0 (2019), sourced from Open Data Nepal, CC BY 4.0.
// The geographic coordinates remain independent from their SVG presentation.
const boundary = nepalAdm0 as unknown as NepalBoundaryData;

export const nepalBoundarySource = "https://www.geoboundaries.org/countryDownloads.html#NPL";

export function createNepalBoundaryPath(width: number, height: number, bounds: Bounds) {
  return boundary.features[0].geometry.coordinates.map((ring) => ring.map(([longitude, latitude], index) => {
    const x = ((longitude - bounds.west) / (bounds.east - bounds.west)) * width;
    const y = ((bounds.north - latitude) / (bounds.north - bounds.south)) * height;
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ") + " Z").join(" ");
}
