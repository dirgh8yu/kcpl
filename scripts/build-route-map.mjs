// Builds app/route-map-data.ts: the dotted map of Asia behind the home page's
// opening route, from the same Natural Earth basemap the apps draw on
// (mobile/assets/map/asia.kmap, see mobile/tool/build_map_data.mjs).
//
//   node scripts/build-route-map.mjs
//
// Land becomes a grid of dots, each row stored as runs ("M x y h n" with a
// 0-length dash every unit), so a few thousand dots cost a few kilobytes of
// path data. Nepal's dots are kept apart so the page can light them. Places
// and the route are projected the same way (Web Mercator, north up).
import { readFileSync, writeFileSync } from "node:fs";

const WEST = 74;
const EAST = 124;
const NORTH = 36;
const SOUTH = -1;
const SCALE = 20; // viewBox units per degree of longitude
const GRID = 9; // viewBox units between dots

const mercator = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const inverseMercator = (y) => (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90;
const top = mercator(NORTH);
const project = ([lon, lat]) => [(lon - WEST) * SCALE, (top - mercator(lat)) * SCALE];
const width = (EAST - WEST) * SCALE;
const height = (top - mercator(SOUTH)) * SCALE;

// --- the land rings, decoded from the apps' basemap ---------------------------

function decodeLand(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== "KMAP" || bytes[4] !== 1) throw new Error("not a KCPL map");
  const west = view.getFloat32(5, true);
  const south = view.getFloat32(9, true);
  const step = view.getFloat32(13, true);
  let at = 17;
  const varint = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = bytes[at++];
      result += (byte & 127) * 2 ** shift;
      if (byte < 128) return result;
      shift += 7;
    }
  };
  const zigzag = (v) => (v % 2 ? -(v + 1) / 2 : v / 2);
  const rings = [];
  while (at < bytes.length) {
    const id = bytes[at++];
    if (id === 255) break; // places come last; nothing after them is land
    const features = varint();
    for (let f = 0; f < features; f++) {
      at++; // rank
      const parts = varint();
      for (let p = 0; p < parts; p++) {
        const count = varint();
        let x = 0;
        let y = 0;
        const ring = [];
        for (let i = 0; i < count; i++) {
          x += zigzag(varint());
          y += zigzag(varint());
          ring.push([west + x * step, south + y * step]);
        }
        if (id === 1) rings.push(ring);
      }
    }
  }
  return rings.map((ring) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    return { ring, minX, minY, maxX, maxY };
  });
}

function inside(point, ring) {
  const [px, py] = point;
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const land = decodeLand(new Uint8Array(readFileSync("mobile/assets/map/asia.kmap")));
const onLand = (lonLat) => {
  let hit = false;
  for (const shape of land) {
    if (lonLat[0] < shape.minX || lonLat[0] > shape.maxX || lonLat[1] < shape.minY || lonLat[1] > shape.maxY) continue;
    if (inside(lonLat, shape.ring)) hit = !hit;
  }
  return hit;
};

// Nepal, simplified to the accuracy of one dot (about half a degree).
const nepal = [
  [80.06, 28.84], [80.55, 29.6], [80.95, 30.25], [81.5, 30.2], [82.2, 30.05], [82.8, 29.7], [83.3, 29.5], [83.9, 29.3],
  [84.2, 28.95], [84.8, 28.6], [85.3, 28.3], [85.7, 28.35], [86.0, 27.95], [86.6, 28.1], [87.1, 27.9], [87.8, 27.9],
  [88.15, 27.85], [88.2, 27.4], [88.05, 26.9], [88.12, 26.42], [87.6, 26.4], [87.0, 26.55], [86.5, 26.55], [86.0, 26.65],
  [85.5, 26.8], [85.0, 26.95], [84.6, 27.3], [84.1, 27.5], [83.4, 27.45], [82.7, 27.5], [82.0, 27.75], [81.5, 27.95],
  [81.0, 28.4], [80.5, 28.65],
];

// --- the dot grid ------------------------------------------------------------

const columns = Math.floor(width / GRID);
const rows = Math.floor(height / GRID);
const runs = { land: [], nepal: [] };
let dots = 0;
for (let row = 0; row <= rows; row++) {
  const y = row * GRID;
  const lat = inverseMercator(top - y / SCALE);
  let current = null;
  const flush = () => {
    if (current) runs[current.layer].push(`M${current.start} ${row}h${current.end - current.start}`);
    current = null;
  };
  for (let column = 0; column <= columns; column++) {
    const lon = WEST + (column * GRID) / SCALE;
    const layer = onLand([lon, lat]) ? (inside([lon, lat], nepal) ? "nepal" : "land") : null;
    if (layer) dots++;
    if (current && current.layer === layer && current.end === column - 1) { current.end = column; continue; }
    flush();
    if (layer) current = { layer, start: column, end: column };
  }
  flush();
}

// --- places and the route ----------------------------------------------------

const places = {
  shanghai: [121.47, 31.23],
  singapore: [103.82, 1.35],
  kolkata: [88.36, 22.57],
  birgunj: [84.88, 27.01],
  kathmandu: [85.32, 27.72],
};

/** A smooth curve through the waypoints (Catmull-Rom as cubic Béziers). */
function curve(points) {
  const p = points.map(project);
  let d = `M${p[0].map(round).join(" ")}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${[...c1, ...c2, ...p2].map(round).join(" ")}`;
  }
  return d;
}
const round = (value) => Math.round(value * 10) / 10;

const routes = {
  // Out of Shanghai, down the South China Sea, through the Malacca Strait and
  // up the Bay of Bengal to the Hooghly.
  sea: curve([places.shanghai, [122.3, 29.2], [120.2, 24.6], [116.5, 20.2], [111.2, 13.5], [107.4, 6.6], [104.3, 1.6], [101.6, 1.9], [99.4, 3.6], [97.4, 5.9], [94.6, 8.4], [90.8, 14.2], [88.6, 19.8], places.kolkata]),
  // The rail-linked corridor across Bihar to the dry port at Birgunj.
  rail: curve([places.kolkata, [87.1, 23.7], [86.0, 24.9], [85.3, 25.9], places.birgunj]),
  // Over the hills to Kathmandu.
  road: curve([places.birgunj, [85.05, 27.4], places.kathmandu]),
  // Air exports leave Kathmandu for the world, off the western edge.
  air: curve([places.kathmandu, [81.0, 30.6], [77.0, 32.6], [WEST - 2, 33.8]]),
};

const projected = Object.fromEntries(Object.entries(places).map(([id, lonLat]) => [id, project(lonLat).map(round)]));

const source = `/*
 * Generated by scripts/build-route-map.mjs from mobile/assets/map/asia.kmap
 * (Natural Earth, public domain). Do not edit by hand: change the script and
 * run it again.
 *
 * ${dots} dots, ${runs.land.length + runs.nepal.length} runs, ${WEST}°E–${EAST}°E, ${SOUTH}°–${NORTH}°N, Web Mercator.
 */

export const routeMap = {
  width: ${round(width)},
  height: ${round(height)},
  /** Grid spacing: the dot paths are drawn in grid units and scaled by this. */
  grid: ${GRID},
  land: ${JSON.stringify(runs.land.join(""))},
  nepal: ${JSON.stringify(runs.nepal.join(""))},
  places: ${JSON.stringify(projected)},
  routes: ${JSON.stringify(routes, null, 2).replace(/\n/g, "\n  ")},
} as const;

export type RoutePlace = keyof typeof routeMap.places;
`;
writeFileSync("app/route-map-data.ts", source);
console.log(`app/route-map-data.ts: ${dots} dots, ${runs.land.length + runs.nepal.length} runs, ${Math.round(source.length / 1024)}KB`);
