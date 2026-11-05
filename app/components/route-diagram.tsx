/** The route as a transit diagram: the main line through the border to Kathmandu,
 * the western branch, and the air line over the top. Positions come from the 800
 * by 240 drawing; the labels are HTML so they stay readable when it scales down. */
export type StationId = "kolkata" | "raxaul" | "birgunj" | "kathmandu" | "nepalgunj" | "surkhet";

const mainPath = "M0,120 L60,180 H200 L320,60 H740 L800,120";
const westPath = "M200,180 H740 L800,120";
const airPath = "M0,120 C200,-70 600,-70 800,120";

const stations: { id: StationId; x: number; y: number; below: boolean; line: string }[] = [
  { id: "kolkata", x: 150, y: 180, below: true, line: "main" },
  { id: "raxaul", x: 400, y: 60, below: false, line: "main" },
  { id: "birgunj", x: 520, y: 60, below: false, line: "main" },
  { id: "kathmandu", x: 660, y: 60, below: false, line: "main air" },
  { id: "nepalgunj", x: 480, y: 180, below: true, line: "west" },
  { id: "surkhet", x: 640, y: 180, below: true, line: "west" },
];

export function RouteDiagram({ names, mode, branch, ends }: { names: Record<StationId, string>; mode?: string; branch?: string; ends?: { from: string; to: string } }) {
  return (
    <div className="route-map" data-mode={mode} data-branch={branch}>
      <svg viewBox="0 0 800 240" aria-hidden="true">
        <path className="route-base" d={westPath}/>
        <path className="route-base" d={mainPath}/>
        <path className="route-air" pathLength={1} d={airPath} key={`air-${mode}`}/>
        <path className="route-west route-draw" pathLength={1} d={westPath}/>
        <path className="route-main route-draw" pathLength={1} d={mainPath} key={`main-${mode}`}/>
      </svg>
      {stations.map((station) => (
        <div key={station.id} className={`station${station.below ? " is-below" : ""}`} data-id={station.id} data-line={station.line} style={{ left: `${(station.x / 800) * 100}%`, top: `${(station.y / 240) * 100}%` }}>
          <i/><b>{names[station.id]}</b>
        </div>
      ))}
      {ends ? <>
        <div className="station is-end" style={{ left: 0, top: "50%" }}><i/><b>{ends.from}</b></div>
        <div className="station is-end is-last" style={{ left: "100%", top: "50%" }}><i/><b>{ends.to}</b></div>
      </> : null}
    </div>
  );
}

/** The same branching route for a phone, drawn top to bottom. */
export function RouteFork({ names }: { names: Record<StationId, string> }) {
  const stops: { id: StationId; x: number; y: number }[] = [
    { id: "kolkata", x: 20, y: 24 },
    { id: "raxaul", x: 20, y: 96 },
    { id: "birgunj", x: 20, y: 146 },
    { id: "kathmandu", x: 20, y: 196 },
    { id: "nepalgunj", x: 180, y: 126 },
    { id: "surkhet", x: 180, y: 196 },
  ];
  return (
    <svg className="route-fork" viewBox="0 0 340 214" aria-hidden="true">
      <path d="M20,24 V196"/>
      <path d="M20,50 H150 L180,80 V196"/>
      {stops.map((stop) => <g key={stop.id}><circle cx={stop.x} cy={stop.y} r="8"/><text x={stop.x + 16} y={stop.y + 5}>{names[stop.id]}</text></g>)}
    </svg>
  );
}
