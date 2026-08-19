"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, ArrowUpRight, Compass, Globe2, PlaneTakeoff, ShieldCheck } from "lucide-react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { affiliations } from "../company-data";
import { createNepalBoundaryPath, nepalBoundarySource } from "../nepal-boundary";
import { networkLocations } from "../network-data";
import { ButtonLink } from "./button-link";
import { Container } from "./container";

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduce ? 0 : 0.65, delay, ease: [0.25, 0.1, 0.25, 1] }}>{children}</motion.div>;
}

const whyItems = [
  { icon: Compass, title: "Route-led planning", copy: "Options shaped around the cargo, timeline and destination.", detail: "Route" },
  { icon: ShieldCheck, title: "Careful coordination", copy: "Documentation and handling processes considered throughout the journey.", detail: "Handover" },
  { icon: Globe2, title: "Local and global perspective", copy: "Understanding Nepal’s logistics environment while coordinating internationally.", detail: "Network" },
] as const;

export function WhyKCPL() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .24 });
  const reduce = useReducedMotion();

  return <section ref={ref} className="why-cinematic">
    <div className="why-contours" aria-hidden="true"/>
    <div className="why-coordinate" aria-hidden="true">KTM · 2015 · KCPL</div>
    <Container className="why-cinematic-shell">
      <motion.div className="why-cinematic-intro" initial={reduce ? false : { opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .8, ease: [0.22, 1, 0.36, 1] }}>
        <p className="eyebrow text-rhododendron">Why KCPL</p>
        <h2>Clarity at every <em>handover.</em></h2>
        <p>A shipment can cross multiple systems. The service model is designed to keep the route, documentation and communication aligned.</p>
        <div className="why-intro-note" aria-hidden="true"><span>Origin</span><i/><span>Destination</span></div>
      </motion.div>
      <div className="why-process">
        <div className="why-process-track" aria-hidden="true"><motion.i initial={false} animate={{ scaleY: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : 1.35, delay: reduce ? 0 : .18, ease: [0.65, 0, 0.35, 1] }}/></div>
        {whyItems.map(({ icon: Icon, title, copy, detail }, index) => <motion.article key={title} className="why-stage" initial={reduce ? false : { opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: reduce ? 0 : .72, delay: reduce ? 0 : .2 + index * .14, ease: [0.22, 1, 0.36, 1] }} whileHover={reduce ? undefined : { x: 6 }}>
          <div className="why-stage-number"><span>0{index + 1}</span><i/></div>
          <div className="why-stage-icon"><Icon size={24} strokeWidth={1.25}/></div>
          <div className="why-stage-heading"><small>{detail}</small><h3>{title}</h3></div>
          <p>{copy}</p>
          <span className="why-stage-rule" aria-hidden="true"/>
        </motion.article>)}
      </div>
    </Container>
    <div className="why-dhaka-edge" aria-hidden="true"/>
  </section>;
}

const specialistItems = [
  { n: "01", label: "Planned movement", title: "Project Cargo", copy: "Large, complex or high-value equipment requiring coordinated planning and transport.", href: "/services/project-cargo", image: "/images/services/specialist-project-cargo.jpg", alt: "Representative project cargo movement with an oversized industrial transformer on a multi-axle trailer" },
  { n: "02", label: "Non-containerised", title: "Break Bulk Cargo", copy: "Machinery, vehicles and construction materials moved outside standard containers.", href: "/services/break-bulk-cargo", image: "/images/services/specialist-break-bulk.jpg", alt: "Representative break bulk operation loading individual industrial cargo pieces onto a general cargo vessel" },
  { n: "03", label: "Top-loading access", title: "Open Top Container", copy: "Oversized cargo requiring top-loading or non-standard container access.", href: "/services/open-top-container", image: "/images/services/specialist-open-top.jpg", alt: "Representative open top container operation lowering oversized machinery through the open roof" },
] as const;

export function SpecialistCargo() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .16 });
  const reduce = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = specialistItems[activeIndex];

  return <section ref={ref} className="specialist-experience">
    <div className="specialist-topography" aria-hidden="true"/>
    <Container className="specialist-experience-shell">
      <div className="specialist-experience-heading">
        <motion.div initial={reduce ? false : { opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .8, ease: [0.22, 1, 0.36, 1] }}>
          <p className="eyebrow text-rhododendron">Specialist cargo</p>
          <h2>Built for cargo that does not fit the <em>standard route.</em></h2>
        </motion.div>
        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : .7, delay: reduce ? 0 : .2 }}>Specialist movements begin with the cargo itself—its dimensions, handling requirements and the route needed to move it.</motion.p>
      </div>

      <div className="specialist-workbench">
        <motion.figure className={`specialist-visual specialist-visual-${activeIndex + 1}`} initial={reduce ? false : { opacity: 0, clipPath: "inset(0 100% 0 0)" }} animate={inView ? { opacity: 1, clipPath: "inset(0 0% 0 0)" } : {}} transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : .12, ease: [0.65, 0, 0.35, 1] }}>
          {specialistItems.map((item, index) => <motion.div key={item.image} className="specialist-visual-image" initial={false} animate={{ opacity: activeIndex === index ? 1 : 0, scale: reduce ? 1 : activeIndex === index ? 1.025 : 1.055, x: reduce ? 0 : activeIndex === index ? (index === 1 ? -7 : index === 2 ? 7 : 0) : 0 }} transition={{ duration: reduce ? 0 : .85, ease: [0.22, 1, 0.36, 1] }} aria-hidden={activeIndex !== index}><Image src={item.image} alt={activeIndex === index ? item.alt : ""} fill sizes="(max-width: 767px) 100vw, 58vw" className="object-cover"/></motion.div>)}
          <div className="specialist-visual-tone" aria-hidden="true"/>
          <div className="specialist-visual-meta"><span>KCPL / Specialist handling</span><span>Plan · Coordinate · Move</span></div>
          <motion.strong key={activeItem.n} className="specialist-visual-index" initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .5 }}>{activeItem.n}</motion.strong>
          <figcaption><small>Selected service</small><motion.span key={activeItem.title} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .45 }}>{activeItem.title}</motion.span></figcaption>
          <div className="specialist-route-mark" aria-hidden="true"><i/><span/><i/></div>
        </motion.figure>

        <div className="specialist-service-index" aria-label="Specialist cargo services">
          {specialistItems.map((item, index) => <motion.div key={item.title} initial={reduce ? false : { opacity: 0, x: 28 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: reduce ? 0 : .65, delay: reduce ? 0 : .24 + index * .13, ease: [0.22, 1, 0.36, 1] }}>
            <Link href={item.href} className={`specialist-service-link ${activeIndex === index ? "is-active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)}>
              <span className="specialist-service-number">{item.n}</span>
              <span className="specialist-service-copy"><small>{item.label}</small><strong>{item.title}</strong><span>{item.copy}</span></span>
              <i className="specialist-service-arrow"><ArrowUpRight size={18}/></i>
            </Link>
          </motion.div>)}
          <motion.p className="specialist-manifest-note" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : .7, delay: reduce ? 0 : .75 }}><span>Planning note</span> Cargo details determine the suitable equipment, handling sequence and transport plan.</motion.p>
        </div>
      </div>
    </Container>
    <div className="specialist-edge" aria-hidden="true"/>
  </section>;
}

function AffiliationGroup({ duplicate = false }: { duplicate?: boolean }) {
  return <div className="affiliation-rail-group" aria-hidden={duplicate || undefined}>
    {affiliations.map((item, index) => <a
      key={`${duplicate ? "duplicate-" : ""}${item.name}`}
      href={item.href}
      target="_blank"
      rel="noreferrer"
      tabIndex={duplicate ? -1 : undefined}
      className={`affiliation-mark affiliation-mark-${item.tone}`}
      aria-label={`${item.name} official website`}
    >
      <span className="affiliation-mark-index">0{index + 1}</span>
      <span className="affiliation-logo-stage">
        <Image src={item.image} alt={`${item.name} official logo`} width={item.width} height={item.height} sizes="(max-width: 767px) 220px, 280px"/>
      </span>
      <span className="affiliation-mark-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
      <ArrowUpRight className="affiliation-mark-arrow" size={18}/>
    </a>)}
  </div>;
}

export function IndustryNetwork() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .2 });
  const reduce = useReducedMotion();

  return <section ref={ref} className="industry-network" aria-labelledby="industry-network-title">
    <div className="industry-network-pattern" aria-hidden="true"/>
    <Container className="industry-network-heading">
      <motion.div initial={reduce ? false : { opacity: 0, x: -28 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: reduce ? 0 : .8, ease: [0.22, 1, 0.36, 1] }}>
        <p className="eyebrow text-gold">Industry network</p>
        <h2 id="industry-network-title">Connected to the communities <em>behind trade.</em></h2>
      </motion.div>
      <motion.div className="industry-network-intro" initial={reduce ? false : { opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .7, delay: reduce ? 0 : .12 }}>
        <span>Professional affiliations</span>
        <p>KCPL&apos;s listed affiliations connect the company with freight-forwarding and business networks in Nepal and internationally.</p>
      </motion.div>
    </Container>

    <motion.div className="affiliation-rail-window" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : .9, delay: reduce ? 0 : .2 }}>
      <div className="affiliation-rail-track">
        <AffiliationGroup/>
        <AffiliationGroup duplicate/>
      </div>
    </motion.div>

    <Container className="industry-network-footer">
      <span>Listed by KCPL</span><i aria-hidden="true"/><span>Official organization marks</span>
    </Container>
  </section>;
}

type GeoPoint = { x: number; y: number };
type GeoBounds = { west: number; east: number; south: number; north: number };

const WORLD = { width: 1600, height: 800, bounds: { west: -180, east: 180, south: -90, north: 90 } } as const;
const REGION = { width: 1440, height: 900, bounds: { west: 74.5333333333, east: 92.1333333333, south: 21, north: 32 } } as const;
const HERO_NEPAL_BOUNDARY = createNepalBoundaryPath(REGION.width, REGION.height, REGION.bounds);
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
    <path className="hero-nepal-boundary" d={HERO_NEPAL_BOUNDARY} aria-hidden="true"/>
    <g className="hero-branch-links" aria-hidden="true">{networkLocations.filter((location) => location.id !== "kathmandu").map((location) => <path key={location.id} d={routeArc(kathmandu, positions[location.id], .08)}/>)}</g>
    <g>{networkLocations.map((location) => { const point = positions[location.id]; const label = location.type === "head-office" ? "HEAD OFFICE" : "KCPL BRANCH"; const offset = markerLabelOffsets[location.id]; return <g key={location.id} className={`hero-branch-marker ${location.type === "head-office" ? "is-head-office" : ""}`} transform={`translate(${point.x} ${point.y})`}><circle className="branch-ring" r={location.type === "head-office" ? 17 : 11}/><circle className="branch-core" r={location.type === "head-office" ? 6 : 4}/><text x={offset.dx} y={offset.dy} textAnchor={offset.anchor}>{location.name}</text><text className="branch-role" x={offset.dx} y={offset.dy + 17} textAnchor={offset.anchor}>{label}</text></g>; })}</g>
  </svg>;
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
          <h1 className="hero-brand-headline"><span>Nepal moves through us.</span><span>The world opens <em>from here.</em></span></h1><p className="hero-support">International freight, customs and logistics powered by KCPL&apos;s regional network and trusted counterparts worldwide.</p><div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        </motion.div>
        <div className="hero-phase-copy hero-phase-global"><p className="hero-kicker">Counterparts worldwide</p><h2>One connected logistics network beyond borders.</h2></div>
        <div className="hero-phase-copy hero-phase-physical"><p className="hero-kicker">KCPL on the ground</p><h2>Regional presence.<br/>Practical coordination.</h2><p>Branches positioned across Nepal&apos;s commercial regions and cross-border logistics network.</p></div>
        <div className="hero-phase-copy hero-phase-flow"><p className="hero-kicker">Import + Export</p><h2>Global reach.<br/><em>Local control.</em></h2><p>From our own regional branches to trusted counterparts around the world, KCPL connects Nepalese trade with international markets in both directions.</p></div>
      </Container>

      <div className="hero-network-legend"><span><i className="legend-kcpl"/>KCPL location</span><span><i className="legend-counterpart"/>International counterpart region</span></div>
      <div className="hero-satellite-credit">Imagery: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble / MODIS</a> · Boundary: <a href={nepalBoundarySource} target="_blank" rel="noreferrer">geoBoundaries / Open Data Nepal</a></div>
      <motion.div className="hero-parchment-transition" style={reduce ? undefined : { y: transitionY }} aria-hidden="true"><div className="hero-dhaka-band"/></motion.div>
    </div>

    <div className="himalayan-hero-mobile">
      <div className="hero-mobile-image" aria-hidden="true"><Image src="/images/nepal-satellite-nasa.jpg" alt="" fill priority sizes="100vw" className="object-cover"/><div/></div>
      <Container className="hero-mobile-copy">
        <p className="hero-kicker">International freight · Customs · Logistics</p>
        <h1 className="hero-brand-headline"><span>Nepal moves through us.</span><span>The world opens <em>from here.</em></span></h1><p className="hero-support">International freight, customs and logistics powered by KCPL&apos;s regional network and trusted counterparts worldwide.</p>
        <div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        <div className="hero-mobile-network"><p className="hero-kicker">KCPL on the ground</p><h2>Six verified operational locations.</h2><ul>{networkLocations.map((location) => <li key={location.id}><i/><span><strong>{location.name}</strong><small>{location.type === "head-office" ? "Head Office" : "KCPL Branch"}</small></span></li>)}</ul><div className="hero-mobile-counterparts"><span>Counterparts worldwide</span><p>Trusted international logistics relationships beyond KCPL&apos;s own regional branches.</p></div><div className="hero-mobile-flow"><ArrowLeftRight/><span>Import into Nepal</span><span>Export from Nepal</span></div></div>
      </Container>
      <div className="hero-dhaka-band" aria-hidden="true"/>
    </div>
    <ul className="sr-only">{networkLocations.map((location) => <li key={location.id}>{location.name}, {location.country}: {location.type === "head-office" ? "KCPL head office" : "KCPL branch"}</li>)}<li>KCPL works with logistics counterparts worldwide. Counterpart nodes do not represent KCPL branches or offices.</li></ul>
  </section>;
}

const stages = [
  ["01", "Cargo brief", "Enquiry", "Share the cargo, origin, destination and preferred timeline."],
  ["02", "Movement plan", "Route planning", "Review the suitable freight mode, route and service scope."],
  ["03", "Cargo in motion", "Prepare & dispatch", "Coordinate documentation, collection and cargo movement."],
  ["04", "Final handover", "Track to destination", "Follow key milestones through to the planned destination."],
];

export function JourneyTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: .25 });
  const reduce = useReducedMotion();
  return <div ref={ref} className="journey-system">
    <div className="journey-route-labels" aria-hidden="true"><span>Origin / enquiry</span><span>Destination / handover</span></div>
    <div className="journey-track"><motion.div className="journey-progress" initial={false} animate={{ scaleX: inView ? 1 : 0, scaleY: inView ? 1 : 0 }} transition={{ duration: reduce ? 0 : 1.4, ease: [0.65, 0, 0.35, 1] }}/></div>
    <motion.span className="journey-moving-point" aria-hidden="true" initial={false} animate={{ left: inView ? "100%" : "0%", opacity: inView ? [0, 1, 1, 0] : 0 }} transition={{ duration: reduce ? 0 : 1.55, delay: reduce ? 0 : .18, ease: [0.65, 0, 0.35, 1] }}/>
    {stages.map(([n,label,title,copy],index)=><motion.article key={n} className="journey-stage" initial={reduce ? false : { opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .65, delay: reduce ? 0 : .22 + index * .16, ease: [0.22, 1, 0.36, 1] }}><span className="journey-node"><i/></span><b>{n}</b><small>{label}</small><h3>{title}</h3><p>{copy}</p><span className="journey-stage-rule" aria-hidden="true"/></motion.article>)}
  </div>;
}

export function QuoteLaunch() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .28 });
  const reduce = useReducedMotion();

  return <section ref={ref} className="quote-launch">
    <div className="quote-launch-contours" aria-hidden="true"/>
    <Container className="quote-launch-shell">
      <div className="quote-launch-heading">
        <motion.div initial={reduce ? false : { opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .75, ease: [0.22, 1, 0.36, 1] }}>
          <p className="eyebrow">Start a shipment</p>
          <h2>Plan the <em>first leg.</em></h2>
          <p>Share the route and essential cargo measurements. The full enquiry opens with these details ready.</p>
        </motion.div>

        <div className="quote-flight-graphic" aria-hidden="true">
          <span className="quote-flight-origin"><i/>KTM / ORIGIN</span>
          <span className="quote-flight-destination"><i/>ROUTE / FORWARD</span>
          <span className="quote-flight-path"/>
          <motion.span className="quote-flight-plane" initial={false} animate={reduce ? { left: "72%", bottom: "67%", opacity: 1 } : inView ? { left: "72%", bottom: "67%", opacity: 1, rotate: -10 } : { left: "8%", bottom: "17%", opacity: .15, rotate: -2 }} transition={{ duration: reduce ? 0 : 1.65, delay: reduce ? 0 : .2, ease: [0.65, 0, 0.35, 1] }}><PlaneTakeoff size={38} strokeWidth={1.25}/></motion.span>
        </div>
      </div>

      <motion.form action="/quote" method="get" className="quote-launch-form" initial={reduce ? false : { opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduce ? 0 : .8, delay: reduce ? 0 : .18, ease: [0.22, 1, 0.36, 1] }}>
        <div className="quote-launch-route-fields">
          <label><span>Origin</span><input name="origin" placeholder="City, country" autoComplete="address-level2" required/></label>
          <label><span>Destination</span><input name="destination" placeholder="City, country" autoComplete="address-level2" required/></label>
          <label><span>Freight mode</span><select name="mode" defaultValue=""><option value="" disabled>Select mode</option><option value="air">Air freight</option><option value="sea">Sea freight</option><option value="road">Road freight</option><option value="unsure">Not sure yet</option></select></label>
        </div>
        <div className="quote-launch-cargo-fields">
          <label className="quote-weight-field"><span>Weight</span><div><input name="weight" type="number" min="0" step="any" inputMode="decimal" placeholder="0"/><select name="weightUnit" defaultValue="kg" aria-label="Weight unit"><option value="kg">kg</option><option value="tonnes">tonnes</option><option value="lb">lb</option></select></div></label>
          <div className="quote-dimension-field"><span>Dimensions</span><div><label><span className="sr-only">Length</span><input name="length" type="number" min="0" step="any" inputMode="decimal" placeholder="L"/></label><i>×</i><label><span className="sr-only">Width</span><input name="width" type="number" min="0" step="any" inputMode="decimal" placeholder="W"/></label><i>×</i><label><span className="sr-only">Height</span><input name="height" type="number" min="0" step="any" inputMode="decimal" placeholder="H"/></label><select name="dimensionUnit" defaultValue="cm" aria-label="Dimension unit"><option value="cm">cm</option><option value="m">m</option><option value="in">in</option></select></div></div>
          <button type="submit">Continue enquiry <ArrowRight size={17}/></button>
        </div>
      </motion.form>
      <div className="quote-launch-note"><span>01 · Route</span><i/><span>02 · Cargo profile</span><i/><span>03 · Email KCPL</span></div>
    </Container>
  </section>;
}
