"use client";

import Image from "next/image";
import { ArrowDown, ArrowLeftRight } from "lucide-react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { ButtonLink } from "./button-link";
import { Container } from "./container";

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduce ? 0 : 0.65, delay, ease: [0.25, 0.1, 0.25, 1] }}>{children}</motion.div>;
}

const corridorStops = ["Kathmandu", "Birgunj", "Raxaul", "Kolkata"];

function TradeCorridor({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "hero-trade-corridor is-compact" : "hero-trade-corridor"} aria-label="Two-way trade corridor linking Kathmandu, Birgunj, Raxaul and Kolkata">
    <div className="hero-corridor-direction"><span>Global trade</span><ArrowLeftRight aria-hidden="true"/><span>Nepal gateways</span></div>
    <div className="hero-corridor-track" aria-hidden="true"><span className="hero-corridor-flow hero-corridor-flow-in"/><span className="hero-corridor-flow hero-corridor-flow-out"/></div>
    <ol>{corridorStops.map((stop, index) => <li key={stop}><i aria-hidden="true"/><span>{stop}</span><small>{index === 0 ? "Coordination" : index < 3 ? "Trade gateway" : "International connection"}</small></li>)}</ol>
    <p>IMPORT <span aria-hidden="true">↔</span> EXPORT</p>
  </div>;
}

export function HimalayanHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const mountainScale = useTransform(scrollYProgress, [0, .45, .78], [1.045, 1, .98]);
  const mountainY = useTransform(scrollYProgress, [0, .5], [0, -18]);
  const foregroundY = useTransform(scrollYProgress, [0, .5], [0, 10]);
  const copyY = useTransform(scrollYProgress, [0, .48], [0, -48]);
  const geographyY = useTransform(scrollYProgress, [.4, .75], [55, 0]);
  const corridorY = useTransform(scrollYProgress, [.54, .76], [40, 0]);
  const transitionY = useTransform(scrollYProgress, [.8, 1], ["100%", "0%"]);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = latest < .2 ? 1 : latest < .45 ? 2 : latest < .7 ? 3 : 4;
    setPhase((current) => current === next ? current : next);
  });

  return <section ref={ref} className={`himalayan-hero phase-${phase}${reduce ? " is-reduced" : ""}`} aria-label="KCPL import and export logistics between Nepal and the world">
    <div className="himalayan-hero-sticky">
      <motion.div className="hero-mountain-base" style={reduce ? undefined : { scale: mountainScale, y: mountainY }} aria-hidden="true">
        <Image src="/images/himalayan-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover"/>
      </motion.div>
      <motion.div className="hero-mountain-foreground" style={reduce ? undefined : { y: foregroundY }} aria-hidden="true">
        <Image src="/images/himalayan-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover"/>
      </motion.div>
      <div className="hero-atmosphere" aria-hidden="true"/>
      <div className="hero-contours" aria-hidden="true"/>
      <motion.div className="hero-geography" style={reduce ? undefined : { y: geographyY }} aria-hidden="true"><Image src="/images/nepal-satellite-nasa.jpg" alt="" fill sizes="100vw" className="object-cover"/><div/></motion.div>

      <Container className="hero-story-shell"><motion.div className="hero-story-copy" style={reduce ? undefined : { y: copyY }}>
        <div className="hero-nepal-accent"><span lang="ne">नेपालबाट संसारसम्म</span><small>From Nepal to the world</small></div>
        <p className="hero-kicker">Import · Export · Cross-border · Nepal</p>
        <h1>From the world<br/>to Nepal. <em>From Nepal</em><br/>to the world.</h1>
        <p className="hero-support">Since 2015, KCPL has coordinated import, export and cross-border freight through Nepal&apos;s key logistics gateways and international trade connections.</p>
        <div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
      </motion.div></Container>

      <motion.div className="hero-corridor-stage" style={reduce ? undefined : { y: corridorY }}><Container><TradeCorridor/></Container></motion.div>
      <div className="hero-scroll-cue" aria-hidden="true"><span>Trade in both directions</span><ArrowDown/></div>
      <motion.div className="hero-parchment-transition" style={reduce ? undefined : { y: transitionY }} aria-hidden="true"><div className="hero-dhaka-band"/></motion.div>
    </div>

    <div className="himalayan-hero-mobile">
      <div className="hero-mobile-image" aria-hidden="true"><Image src="/images/himalayan-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover"/><div/></div>
      <Container className="hero-mobile-copy">
        <div className="hero-nepal-accent"><span lang="ne">नेपालबाट संसारसम्म</span><small>From Nepal to the world</small></div>
        <p className="hero-kicker">Import · Export · Logistics · Nepal</p>
        <h1>From the world<br/>to Nepal. <em>From Nepal</em><br/>to the world.</h1>
        <p className="hero-support">Since 2015, KCPL has coordinated import, export and cross-border freight through Nepal&apos;s key logistics gateways and international trade connections.</p>
        <div className="hero-actions"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        <TradeCorridor compact/>
      </Container>
      <div className="hero-dhaka-band" aria-hidden="true"/>
    </div>
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
