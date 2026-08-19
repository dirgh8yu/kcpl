import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Compass, Globe2, PackageCheck, ShieldCheck, Warehouse } from "lucide-react";
import { ButtonLink } from "./components/button-link";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { HeroRouteMap, JourneyTimeline, NetworkVisualization, Reveal } from "./components/home-motion";

export const metadata: Metadata = {
  title: "Kapileshwor Cargo | Moving Nepal. Connecting the World.",
  description: "International cargo, freight forwarding and logistics solutions connecting Nepal with the world.",
};

// Reserved for future use once verified figures are supplied by KCPL. Intentionally not rendered.
export const futureCompanyStats = { years: null, markets: null, shipments: null, locations: null };

const supportServices = [
  { icon: ClipboardCheck, title: "Customs Clearance", copy: "Documentation and customs coordination designed to support efficient cargo movement.", href: "/services/customs-clearance" },
  { icon: Warehouse, title: "Warehousing", copy: "Storage and cargo handling integrated with the wider shipment plan.", href: "/services/warehousing" },
  { icon: PackageCheck, title: "Door-to-Door", copy: "Pickup-to-delivery coordination through one clear point of contact.", href: "/services/door-to-door" },
];

export default function HomePage() {
  return <><Header/><main>
    <section className="hero-cinematic relative overflow-hidden bg-navy text-white">
      <div className="route-grid absolute inset-0 opacity-35" />
      <Container className="relative grid min-h-[780px] items-center gap-10 pb-16 pt-36 lg:min-h-[850px] lg:grid-cols-[1.08fr_.92fr] lg:pt-28">
        <div className="relative z-10 max-w-3xl">
          <Reveal><p className="eyebrow text-gold">Freight forwarding · Logistics · Nepal</p></Reveal>
          <h1 className="mt-6 text-[clamp(3.15rem,7vw,7rem)] font-extrabold leading-[.94] tracking-[-.065em]">Moving Nepal.<br/><span className="text-white/55">Connecting</span><br/>the World.</h1>
          <p className="mt-8 max-w-xl text-base leading-8 text-white/65 sm:text-lg">Integrated cargo and freight forwarding solutions built around Nepal&apos;s connection to global trade.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        </div>
        <div className="min-h-[360px] lg:min-h-[560px]"><HeroRouteMap/></div>
      </Container>
      <div className="absolute bottom-0 left-0 h-1 w-1/3 bg-gold" />
    </section>

    <section className="services-editorial bg-white py-24 lg:py-32"><Container>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><Reveal><p className="eyebrow text-gold">What we move</p><h2 className="section-title mt-4">Every shipment has a different way forward.</h2></Reveal><Link href="/services" className="text-link">Explore all services <ArrowRight size={16}/></Link></div>
      <div className="service-showcase mt-16">
        <Link href="/services/air-freight" className="service-visual service-air group">
          <Image src="/images/air-freight-placeholder.jpg" alt="Illustrative placeholder of an unbranded cargo aircraft being loaded" fill sizes="(max-width: 768px) 100vw, 58vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"/>
          <span className="image-placeholder-note">Replace with verified KCPL photography</span><div className="service-shade"/><div className="service-copy"><span>01 / Air</span><h3>Air Freight</h3><p>For time-sensitive cargo moving between Nepal and international markets.</p><ArrowRight/></div>
        </Link>
        <Link href="/services/sea-freight" className="service-visual service-sea group">
          <Image src="/images/sea-freight-placeholder.jpg" alt="Illustrative placeholder of an unbranded container ship at port" fill sizes="(max-width: 768px) 100vw, 42vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"/>
          <span className="image-placeholder-note">Replace with verified KCPL photography</span><div className="service-shade"/><div className="service-copy"><span>02 / Sea</span><h3>Sea Freight</h3><p>Ocean freight coordination through suitable regional gateways.</p><ArrowRight/></div>
        </Link>
        <Link href="/services/road-freight" className="service-road group"><div><span className="eyebrow text-gold">03 / Road freight</span><h3>Across borders.<br/>Across Nepal.</h3></div><div className="road-route-motif"><i/><i/><i/><span>ROUTE / GROUND</span></div><ArrowRight className="transition-transform group-hover:translate-x-2"/></Link>
      </div>
      <div className="service-support">{supportServices.map(({icon:Icon,title,copy,href},i)=><Link key={title} href={href} className="support-service group"><span className="support-number">0{i+4}</span><Icon size={24} strokeWidth={1.35}/><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={16} className="support-arrow"/></Link>)}</div>
    </Container></section>

    <section className="company-editorial overflow-hidden bg-offwhite"><Container className="grid gap-12 py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-32">
      <Reveal><p className="eyebrow text-gold">Company profile</p><h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-.05em] sm:text-6xl">Nepal-based.<br/><span className="text-slate/45">Internationally focused.</span></h2></Reveal>
      <div className="company-statement"><p className="text-xl font-semibold leading-9 tracking-[-.02em] text-navy sm:text-2xl">KCPL coordinates cargo and freight solutions for goods moving to, from and within Nepal.</p><p className="mt-6 text-base leading-8 text-slate">The approach is practical: understand the cargo, plan the route, coordinate the handovers and keep communication clear throughout the shipment journey.</p><div className="mt-9"><ButtonLink href="/about" variant="light">About KCPL</ButtonLink></div></div>
      <div className="company-wordmark" aria-hidden="true">KATHMANDU / NEPAL / LOGISTICS</div>
    </Container></section>

    <section className="why-editorial bg-white py-24 lg:py-32"><Container><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><Reveal><p className="eyebrow text-gold">Why KCPL</p><h2 className="section-title mt-4">Clarity at every handover.</h2><p className="mt-7 max-w-md text-base leading-8 text-slate">A shipment can cross multiple systems. The service model is designed to keep the route, documentation and communication aligned.</p></Reveal><div className="why-list">{[[Compass,"Route-led planning","Options shaped around the cargo, timeline and destination."],[ShieldCheck,"Careful coordination","Documentation and handling processes considered throughout the journey."],[Globe2,"Local and global perspective","Understanding Nepal’s logistics environment while coordinating internationally."]].map(([Icon,title,copy],i)=>{const I=Icon as typeof Compass;return <Reveal key={title as string} delay={i*.08}><div className="why-row"><span>0{i+1}</span><I size={25} strokeWidth={1.3}/><div><h3>{title as string}</h3><p>{copy as string}</p></div></div></Reveal>})}</div></div></Container></section>

    <section className="full-bleed-visual relative min-h-[660px] overflow-hidden text-white">
      <Image src="/images/nepal-road-freight-placeholder.jpg" alt="Illustrative placeholder of an unbranded freight truck on a mountain highway in Nepal" fill sizes="100vw" className="object-cover"/>
      <div className="full-bleed-overlay"/><span className="image-placeholder-note left-auto right-5 top-5">Replace with verified KCPL photography</span>
      <Container className="relative flex min-h-[660px] items-end pb-16 lg:pb-24"><Reveal><p className="eyebrow text-gold">Coordinated freight movement</p><h2 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[.98] tracking-[-.055em] sm:text-7xl lg:text-8xl">Built for movement.</h2><p className="mt-7 max-w-xl text-base leading-8 text-white/70">From the first route decision to the final handover, every stage depends on clear, connected logistics coordination.</p></Reveal></Container>
    </section>

    <section className="network-signature relative overflow-hidden bg-navy py-24 text-white lg:py-32"><div className="route-grid absolute inset-0 opacity-20"/><Container className="relative"><div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end"><Reveal><p className="eyebrow text-gold">Nepal to the world</p><h2 className="section-title mt-4">Kathmandu at the origin.</h2></Reveal><p className="max-w-xl text-base leading-8 text-white/60 lg:justify-self-end">A technical view of how Nepal can connect outward through coordinated trade lanes. Region labels below are illustrative placeholders only—not confirmed KCPL markets.</p></div><div className="mt-14"><NetworkVisualization/></div><div className="mt-8 flex justify-end"><ButtonLink href="/network" variant="secondary">Explore the network</ButtonLink></div></Container></section>

    <section className="cargo-editorial bg-offwhite py-24 lg:py-32"><Container><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><Reveal><p className="eyebrow text-gold">Cargo handled</p><h2 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-[-.045em] sm:text-6xl">Different cargo.<br/>One clear route.</h2></Reveal><div><p className="max-w-xl text-base leading-8 text-slate">Support can be planned around a range of commercial and personal cargo needs, subject to the selected route, carrier and regulatory requirements.</p><div className="cargo-words"><span>Industrial cargo</span><span>Retail & consumer goods</span><span>Commercial shipments</span><span>Personal effects</span></div></div></div></Container></section>

    <section className="journey-editorial bg-white py-24 lg:py-32"><Container><div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><Reveal><p className="eyebrow text-gold">The shipment journey</p><h2 className="section-title mt-4">From enquiry to destination.</h2></Reveal><p className="max-w-sm text-sm leading-7 text-slate">A connected process designed to move from one clear decision point to the next.</p></div><div className="mt-16"><JourneyTimeline/></div></Container></section>

    <section className="quote-workflow bg-gold py-20 lg:py-24"><Container><div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end"><div><p className="eyebrow text-navy/55">Start a shipment</p><h2 className="mt-4 text-4xl font-extrabold leading-[1.03] tracking-[-.05em] text-navy sm:text-6xl">Plan the first leg.</h2><p className="mt-5 max-w-md text-sm leading-7 text-navy/65">Enter the basics to begin your freight enquiry. You can add cargo details on the next screen.</p></div><form action="/quote" method="get" className="freight-starter"><label><span>Origin</span><input name="origin" placeholder="City, country" required/></label><label><span>Destination</span><input name="destination" placeholder="City, country" required/></label><label><span>Freight mode</span><select name="mode" defaultValue=""><option value="" disabled>Select mode</option><option value="air">Air freight</option><option value="sea">Sea freight</option><option value="road">Road freight</option><option value="unsure">Not sure yet</option></select></label><button type="submit">Start your quote <ArrowRight size={16}/></button></form></div></Container></section>
  </main><Footer/></>;
}
