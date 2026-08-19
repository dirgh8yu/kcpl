import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, PackageCheck, Truck, Warehouse } from "lucide-react";
import { ButtonLink } from "./components/button-link";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { HimalayanHero, IndustryNetwork, JourneyTimeline, QuoteLaunch, Reveal, SpecialistCargo, WhyKCPL } from "./components/home-motion";
import { NepalOperationsMap } from "./components/operations-map";
import { company } from "./company-data";

const supportServices = [
  { icon: Warehouse, title: "Warehousing", copy: "Storage and cargo handling integrated with the wider shipment plan.", href: "/services/warehousing", image: "/images/services/warehousing.jpg", alt: "Representative cargo warehouse with pallets and handling equipment" },
  { icon: Box, title: "Packaging & Storage", copy: "Cargo preparation and storage coordinated around the movement plan.", href: "/services/packaging-storage", image: "/images/services/packaging-storage.jpg", alt: "Representative cargo crate being secured for freight transport" },
  { icon: Truck, title: "Ground Transport", copy: "Road movement aligned with collection, customs and delivery requirements.", href: "/services/ground-transport", image: "/images/services/road-freight-nepal.jpg", alt: "Representative commercial freight truck on a Nepal highway" },
  { icon: PackageCheck, title: "Door-to-Door Delivery", copy: "Pickup-to-delivery coordination through one clear point of contact.", href: "/services/door-to-door", image: "/images/services/door-to-door.jpg", alt: "Representative commercial cargo handover at a receiving entrance" },
];

export default function HomePage() {
  return <><Header/><main>
    <HimalayanHero/>

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
        <Link href="/services/road-freight" className="service-road group"><Image src="/images/services/road-freight-nepal.jpg" alt="Representative freight truck travelling on a Nepal trade corridor" fill sizes="(max-width: 768px) 100vw, 42vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"/><div className="service-road-shade"/><div className="service-road-copy"><span className="eyebrow text-gold">03 / Road freight</span><h3>Across borders.<br/>Across Nepal.</h3><p>Domestic and Nepal–India road movement connected to the wider shipment route.</p></div><ArrowRight className="transition-transform group-hover:translate-x-2"/></Link>
      </div>
      <div className="service-support-heading mt-20"><div><p className="eyebrow text-rhododendron">Logistics & handling</p><h3>The services around the shipment.</h3></div><p>Preparation, storage, ground movement and final delivery—coordinated as connected parts of the route.</p></div>
      <div className="service-support-visual-grid">{supportServices.map(({icon:Icon,title,copy,href,image,alt},i)=><Link key={title} href={href} className="support-service-visual group"><Image src={image} alt={alt} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover"/><div className="support-service-shade"/><div className="support-service-copy"><div><span>0{i+4}</span><Icon size={22} strokeWidth={1.3}/></div><h3>{title}</h3><p>{copy}</p><ArrowRight size={17}/></div></Link>)}</div>
    </Container></section>

    <section className="company-profile-section">
      <Container className="company-profile-grid">
        <Reveal className="company-profile-year"><p>Established</p><strong>{company.founded}</strong><div className="company-origin-rule" aria-hidden="true"><i/><span/><i/></div></Reveal>
        <Reveal className="company-profile-copy" delay={.08}><p className="eyebrow text-gold">Kathmandu · Nepal</p><h2>Built in Kathmandu.<br/><em>Connected through trade gateways.</em></h2><p className="company-profile-lead">KCPL coordinates local, cross-border and international cargo through a practical network.</p><p className="company-profile-body">From branches in Nepal and India to personnel across Nepal&apos;s customs entry points and overseas counterparts, the focus stays on clear handovers and reliable coordination.</p><div className="company-profile-actions"><div className="company-tenure"><strong>{new Date().getFullYear() - company.founded}</strong><span>Years in logistics</span></div><ButtonLink href="/about">About KCPL</ButtonLink></div></Reveal>
      </Container>
    </section>

    <WhyKCPL/>

    <section className="network-story-section">
      <div className="network-story-contours" aria-hidden="true"/>
      <Container className="network-story-shell">
        <div className="network-story-heading">
          <Reveal><p className="eyebrow text-gold">Nepal to the world</p><h2>Nepal on the ground.<br/><em>The world within reach.</em></h2></Reveal>
          <Reveal className="network-story-intro" delay={.08}><strong>A connected logistics model, with every part clearly defined.</strong><p>KCPL&apos;s own regional locations support freight movement across Nepal and India. Customs-entry-point personnel assist at Nepal&apos;s trade gateways, while international counterparts extend coordination beyond the branch network.</p></Reveal>
        </div>

        <div className="network-layer-strip" aria-label="KCPL network structure">
          <Reveal className="network-layer"><span>01</span><div><small>Physical network</small><strong>Kathmandu head office + five confirmed branches</strong></div></Reveal>
          <Reveal className="network-layer" delay={.08}><span>02</span><div><small>Customs coverage</small><strong>Personnel across Nepal&apos;s entry points</strong></div></Reveal>
          <Reveal className="network-layer" delay={.16}><span>03</span><div><small>International reach</small><strong>Logistics counterparts in global markets</strong></div></Reveal>
        </div>

        <Reveal className="network-story-map"><NepalOperationsMap variant="home" locationLinkHref="/network#confirmed-locations"/></Reveal>

        <div className="network-story-footer">
          <Reveal className="network-counterpart-copy"><p className="eyebrow text-gold">Counterparts worldwide</p><h3>International coordination beyond KCPL&apos;s own branches.</h3><p>KCPL works with logistics counterparts in relevant origin and destination markets to coordinate cargo moving into Nepal and out to international destinations.</p></Reveal>
          <Link href="/network" className="network-explore-link"><span><small>Explore the network</small><strong>See KCPL&apos;s confirmed locations and operating model.</strong></span><i><ArrowRight size={22}/></i></Link>
        </div>
      </Container>
    </section>

    <SpecialistCargo/>

    <IndustryNetwork/>

    <section className="journey-editorial"><Container><div className="journey-editorial-heading"><Reveal><p className="eyebrow text-rhododendron">The shipment journey</p><h2>From enquiry<br/>to <em>destination.</em></h2></Reveal><Reveal className="journey-editorial-intro" delay={.08}><span>One connected process</span><p>Each stage establishes the information and handover needed for the next—keeping the movement clear from the first brief to destination.</p></Reveal></div><JourneyTimeline/></Container></section>

    <QuoteLaunch/>
  </main><Footer/></>;
}
