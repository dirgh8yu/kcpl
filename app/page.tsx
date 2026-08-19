import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Compass, Globe2, PackageCheck, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { ButtonLink } from "./components/button-link";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { HeroRouteMap, JourneyTimeline, NetworkVisualization, Reveal } from "./components/home-motion";
import { affiliations, company } from "./company-data";

const supportServices = [
  { icon: Warehouse, title: "Warehousing", copy: "Storage and cargo handling integrated with the wider shipment plan.", href: "/services/warehousing" },
  { icon: Box, title: "Packaging & Storage", copy: "Cargo preparation and storage coordinated around the movement plan.", href: "/services/packaging-storage" },
  { icon: Truck, title: "Ground Transport", copy: "Road movement aligned with collection, customs and delivery requirements.", href: "/services/ground-transport" },
  { icon: PackageCheck, title: "Door-to-Door Delivery", copy: "Pickup-to-delivery coordination through one clear point of contact.", href: "/services/door-to-door" },
];

const specialistServices = [
  { n: "01", title: "Project Cargo", copy: "Large, complex or high-value equipment requiring coordinated planning and transport.", href: "/services/project-cargo" },
  { n: "02", title: "Break Bulk Cargo", copy: "Non-containerised cargo such as machinery, vehicles and construction materials.", href: "/services/break-bulk-cargo" },
  { n: "03", title: "Open Top Container", copy: "Oversized cargo requiring top-loading or non-standard container access.", href: "/services/open-top-container" },
];

export default function HomePage() {
  return <><Header/><main>
    <section className="hero-cinematic relative overflow-hidden bg-navy text-white">
      <div className="route-grid absolute inset-0 opacity-35" />
      <Container className="relative grid min-h-[780px] items-center gap-10 pb-16 pt-36 lg:min-h-[850px] lg:grid-cols-[1.08fr_.92fr] lg:pt-28">
        <div className="relative z-10 max-w-3xl">
          <Reveal><p className="eyebrow text-gold">Freight forwarding · Logistics · Nepal</p></Reveal>
          <h1 className="mt-6 text-[clamp(3.15rem,7vw,7rem)] font-extrabold leading-[.94] tracking-[-.065em]">Moving Nepal.<br/><span className="text-white/55">Connecting</span><br/>the World.</h1>
          <p className="mt-8 max-w-xl text-base leading-8 text-white/65 sm:text-lg">Since 2015, KCPL has coordinated air, ocean and road freight for businesses moving cargo through Nepal and international markets.</p>
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
          <Image src="/images/air-freight.jpg" alt="Unbranded cargo aircraft being loaded at an airport" fill sizes="(max-width: 768px) 100vw, 58vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"/>
          <div className="service-shade"/><div className="service-copy"><span>01 / Air</span><h3>Air Freight</h3><p>For time-sensitive cargo moving between Nepal and international markets.</p><ArrowRight/></div>
        </Link>
        <Link href="/services/sea-freight" className="service-visual service-sea group">
          <Image src="/images/ocean-freight.jpg" alt="Container ship and port cargo operations" fill sizes="(max-width: 768px) 100vw, 42vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"/>
          <div className="service-shade"/><div className="service-copy"><span>02 / Ocean</span><h3>Ocean Freight</h3><p>Ocean freight coordination through suitable regional gateways.</p><ArrowRight/></div>
        </Link>
        <Link href="/services/road-freight" className="service-road group"><div><span className="eyebrow text-gold">03 / Road freight</span><h3>Across borders.<br/>Across Nepal.</h3></div><div className="road-route-motif"><i/><i/><i/><span>ROUTE / GROUND</span></div><ArrowRight className="transition-transform group-hover:translate-x-2"/></Link>
      </div>
      <div className="mt-20 grid gap-10 lg:grid-cols-[.62fr_1.38fr]"><div><p className="eyebrow text-gold">Logistics & handling</p><h3 className="mt-4 text-3xl font-extrabold tracking-[-.04em] text-navy">The services around the shipment.</h3></div><div className="service-support !mt-0">{supportServices.map(({icon:Icon,title,copy,href},i)=><Link key={title} href={href} className="support-service group"><span className="support-number">0{i+4}</span><Icon size={24} strokeWidth={1.35}/><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={16} className="support-arrow"/></Link>)}</div></div>
    </Container></section>

    <section className="company-editorial overflow-hidden bg-offwhite"><Container className="grid gap-12 py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-32">
      <Reveal><p className="eyebrow text-gold">Established {company.founded}</p><h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-.05em] sm:text-6xl">Built in Kathmandu.<br/><span className="text-slate/45">Connected through trade gateways.</span></h2></Reveal>
      <div className="company-statement"><p className="text-xl font-semibold leading-9 tracking-[-.02em] text-navy sm:text-2xl">KCPL coordinates local, cross-border and international cargo through a practical network.</p><p className="mt-6 text-base leading-8 text-slate">From branches in Nepal and India to personnel across Nepal&apos;s customs entry points and overseas counterparts, the focus stays on clear handovers and reliable coordination.</p><p className="mt-5 text-xs font-extrabold uppercase tracking-[.17em] text-gold">{new Date().getFullYear() - company.founded} years in logistics</p><div className="mt-9"><ButtonLink href="/about" variant="light">About KCPL</ButtonLink></div></div>
      <div className="company-wordmark" aria-hidden="true">KATHMANDU / NEPAL / LOGISTICS</div>
    </Container></section>

    <section className="why-editorial bg-white py-24 lg:py-32"><Container><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><Reveal><p className="eyebrow text-gold">Why KCPL</p><h2 className="section-title mt-4">Clarity at every handover.</h2><p className="mt-7 max-w-md text-base leading-8 text-slate">A shipment can cross multiple systems. The service model is designed to keep the route, documentation and communication aligned.</p></Reveal><div className="why-list">{[[Compass,"Route-led planning","Options shaped around the cargo, timeline and destination."],[ShieldCheck,"Careful coordination","Documentation and handling processes considered throughout the journey."],[Globe2,"Local and global perspective","Understanding Nepal’s logistics environment while coordinating internationally."]].map(([Icon,title,copy],i)=>{const I=Icon as typeof Compass;return <Reveal key={title as string} delay={i*.08}><div className="why-row"><span>0{i+1}</span><I size={25} strokeWidth={1.3}/><div><h3>{title as string}</h3><p>{copy as string}</p></div></div></Reveal>})}</div></div></Container></section>

    <section className="full-bleed-visual relative min-h-[660px] overflow-hidden text-white">
      <Image src="/images/nepal-road-freight.jpg" alt="Freight truck travelling on a mountain highway in Nepal" fill sizes="100vw" className="object-cover"/>
      <div className="full-bleed-overlay"/>
      <Container className="relative flex min-h-[660px] items-end pb-16 lg:pb-24"><Reveal><p className="eyebrow text-gold">Coordinated freight movement</p><h2 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[.98] tracking-[-.055em] sm:text-7xl lg:text-8xl">Built for movement.</h2><p className="mt-7 max-w-xl text-base leading-8 text-white/70">From the first route decision to the final handover, every stage depends on clear, connected logistics coordination.</p></Reveal></Container>
    </section>

    <section className="network-signature relative overflow-hidden bg-navy py-24 text-white lg:py-32"><div className="route-grid absolute inset-0 opacity-20"/><Container className="relative"><div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end"><Reveal><p className="eyebrow text-gold">Nepal to the world</p><h2 className="section-title mt-4">From Nepal&apos;s trade gateways to global markets.</h2></Reveal><p className="max-w-xl text-base leading-8 text-white/60 lg:justify-self-end">Kathmandu connects through KCPL&apos;s Nepal locations, border and customs gateways, Raxaul and Kolkata, then onward through an international counterpart network.</p></div><div className="mt-14"><NetworkVisualization/></div><div className="mt-8 flex justify-end"><ButtonLink href="/network" variant="secondary">Explore the network</ButtonLink></div></Container></section>

    <section className="cargo-editorial bg-offwhite py-24 lg:py-32"><Container><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><Reveal><p className="eyebrow text-gold">Specialist cargo</p><h2 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-[-.045em] sm:text-6xl">Built for cargo that does not fit the standard route.</h2></Reveal><div className="specialist-list">{specialistServices.map((service)=><Link key={service.title} href={service.href} className="specialist-row group"><span>{service.n}</span><div><h3>{service.title}</h3><p>{service.copy}</p></div><ArrowRight size={18}/></Link>)}</div></div></Container></section>

    <section className="customs-editorial bg-white py-24 lg:py-32"><Container><div className="grid gap-14 lg:grid-cols-[.82fr_1.18fr] lg:items-center"><Reveal><p className="eyebrow text-gold">Customs coverage</p><h2 className="section-title mt-4">Present where Nepal trades.</h2></Reveal><div><p className="text-xl font-semibold leading-9 tracking-[-.02em] text-navy">KCPL combines its branch network with personnel positioned across Nepal&apos;s customs entry points.</p><p className="mt-5 max-w-2xl text-base leading-8 text-slate">This supports documentation, coordination and cargo movement through key trade gateways without implying a formal office at every entry point.</p><Link className="text-link mt-8" href="/network">View network <ArrowRight size={16}/></Link></div></div></Container></section>

    <section className="affiliations-section border-y border-line bg-offwhite py-14"><Container><div className="grid gap-8 lg:grid-cols-[.6fr_1.4fr] lg:items-center"><div><p className="eyebrow text-gold">Industry network</p><h2 className="mt-3 text-2xl font-extrabold tracking-[-.035em] text-navy">Professional affiliations</h2></div><div className="affiliation-list">{affiliations.map((item)=><div key={item.name}><strong>{item.name}</strong><span>{item.detail}</span></div>)}</div></div></Container></section>

    <section className="journey-editorial bg-white py-24 lg:py-32"><Container><div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><Reveal><p className="eyebrow text-gold">The shipment journey</p><h2 className="section-title mt-4">From enquiry to destination.</h2></Reveal><p className="max-w-sm text-sm leading-7 text-slate">A connected process designed to move from one clear decision point to the next.</p></div><div className="mt-16"><JourneyTimeline/></div></Container></section>

    <section className="quote-workflow bg-gold py-20 lg:py-24"><Container><div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end"><div><p className="eyebrow text-navy/55">Start a shipment</p><h2 className="mt-4 text-4xl font-extrabold leading-[1.03] tracking-[-.05em] text-navy sm:text-6xl">Plan the first leg.</h2><p className="mt-5 max-w-md text-sm leading-7 text-navy/65">Enter the basics to begin your freight enquiry. You can add cargo details on the next screen.</p></div><form action="/quote" method="get" className="freight-starter"><label><span>Origin</span><input name="origin" placeholder="City, country" required/></label><label><span>Destination</span><input name="destination" placeholder="City, country" required/></label><label><span>Freight mode</span><select name="mode" defaultValue=""><option value="" disabled>Select mode</option><option value="air">Air freight</option><option value="sea">Sea freight</option><option value="road">Road freight</option><option value="unsure">Not sure yet</option></select></label><button type="submit">Start your quote <ArrowRight size={16}/></button></form></div></Container></section>
  </main><Footer/></>;
}
