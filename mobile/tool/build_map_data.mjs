// Builds assets/map/asia.kmap: the map the apps draw routes on, in the plain
// grey-and-white style of a ride-hailing map. Land, lakes, rivers, roads,
// borders and city names for South, East and South-East Asia and the Gulf
// (48°E–142°E, 2°S–46°N), clipped, simplified and packed small.
//
// Source: Natural Earth 1:10m (public domain), from
// https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
//
//   node mobile/tool/build_map_data.mjs <folder with the ne_10m_*.geojson files>
//
// Format (little endian, all counts and coordinates as unsigned LEB128
// varints, coordinates as zigzag deltas on a 0.005° grid from the west and
// south edges):
//   "KMAP" 1  f32 west  f32 south  f32 step
//   layer*: u8 id, varint features, then per feature u8 rank, varint parts,
//           and per part varint points and the points
//   places: u8 255, varint count, then per place u8 rank, x, y, varint
//           length and UTF-8 name

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const folder = process.argv[2];
if (!folder) {
  console.error("usage: build_map_data.mjs <folder with ne_10m_*.geojson>");
  process.exit(1);
}

const WEST = 48;
const EAST = 142;
const SOUTH = -2;
const NORTH = 46;
const STEP = 0.005;
const box = { west: WEST, east: EAST, south: SOUTH, north: NORTH };

const read = (name) => JSON.parse(readFileSync(join(folder, `${name}.geojson`), "utf8")).features;

// --- geometry -------------------------------------------------------------

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const [ax, ay] = points[from];
    const [bx, by] = points[to];
    const length = Math.hypot(bx - ax, by - ay);
    let worst = 0;
    let at = -1;
    for (let i = from + 1; i < to; i++) {
      const [px, py] = points[i];
      const distance = length < 1e-12 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([from, at], [at, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Sutherland–Hodgman against the frame, one edge at a time.
function clipPolygon(ring) {
  const edges = [
    [(p) => p[0] >= box.west, (a, b) => at(a, b, (b[0] === a[0] ? 0 : (box.west - a[0]) / (b[0] - a[0])))],
    [(p) => p[0] <= box.east, (a, b) => at(a, b, (b[0] === a[0] ? 0 : (box.east - a[0]) / (b[0] - a[0])))],
    [(p) => p[1] >= box.south, (a, b) => at(a, b, (b[1] === a[1] ? 0 : (box.south - a[1]) / (b[1] - a[1])))],
    [(p) => p[1] <= box.north, (a, b) => at(a, b, (b[1] === a[1] ? 0 : (box.north - a[1]) / (b[1] - a[1])))],
  ];
  let output = ring;
  for (const [inside, cross] of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) output.push(cross(previous, current));
        output.push(current);
      } else if (inside(previous)) {
        output.push(cross(previous, current));
      }
    }
    if (!output.length) return [];
  }
  return output;
}
const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Lines are cut exactly where they cross the frame (with a small margin so
// they run off the edge rather than stopping short of it).
function clipLine(line) {
  const margin = 0.5;
  const w = WEST - margin;
  const e = EAST + margin;
  const s = SOUTH - margin;
  const n = NORTH + margin;
  const inside = (p) => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  // Liang–Barsky: the part of segment a→b inside the frame, if any.
  const clip = (a, b) => {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - w], [dx, e - a[0]], [-dy, a[1] - s], [dy, n - a[1]]]) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    return t0 > t1 ? null : [at(a, b, t0), at(a, b, t1)];
  };
  const parts = [];
  let current = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i];
    if (i === 0) {
      if (inside(p)) current.push(p);
      continue;
    }
    const piece = clip(line[i - 1], p);
    if (!piece) continue;
    if (!current.length) current.push(piece[0]);
    current.push(piece[1]);
    if (!inside(p)) {
      if (current.length > 1) parts.push(current);
      current = [];
    }
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

const touches = (coordinates) => {
  let hit = false;
  const walk = (c) => {
    if (hit) return;
    if (typeof c[0] === "number") {
      if (c[0] >= WEST - 1 && c[0] <= EAST + 1 && c[1] >= SOUTH - 1 && c[1] <= NORTH + 1) hit = true;
    } else c.forEach(walk);
  };
  walk(coordinates);
  return hit;
};

function polygons(features, tolerance, rank = () => 0) {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g || !touches(g.coordinates)) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) {
      const parts = poly.map((ring) => simplify(clipPolygon(ring), tolerance)).filter((ring) => ring.length >= 3);
      if (parts.length) out.push({ rank: rank(f.properties), parts });
    }
  }
  return out;
}

function lines(features, tolerance, rank = () => 0, keep = () => true) {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g || !keep(f.properties) || !touches(g.coordinates)) continue;
    const ls = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    const parts = ls.flatMap(clipLine).map((l) => simplify(l, tolerance)).filter((l) => l.length >= 2);
    if (parts.length) out.push({ rank: rank(f.properties), parts });
  }
  return out;
}

// --- encoding -------------------------------------------------------------

const bytes = [];
const u8 = (v) => bytes.push(v & 255);
const varint = (v) => {
  let n = v >>> 0;
  while (n >= 128) {
    bytes.push((n & 127) | 128);
    n >>>= 7;
  }
  bytes.push(n);
};
const zigzag = (v) => (v << 1) ^ (v >> 31);
const f32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeFloatLE(v);
  bytes.push(...b);
};
const qx = (lon) => Math.round((lon - WEST) / STEP);
const qy = (lat) => Math.round((lat - SOUTH) / STEP);

function writeLayer(id, features) {
  u8(id);
  varint(features.length);
  let points = 0;
  for (const { rank, parts } of features) {
    u8(Math.max(0, Math.min(255, rank | 0)));
    varint(parts.length);
    for (const part of parts) {
      // Drop points that land on the same grid cell as the one before.
      const grid = [];
      for (const [lon, lat] of part) {
        const x = qx(lon);
        const y = qy(lat);
        const last = grid[grid.length - 1];
        if (!last || last[0] !== x || last[1] !== y) grid.push([x, y]);
      }
      varint(grid.length);
      let px = 0;
      let py = 0;
      for (const [x, y] of grid) {
        varint(zigzag(x - px));
        varint(zigzag(y - py));
        px = x;
        py = y;
      }
      points += grid.length;
    }
  }
  return points;
}

bytes.push(..."KMAP".split("").map((c) => c.charCodeAt(0)));
u8(1);
f32(WEST);
f32(SOUTH);
f32(STEP);

const roadRank = (p) => p.scalerank;
const layers = [
  [1, "land", polygons(read("ne_10m_land"), 0.01)],
  [2, "lakes", polygons(read("ne_10m_lakes"), 0.01, (p) => p.scalerank)],
  [3, "rivers", lines(read("ne_10m_rivers_lake_centerlines"), 0.015, (p) => p.scalerank)],
  [4, "states", lines(read("ne_10m_admin_1_states_provinces_lines"), 0.02, (p) => p.scalerank ?? 5)],
  [5, "borders", lines(read("ne_10m_admin_0_boundary_lines_land"), 0.01, (p) => p.scalerank ?? 0)],
  [6, "roads", lines(read("ne_10m_roads"), 0.01, roadRank, (p) => p.type !== "Ferry Route" && p.type !== "Track")],
];
for (const [id, name, features] of layers) {
  const points = writeLayer(id, features);
  console.log(`${name}: ${features.length} features, ${points} points`);
}

// Cities: the larger towns everywhere, and every town Natural Earth has in
// Nepal, since that is where every route begins or ends.
const places = read("ne_10m_populated_places_simple")
  .filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    if (lon < WEST || lon > EAST || lat < SOUTH || lat > NORTH) return false;
    return f.properties.adm0name === "Nepal" || f.properties.scalerank <= 7;
  })
  .sort((a, b) => a.properties.scalerank - b.properties.scalerank || b.properties.pop_max - a.properties.pop_max);
u8(255);
varint(places.length);
for (const f of places) {
  const [lon, lat] = f.geometry.coordinates;
  u8(f.properties.scalerank);
  varint(qx(lon));
  varint(qy(lat));
  const name = Buffer.from(f.properties.name, "utf8");
  varint(name.length);
  bytes.push(...name);
}
console.log(`places: ${places.length}`);

const out = new URL("../assets/map/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("asia.kmap", out), Buffer.from(bytes));
console.log(`asia.kmap: ${(bytes.length / 1024).toFixed(0)} KB`);
