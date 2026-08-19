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
  { name: "BIRGUNJ", x: "43%", y: "65%", width: "clamp(70px, 12vw, 165px)", rotate: "7deg", delay: .1 },
  { name: "NEPALGUNJ", x: "49%", y: "43%", width: "clamp(95px, 18vw, 245px)", rotate: "-12deg", delay: .18 },
  { name: "SURKHET", x: "58%", y: "28%", width: "clamp(130px, 25vw, 350px)", rotate: "-21deg", delay: .26 },
  { name: "RAXAUL", x: "65%", y: "67%", width: "clamp(155px, 31vw, 430px)", rotate: "5deg", delay: .34 },
  { name: "KOLKATA", x: "80%", y: "78%", width: "clamp(210px, 45vw, 630px)", rotate: "12deg", delay: .42 },
];

export function NetworkVisualization() {
  const reduce = useReducedMotion();
  return <div className="network-system" aria-label="KCPL network from Kathmandu through Nepal and India trade gateways">
    <div className="network-coordinates"><span>27°43&apos;N</span><span>85°19&apos;E</span><span>ALT 1,400M</span></div>
    <div className="network-contour network-contour-a"/><div className="network-contour network-contour-b"/><div className="network-axis network-axis-x"/><div className="network-axis network-axis-y"/>
    <div className="network-origin"><i/><strong>KTM</strong><span>KATHMANDU / NEPAL</span></div>
    {regions.map((r) => <div className="network-region" key={r.name} style={{ left: r.x, top: r.y }}><motion.div className="network-route" style={{ width: r.width, rotate: r.rotate }} initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: reduce ? 0 : 1.2, delay: r.delay, ease: [0.65, 0, 0.35, 1] }}/><motion.i initial={reduce ? false : { scale: .4, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: reduce ? 0 : r.delay + .8 }}/><motion.span initial={reduce ? false : { opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: reduce ? 0 : r.delay + .85 }}>{r.name}</motion.span></div>)}
    <div className="network-legend"><span><i className="gold-dot"/>HEAD OFFICE</span><span><i/>OPERATIONAL LOCATION</span><b>→ INTERNATIONAL COUNTERPART NETWORK</b></div>
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
