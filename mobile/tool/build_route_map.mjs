// Builds lib/ui/map/land_mask.dart: the land the route map is drawn from, as
// a grid of 0.1° cells covering South, East and South-East Asia and the Gulf
// (48°E–142°E, 2°S–46°N). Each cell is sea (0), land (1) or Nepal (2), run-
// length encoded row by row. The app samples it at whatever zoom a route
// needs, so the dots stay evenly spaced on screen. It also holds Nepal's
// border, simplified, which the map draws as a line.
//
// Source: Natural Earth via the world-atlas package (public domain).
//
//   npm pack world-atlas && tar xzf world-atlas-*.tgz
//   node mobile/tool/build_route_map.mjs package/countries-50m.json package/land-50m.json

import { readFileSync, writeFileSync } from "node:fs";

const [countriesPath, landPath] = process.argv.slice(2);
if (!countriesPath || !landPath) {
  console.error("usage: build_route_map.mjs <countries-50m.json> <land-50m.json>");
  process.exit(1);
}

export const WEST = 48;
export const EAST = 142;
export const SOUTH = -2;
export const NORTH = 46;
export const STEP = 0.1;
const COLUMNS = Math.round((EAST - WEST) / STEP);
const ROWS = Math.round((NORTH - SOUTH) / STEP);
const NEPAL = "524";

// TopoJSON arcs are quantized and delta-encoded; decode them to lon/lat.
function decodeArcs(topology) {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function ring(arcs, indexes) {
  const points = [];
  for (const index of indexes) {
    const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
}

function rings(topology, geometries) {
  const arcs = decodeArcs(topology);
  const out = [];
  for (const geometry of geometries) {
    const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.type === "MultiPolygon" ? geometry.arcs : [];
    for (const polygon of polygons) for (const r of polygon) out.push(ring(arcs, r));
  }
  return out;
}

// Even-odd scanline fill at each cell's centre.
function rasterize(allRings, grid, value) {
  const edges = [];
  for (const r of allRings) {
    for (let i = 0; i < r.length - 1; i++) {
      const [x1, y1] = r[i];
      const [x2, y2] = r[i + 1];
      if (y1 === y2) continue;
      edges.push(y1 < y2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1]);
    }
  }
  for (let row = 0; row < ROWS; row++) {
    const lat = NORTH - (row + 0.5) * STEP;
    const crossings = [];
    for (const [x1, y1, x2, y2] of edges) {
      if (lat < y1 || lat >= y2) continue;
      crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil((crossings[i] - WEST) / STEP - 0.5));
      const to = Math.min(COLUMNS - 1, Math.floor((crossings[i + 1] - WEST) / STEP - 0.5));
      for (let column = from; column <= to; column++) grid[row * COLUMNS + column] = value;
    }
  }
}

const land = JSON.parse(readFileSync(landPath, "utf8"));
const countries = JSON.parse(readFileSync(countriesPath, "utf8"));
const grid = new Uint8Array(COLUMNS * ROWS);
rasterize(rings(land, land.objects.land.geometries ?? [land.objects.land]), grid, 1);
rasterize(rings(countries, countries.objects.countries.geometries.filter((g) => g.id === NEPAL)), grid, 2);

// One byte per run: value in the top two bits, length (1–63) below.
const bytes = [];
for (let row = 0; row < ROWS; row++) {
  let column = 0;
  while (column < COLUMNS) {
    const value = grid[row * COLUMNS + column];
    let length = 1;
    while (column + length < COLUMNS && length < 63 && grid[row * COLUMNS + column + length] === value) length++;
    bytes.push((value << 6) | length);
    column += length;
  }
}

// Nepal's outline, simplified to about 3 km, for the crisp border line.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const length = Math.hypot(bx - ax, by - ay) || 1e-9;
    const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (distance > worst) {
      worst = distance;
      at = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}
const nepalRing = rings(countries, countries.objects.countries.geometries.filter((g) => g.id === NEPAL)).sort((a, b) => b.length - a.length)[0];
// A closed ring has no baseline, so it is simplified in two halves.
const half = Math.floor(nepalRing.length / 2);
const outline = [...simplify(nepalRing.slice(0, half + 1), 0.03).slice(0, -1), ...simplify(nepalRing.slice(half), 0.03)].map(([lon, lat]) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`);

const encoded = Buffer.from(bytes).toString("base64");
const lines = encoded.match(/.{1,120}/g).map((line) => `    '${line}'`).join("\n");
writeFileSync(
  new URL("../lib/ui/map/land_mask.dart", import.meta.url),
  `// Generated by tool/build_route_map.mjs from Natural Earth (public domain).
// Don't edit by hand.

const landMaskWest = ${WEST}.0;
const landMaskNorth = ${NORTH}.0;
const landMaskStep = ${STEP};
const landMaskColumns = ${COLUMNS};
const landMaskRows = ${ROWS};

/// Run-length encoded, one byte per run: value (0 sea, 1 land, 2 Nepal) in
/// the top two bits, run length in the low six.
const landMaskRuns =
${lines};

/// Nepal's border as latitude, longitude pairs.
const nepalOutline = <double>[
${outline.map((pair) => `  ${pair},`).join("\n")}
];
`,
);
console.log(`${COLUMNS}×${ROWS} cells, ${bytes.length} runs, ${encoded.length} base64 chars, Nepal outline ${outline.length} points`);
