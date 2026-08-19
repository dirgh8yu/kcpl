"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduce ? 0 : 0.65, delay, ease: [0.25, 0.1, 0.25, 1] }}>{children}</motion.div>;
}

export function HeroRouteMap() {
  const reduce = useReducedMotion();
  return <div className="hero-route" aria-label="Illustrative route beginning in Kathmandu, Nepal">
    <div className="hero-orbit hero-orbit-a"/><div className="hero-orbit hero-orbit-b"/>
    <motion.div className="hero-route-line" initial={reduce ? false : { width: 0 }} animate={{ width: "70%" }} transition={{ duration: reduce ? 0 : 1.7, delay: 0.35, ease: [0.65, 0, 0.35, 1] }}/>
    <motion.span className="hero-cargo-node" initial={reduce ? false : { left: "17%", top: "62%", opacity: 0 }} animate={reduce ? { opacity: 1 } : { left: ["17%", "44%", "72%", "87%"], top: ["62%", "43%", "35%", "24%"], opacity: [0, 1, 1, 0] }} transition={reduce ? { duration: 0 } : { duration: 8, delay: 2, repeat: Infinity, ease: "linear" }}/>
    <motion.div className="route-origin" initial={reduce ? false : { opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .5, delay: .2 }}><span className="route-pulse"/></motion.div>
    <motion.div className="route-destination route-destination-a" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.35 }}><span/></motion.div>
    <motion.div className="route-destination route-destination-b" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: .7 }} transition={{ delay: reduce ? 0 : 1.6 }}><span/></motion.div>
    <motion.div className="route-origin-label" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : .8 }}><strong>KTM · KATHMANDU</strong><span>27.7172° N / 85.3240° E</span><small>Origin · Nepal</small></motion.div>
    <motion.div className="route-status" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.8 }}><span>ROUTE / INTL</span><b>OUTBOUND</b><small>ILLUSTRATIVE</small></motion.div>
  </div>;
}

const regions = [
  { name: "South Asia*", x: "45%", y: "61%", width: "clamp(70px, 13vw, 180px)", rotate: "3deg", delay: .1 },
  { name: "Southeast Asia*", x: "62%", y: "69%", width: "clamp(130px, 27vw, 380px)", rotate: "10deg", delay: .2 },
  { name: "Middle East*", x: "56%", y: "43%", width: "clamp(105px, 21vw, 290px)", rotate: "-13deg", delay: .3 },
  { name: "Europe*", x: "70%", y: "23%", width: "clamp(160px, 34vw, 470px)", rotate: "-25deg", delay: .4 },
  { name: "Australia*", x: "83%", y: "78%", width: "clamp(210px, 48vw, 680px)", rotate: "13deg", delay: .5 },
];

export function NetworkVisualization() {
  const reduce = useReducedMotion();
  return <div className="network-system" aria-label="Illustrative outbound routes from Kathmandu to international regions; not confirmed service markets">
    <div className="network-coordinates"><span>27°43&apos;N</span><span>85°19&apos;E</span><span>ALT 1,400M</span></div>
    <div className="network-contour network-contour-a"/><div className="network-contour network-contour-b"/><div className="network-axis network-axis-x"/><div className="network-axis network-axis-y"/>
    <div className="network-origin"><i/><strong>KTM</strong><span>KATHMANDU / NEPAL</span></div>
    {regions.map((r) => <div className="network-region" key={r.name} style={{ left: r.x, top: r.y }}><motion.div className="network-route" style={{ width: r.width, rotate: r.rotate }} initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: reduce ? 0 : 1.2, delay: r.delay, ease: [0.65, 0, 0.35, 1] }}/><motion.i initial={reduce ? false : { scale: .4, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: reduce ? 0 : r.delay + .8 }}/><motion.span initial={reduce ? false : { opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: reduce ? 0 : r.delay + .85 }}>{r.name}</motion.span></div>)}
    <div className="network-legend"><span><i className="gold-dot"/>ORIGIN</span><span><i/>ILLUSTRATIVE REGION</span><b>MARKETS TO BE CONFIRMED BY KCPL</b></div>
  </div>;
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
