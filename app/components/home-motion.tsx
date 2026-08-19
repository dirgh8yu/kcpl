"use client";

import Image from "next/image";
import { ArrowLeftRight } from "lucide-react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { networkLocations } from "../network-data";
import { ButtonLink } from "./button-link";
import { Container } from "./container";

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduce ? 0 : 0.65, delay, ease: [0.25, 0.1, 0.25, 1] }}>{children}</motion.div>;
}

type GeoPoint = { x: number; y: number };
type GeoBounds = { west: number; east: number; south: number; north: number };

const WORLD = { width: 1600, height: 800, bounds: { west: -180, east: 180, south: -90, north: 90 } } as const;
const REGION = { width: 1200, height: 900, bounds: { west: 76, east: 90, south: 21, north: 31.5 } } as const;
const counterpartRegions = [
  { id: "asia", label: "Asia", latitude: 35, longitude: 105 },
  { id: "middle-east", label: "Middle East", latitude: 25, longitude: 45 },
  { id: "europe", label: "Europe", latitude: 50, longitude: 10 },
  { id: "north-america", label: "North America", latitude: 40, longitude: -100 },
  { id: "africa", label: "Africa", latitude: 2, longitude: 20 },
  { id: "oceania", label: "Oceania", latitude: -25, longitude: 135 },
  { id: "south-america", label: "South America", latitude: -15, longitude: -60 },
] as const;

function project(longitude: number, latitude: number, width: number, height: number, bounds: GeoBounds): GeoPoint {
  return { x: ((longitude - bounds.west) / (bounds.east - bounds.west)) * width, y: ((bounds.north - latitude) / (bounds.north - bounds.south)) * height };
}

function routeArc(from: GeoPoint, to: GeoPoint, liftFactor = .15) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 - Math.min(145, Math.max(28, distance * liftFactor));
  return `M${from.x.toFixed(2)},${from.y.toFixed(2)} Q${controlX.toFixed(2)},${controlY.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`;
}

function GlobalNetworkGraphic() {
  const nepal = project(85.3206, 27.70169, WORLD.width, WORLD.height, WORLD.bounds);
  return <svg className="hero-world-network" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrative international counterpart regions connected with Nepal. These nodes do not represent KCPL offices.">
    <g className="hero-counterpart-routes" aria-hidden="true">{counterpartRegions.map((region) => { const point = project(region.longitude, region.latitude, WORLD.width, WORLD.height, WORLD.bounds); return <path key={region.id} d={routeArc(point, nepal)}/>; })}</g>
    <g className="hero-directional-routes hero-directional-in" aria-hidden="true">{counterpartRegions.slice(0, 5).map((region) => { const point = project(region.longitude, region.latitude, WORLD.width, WORLD.height, WORLD.bounds); return <path key={region.id} d={routeArc(point, nepal)}/>; })}</g>
    <g className="hero-directional-routes hero-directional-out" aria-hidden="true">{counterpartRegions.slice(0, 5).map((region) => { const point = project(region.longitude, region.latitude, WORLD.width, WORLD.height, WORLD.bounds); return <path key={region.id} d={routeArc(nepal, point, .12)}/>; })}</g>
    <g className="hero-counterpart-nodes">{counterpartRegions.map((region) => { const point = project(region.longitude, region.latitude, WORLD.width, WORLD.height, WORLD.bounds); return <g key={region.id} transform={`translate(${point.x} ${point.y})`}><circle r="3"/><circle r="7" className="counterpart-ring"/><title>{`${region.label} counterpart region — not a KCPL branch`}</title></g>; })}</g>
    <g className="hero-nepal-origin" transform={`translate(${nepal.x} ${nepal.y})`}><circle r="22"/><circle r="7"/><text x="29" y="5">NEPAL</text></g>
  </svg>;
}

const markerLabelOffsets: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  kathmandu: { dx: 18, dy: -18, anchor: "start" }, birgunj: { dx: -18, dy: 27, anchor: "end" }, raxaul: { dx: 18, dy: 48, anchor: "start" },
  nepalgunj: { dx: -18, dy: -18, anchor: "end" }, surkhet: { dx: 18, dy: -17, anchor: "start" }, kolkata: { dx: -18, dy: -18, anchor: "end" },
};

function PhysicalNetworkGraphic() {
  const positions = Object.fromEntries(networkLocations.map((location) => [location.id, project(location.longitude, location.latitude, REGION.width, REGION.height, REGION.bounds)])) as Record<string, GeoPoint>;
  const kathmandu = positions.kathmandu;
  return <svg className="hero-physical-network" viewBox={`0 0 ${REGION.width} ${REGION.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="KCPL physical network: head office in Kathmandu and branches in Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata.">
    <g className="hero-branch-links" aria-hidden="true">{networkLocations.filter((location) => location.id !== "kathmandu").map((location) => <path key={location.id} d={routeArc(kathmandu, positions[location.id], .08)}/>)}</g>
    <g>{networkLocations.map((location) => { const point = positions[location.id]; const label = location.type === "head-office" ? "HEAD OFFICE" : "KCPL BRANCH"; const offset = markerLabelOffsets[location.id]; return <g key={location.id} className={`hero-branch-marker ${location.type === "head-office" ? "is-head-office" : ""}`} transform={`translate(${point.x} ${point.y})`}><circle className="branch-ring" r={location.type === "head-office" ? 17 : 11}/><circle className="branch-core" r={location.type === "head-office" ? 6 : 4}/><text x={offset.dx} y={offset.dy} textAnchor={offset.anchor}>{location.name}</text><text className="branch-role" x={offset.dx} y={offset.dy + 17} textAnchor={offset.anchor}>{label}</text></g>; })}</g>
  </svg>;
}

function FlowIndicator() {
  return <div className="hero-flow-indicator" aria-label="Import into Nepal and export from Nepal"><span>Import <b>↓</b></span><i/><span><b>↑</b> Export</span></div>;
}

export function HimalayanHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const regionalScale = useTransform(scrollYProgress, [0, .2, .44, .72, 1], [1.09, 1.03, .86, 1.035, .98]);
  const regionalY = useTransform(scrollYProgress, [0, .2, .72], [0, -10, 0]);
  const worldScale = useTransform(scrollYProgress, [.16, .48, 1], [1.18, 1, 1.08]);
  const introY = useTransform(scrollYProgress, [0, .25], [0, -38]);
  const transitionY = useTransform(scrollYProgress, [.86, 1], ["100%", "0%"]);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = latest < .2 ? 1 : latest < .48 ? 2 : latest < .74 ? 3 : 4;
    setPhase((current) => current === next ? current : next);
  });

  return <section ref={ref} className={`himalayan-hero phase-${phase}${reduce ? " is-reduced" : ""}`} aria-label="KCPL connects Nepal with international logistics counterparts for import and export freight">
    <div className="himalayan-hero-sticky">
      <motion.div className="hero-satellite-layer hero-regional-layer" style={reduce ? undefined : { scale: regionalScale, y: regionalY }}>
        <Image src="/images/nepal-satellite-nasa.jpg" alt="" fill priority sizes="100vw" className="object-cover"/>
        <div className="hero-satellite-tone" aria-hidden="true"/>
        <div className="hero-map-stage hero-physical-stage"><PhysicalNetworkGraphic/></div>
      </motion.div>
      <motion.div className="hero-satellite-layer hero-world-layer" style={reduce ? undefined : { scale: worldScale }}>
        <Image src="/images/world-satellite-nasa.jpg" alt="" fill priority sizes="100vw" className="object-cover"/>
        <div className="hero-satellite-tone" aria-hidden="true"/>
        <div className="hero-map-stage hero-global-stage"><GlobalNetworkGraphic/></div>
      </motion.div>
      <div className="hero-atmosphere" aria-hidden="true"/><div className="hero-contours" aria-hidden="true"/>

      <Container className="hero-story-shell">
        <motion.div className="hero-phase-copy hero-phase-intro" style={reduce ? undefined : { y: introY }}>
          <p className="hero-kicker">International freight · Customs · Logistics</p>
          <h1>NEPAL <em>↔</em><br/>THE WORLD</h1><p className="hero-support">International freight, customs and logistics powered by KCPL&apos;s regional network and trusted counterparts worldwide.</p><FlowIndicator/><div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        </motion.div>
        <div className="hero-phase-copy hero-phase-global"><p className="hero-kicker">Counterparts worldwide</p><h2>One connected logistics network beyond borders.</h2><p>Subtle global nodes represent trusted counterpart relationships—not KCPL offices.</p></div>
        <div className="hero-phase-copy hero-phase-physical"><p className="hero-kicker">KCPL on the ground</p><h2>Regional presence.<br/>Practical coordination.</h2><p>Branches positioned across Nepal&apos;s commercial regions and cross-border logistics network.</p></div>
        <div className="hero-phase-copy hero-phase-flow"><p className="hero-kicker">Import + Export</p><h2>Global reach.<br/><em>Local control.</em></h2><p>From our own regional branches to trusted counterparts around the world, KCPL connects Nepalese trade with international markets in both directions.</p><FlowIndicator/></div>
      </Container>

      <div className="hero-network-legend"><span><i className="legend-kcpl"/>KCPL location</span><span><i className="legend-counterpart"/>International counterpart region</span></div>
      <a className="hero-satellite-credit" href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">Satellite imagery: NASA Blue Marble / MODIS</a>
      <motion.div className="hero-parchment-transition" style={reduce ? undefined : { y: transitionY }} aria-hidden="true"><div className="hero-dhaka-band"/></motion.div>
    </div>

    <div className="himalayan-hero-mobile">
      <div className="hero-mobile-image" aria-hidden="true"><Image src="/images/nepal-satellite-nasa.jpg" alt="" fill priority sizes="100vw" className="object-cover"/><div/></div>
      <Container className="hero-mobile-copy">
        <p className="hero-kicker">International freight · Customs · Logistics</p>
        <h1>NEPAL <em>↔</em><br/>THE WORLD</h1><p className="hero-support">International freight, customs and logistics powered by KCPL&apos;s regional network and trusted counterparts worldwide.</p><FlowIndicator/>
        <div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        <div className="hero-mobile-network"><p className="hero-kicker">KCPL on the ground</p><h2>Six verified operational locations.</h2><ul>{networkLocations.map((location) => <li key={location.id}><i/><span><strong>{location.name}</strong><small>{location.type === "head-office" ? "Head Office" : "KCPL Branch"}</small></span></li>)}</ul><div className="hero-mobile-counterparts"><span>Counterparts worldwide</span><p>Trusted international logistics relationships beyond KCPL&apos;s own regional branches.</p></div><div className="hero-mobile-flow"><ArrowLeftRight/><span>Import into Nepal</span><span>Export from Nepal</span></div></div>
      </Container>
      <div className="hero-dhaka-band" aria-hidden="true"/>
    </div>
    <ul className="sr-only">{networkLocations.map((location) => <li key={location.id}>{location.name}, {location.country}: {location.type === "head-office" ? "KCPL head office" : "KCPL branch"}</li>)}<li>KCPL works with logistics counterparts worldwide. Counterpart nodes do not represent KCPL branches or offices.</li></ul>
  </section>;
}

const stages = [
  ["01", "Enquiry", "Share the cargo, origin, destination and preferred timeline."],
  ["02", "Route planning", "Review the suitable freight mode, route and service scope."],
  ["03", "Prepare & dispatch", "Coordinate documentation, collection and cargo movement."],
  ["04", "Track to destination", "Follow key milestones through to the planned destination."],
];

export function JourneyTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: .25 });
  const reduce = useReducedMotion();
  return <div ref={ref} className="journey-system">
    <div className="journey-track"><motion.div className="journey-progress" initial={false} animate={{ scaleX: inView ? 1 : 0, scaleY: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : 1.4, ease: [0.65, 0, 0.35, 1] }}/></div>
    {stages.map(([n,title,copy],index)=><motion.article key={n} className="journey-stage" initial={reduce ? false : { opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .55, delay: reduce ? 0 : .25 + index * .18 }}><span className="journey-node"><i/></span><b>{n}</b><h3>{title}</h3><p>{copy}</p></motion.article>)}
  </div>;
}
