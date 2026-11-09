import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

/*
 * The home page route, drawn as the Gateway K. Today's shape is kept: Origin drops
 * 45 degrees to the lower arm, the diagonal stroke climbs to the upper arm, and both
 * arms meet with 45-degree cuts. The upper arm is China, the lower arm India, and
 * they meet at Kathmandu just before Destination. Phones get the same K stood upright.
 *
 * Everything is CSS animation with delays worked out here, so the opening draw needs
 * no script and a reader without JavaScript sees the finished drawing.
 */

export type KStation = "inland" | "kerung" | "rasuwa" | "tatopani" | "kolkata" | "birgunj" | "nepalgunj" | "surkhet" | "kathmandu";
export type KArm = "china" | "india";
export type KPart = "china" | "india" | "diagonal" | "tatopani" | "air";
export type KFocus = KArm | "air" | null;

type Point = readonly [number, number];
type Side = "above" | "below" | "left" | "right" | "under";
type Shape = {
  kind: "wide" | "tall";
  box: Point;
  china: readonly Point[];
  india: readonly Point[];
  diagonal: readonly Point[];
  tatopani: readonly Point[];
  tail: readonly Point[];
  air: string;
  gaps: readonly (readonly [number, number, "h" | "v"])[];
  stations: readonly (readonly [KStation, number, number, KArm | "hub", Side])[];
  names: readonly (readonly [KArm, number, number, number, "middle" | "end" | "start"])[];
};

const WIDE: Shape = {
  kind: "wide",
  box: [1000, 300],
  china: [[0, 150], [110, 40], [780, 40], [890, 150]],
  india: [[0, 150], [110, 260], [780, 260], [890, 150]],
  diagonal: [[290, 260], [510, 40]],
  tatopani: [[560, 40], [596, 76], [720, 76], [756, 40]],
  tail: [[890, 150], [1000, 150]],
  air: "M0,150 C200,-90 690,-90 890,150",
  gaps: [[660, 40, "h"], [624, 76, "h"], [420, 260, "h"]],
  stations: [
    ["inland", 300, 40, "china", "above"], ["kerung", 610, 40, "china", "above"], ["rasuwa", 712, 40, "china", "above"], ["tatopani", 668, 76, "china", "below"],
    ["kolkata", 200, 260, "india", "below"], ["birgunj", 470, 260, "india", "below"], ["nepalgunj", 600, 260, "india", "below"], ["surkhet", 715, 260, "india", "below"],
    ["kathmandu", 890, 150, "hub", "under"],
  ],
  names: [["china", 41, 81, -45, "middle"], ["india", 41, 219, 45, "middle"]],
};

const TALL: Shape = {
  kind: "tall",
  box: [340, 640],
  china: [[170, 0], [100, 70], [100, 540], [170, 610]],
  india: [[170, 0], [240, 70], [240, 540], [170, 610]],
  diagonal: [[240, 170], [100, 310]],
  tatopani: [[100, 400], [130, 430], [130, 500], [100, 530]],
  tail: [[170, 610], [170, 640]],
  air: "M170,0 C330,140 320,470 170,610",
  gaps: [[100, 440, "v"], [130, 448, "v"], [240, 330, "v"]],
  stations: [
    ["inland", 100, 130, "china", "left"], ["kerung", 100, 370, "china", "left"], ["rasuwa", 100, 500, "china", "left"], ["tatopani", 130, 474, "china", "right"],
    ["kolkata", 240, 120, "india", "right"], ["birgunj", 240, 360, "india", "right"], ["nepalgunj", 240, 440, "india", "right"], ["surkhet", 240, 510, "india", "right"],
    ["kathmandu", 170, 610, "hub", "right"],
  ],
  names: [["china", 86, 84, 0, "end"], ["india", 254, 84, 0, "start"]],
};

/* ---- Timing: when the drawing front reaches each place ---- */

const DRAW_MS = 1500;
const TAIL_MS = 220;
const segments = (points: readonly Point[]) => points.slice(1).map((point, index) => [points[index], point] as const);
const lengthOf = (points: readonly Point[]) => segments(points).reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
const pathOf = (points: readonly Point[]) => points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");

/** How far along a line a point sits (the point is on, or next to, the line). */
function along(points: readonly Point[], [x, y]: Point) {
  let best = Infinity, at = 0, run = 0;
  for (const [a, b] of segments(points)) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (length * length)));
    const distance = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
    if (distance < best) { best = distance; at = run + t * length; }
    run += length;
  }
  return at;
}

// The site's --ease-in-out, cubic-bezier(.77, 0, .175, 1), sampled so a share of the line can be turned into a moment.
const curve = (a: number, b: number, u: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
const SAMPLES = Array.from({ length: 201 }, (_, index) => [curve(.77, .175, index / 200), curve(0, 1, index / 200)] as const);
function momentOf(share: number) {
  if (share <= 0) return 0;
  if (share >= 1) return 1;
  for (let index = 1; index < SAMPLES.length; index++) {
    const [t1, p1] = SAMPLES[index];
    if (p1 >= share) { const [t0, p0] = SAMPLES[index - 1]; return t0 + (t1 - t0) * (share - p0) / (p1 - p0 || 1); }
  }
  return 1;
}

type Timing = { delay: number; duration: number };
function plan(shape: Shape) {
  const china = lengthOf(shape.china), india = lengthOf(shape.india);
  const at = (share: number) => Math.round(momentOf(share) * DRAW_MS);
  // The diagonal and the branch carry on from the front that reaches them, at its pace.
  const follow = (host: number, start: number, own: number): Timing => {
    const delay = at(start / host), end = start + own <= host ? at((start + own) / host) : DRAW_MS + 200;
    return { delay, duration: Math.max(120, end - delay) };
  };
  const diagonalStart = along(shape.india, shape.diagonal[0]);
  const tatopaniStart = along(shape.china, shape.tatopani[0]);
  const stations = Object.fromEntries(shape.stations.map(([id, x, y, arm]) => {
    if (arm === "hub") return [id, DRAW_MS];
    if (id === "tatopani") return [id, at((tatopaniStart + along(shape.tatopani, [x, y])) / china)];
    return [id, at(along(arm === "china" ? shape.china : shape.india, [x, y]) / (arm === "china" ? china : india))];
  })) as Record<KStation, number>;
  return {
    diagonal: follow(india, diagonalStart, lengthOf(shape.diagonal)),
    tatopani: follow(china, tatopaniStart, lengthOf(shape.tatopani)),
    stations,
  };
}

const PLANS = { wide: plan(WIDE), tall: plan(TALL) };

/* Where "Quote this route" style picks go: Chinese and Indian places fill Origin, Nepali places fill Destination. */
export const K_PICKS: Record<KStation, { box: "origin" | "destination"; part: 0 | 1 }> = {
  inland: { box: "origin", part: 0 }, kerung: { box: "origin", part: 0 }, kolkata: { box: "origin", part: 0 },
  rasuwa: { box: "destination", part: 0 }, tatopani: { box: "destination", part: 0 }, birgunj: { box: "destination", part: 1 },
  nepalgunj: { box: "destination", part: 0 }, surkhet: { box: "destination", part: 0 }, kathmandu: { box: "destination", part: 0 },
};

export type KLabels = {
  stations: Record<KStation, string>;
  info: Record<KStation, string>;
  arms: Record<KArm, string>;
  summary: string;
};

type DrawingProps = {
  shape: Shape;
  labels: KLabels;
  focus: KFocus;
  redrawn: Record<KPart, number>;
  onPick: (station: KStation) => void;
};

const percent = (shape: Shape, x: number, y: number) => ({ left: `${x / shape.box[0] * 100}%`, top: `${y / shape.box[1] * 100}%` });
const vars = (values: Record<string, string>) => values as CSSProperties;

function Drawing({ shape, labels, focus, redrawn, onPick }: DrawingProps) {
  const [hover, setHover] = useState<KArm | null>(null);
  const [active, setActive] = useState<KStation | null>(null);
  const timing = PLANS[shape.kind];
  const activeArm = active ? shape.stations.find(([id]) => id === active)?.[3] : undefined;
  const lit: KFocus = hover ?? (activeArm && activeArm !== "hub" ? activeArm : null) ?? focus;

  // A tap anywhere else closes a station's card on a phone.
  useEffect(() => {
    if (!active) return;
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest(".k-st")) setActive(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [active]);

  // Each part draws once on load; a mode change redraws only the parts it names, quickly.
  const draw = (part: KPart, initial: Timing): CSSProperties => redrawn[part]
    ? vars({ "--t": "650ms", "--d": "0ms", "--e": "var(--ease-in-out)" })
    : vars({ "--t": `${initial.duration}ms`, "--d": `${initial.delay}ms`, "--e": part === "china" || part === "india" ? "var(--ease-in-out)" : "linear" });
  const arm = { delay: 0, duration: DRAW_MS };
  const hide = (event: ReactPointerEvent) => { if (event.pointerType !== "touch") setActive(null); };
  const activeStation = shape.stations.find(([id]) => id === active);

  return (
    <div className={`k-route k-${shape.kind}`} data-focus={lit ?? undefined}>
      <svg viewBox={`0 0 ${shape.box[0]} ${shape.box[1]}`} aria-hidden="true">
        <path className="k-air k-draw" data-arm="air" pathLength={1} d={shape.air} key={`air-${redrawn.air}`} style={draw("air", arm)}/>
        <path className="k-arm k-draw" data-arm="form" pathLength={1} d={pathOf(shape.diagonal)} key={`diagonal-${redrawn.diagonal}`} style={draw("diagonal", timing.diagonal)}/>
        <path className="k-branch k-draw" data-arm="china" pathLength={1} d={pathOf(shape.tatopani)} key={`tatopani-${redrawn.tatopani}`} style={draw("tatopani", timing.tatopani)}/>
        <path className="k-arm k-draw" data-arm="china" pathLength={1} d={pathOf(shape.china)} key={`china-${redrawn.china}`} style={draw("china", arm)}/>
        <path className="k-arm k-draw" data-arm="india" pathLength={1} d={pathOf(shape.india)} key={`india-${redrawn.india}`} style={draw("india", arm)}/>
        <path className="k-arm k-draw" pathLength={1} d={pathOf(shape.tail)} style={vars({ "--t": `${TAIL_MS}ms`, "--d": `${DRAW_MS}ms`, "--e": "linear" })}/>
        {/* Each border is a small cut in the line, the quietest possible mark. */}
        {shape.gaps.map(([x, y, along]) => along === "h"
          ? <rect key={`${x}-${y}`} className="k-gap" x={x - 2.5} y={y - 9} width={5} height={18}/>
          : <rect key={`${x}-${y}`} className="k-gap" x={x - 9} y={y - 2.5} width={18} height={5}/>)}
        {/* Wide invisible strokes, so pointing anywhere near an arm lights it. */}
        {(["china", "india"] as const).map((key) => (
          <path key={key} className="k-hit" d={pathOf(shape[key])} onPointerEnter={(event) => event.pointerType !== "touch" && setHover(key)} onPointerLeave={() => setHover(null)}/>
        ))}
        <path className="k-hit" d={pathOf(shape.tatopani)} onPointerEnter={(event) => event.pointerType !== "touch" && setHover("china")} onPointerLeave={() => setHover(null)}/>
      </svg>
      {shape.names.map(([key, x, y, rotate, align]) => (
        <span key={key} className="k-name" data-arm={key} style={{ ...percent(shape, x, y), transform: `translate(${align === "end" ? "-100%" : align === "start" ? "0" : "-50%"}, -50%) rotate(${rotate}deg)` }}>{labels.arms[key]}</span>
      ))}
      {shape.stations.map(([id, x, y, armOf, side]) => (
        <div key={id} className={`k-st k-${side}${armOf === "hub" ? " k-hub" : ""}${lit && armOf === lit ? " is-lit" : ""}`} data-arm={armOf === "hub" ? undefined : armOf} style={{ ...percent(shape, x, y), ...vars({ "--d": `${timing.stations[id]}ms` }) }}>
          <button
            type="button"
            aria-label={`${labels.stations[id]}. ${labels.info[id]}`}
            onPointerEnter={(event) => event.pointerType !== "touch" && setActive(id)}
            onPointerLeave={hide}
            onFocus={() => setActive(id)}
            onBlur={() => setActive(null)}
            onClick={() => { onPick(id); setActive(id); }}
          />
          <b>{labels.stations[id]}</b>
        </div>
      ))}
      {activeStation ? (
        <div className={`k-card k-card-${shape.kind === "tall" ? (activeStation[3] === "hub" ? "above" : "below") : activeStation[3] === "hub" ? "left" : activeStation[0] === "tatopani" ? "lower" : activeStation[3] === "china" ? "below" : "above"}`} style={percent(shape, activeStation[1], activeStation[2])} aria-hidden="true">
          {labels.info[activeStation[0]]}
        </div>
      ) : null}
    </div>
  );
}

/** Both drawings render; CSS shows the wide one on larger screens and the upright one on phones. */
export function KRoute({ labels, focus, redrawn, onPick }: Omit<DrawingProps, "shape">) {
  return (
    <div className="k-map">
      <p className="sr-only">{labels.summary}</p>
      <Drawing shape={WIDE} labels={labels} focus={focus} redrawn={redrawn} onPick={onPick}/>
      <Drawing shape={TALL} labels={labels} focus={focus} redrawn={redrawn} onPick={onPick}/>
    </div>
  );
}
