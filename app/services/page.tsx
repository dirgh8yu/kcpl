import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Container } from "../components/container";
import { PageShell } from "../components/page-shell";
import { freightServiceKeys, handlingServiceKeys, serviceContent, specialistServiceKeys } from "../service-content";

export default function ServicesPage() {
  return <PageShell eyebrow="Our services" title="Every shipment has a different way forward." intro="Freight forwarding, specialist cargo and supporting logistics coordinated around the cargo, route and required handovers.">
    <section className="services-route-section bg-offwhite">
      <Container>
        <div className="services-section-heading"><div><p className="eyebrow text-gold">Core freight forwarding</p><h2>Three modes. One connected route.</h2></div><p>Air, ocean and road freight are planned in relation to the stages before and after the main movement.</p></div>
        <div className="services-route-grid">
          {freightServiceKeys.map((key) => {
            const service = serviceContent[key];
            return <Link key={key} href={`/services/${key}`} className={`services-route-card services-route-${key}`}>
              <Image src={service.image} alt={service.imageAlt} fill sizes={key === "air-freight" ? "(max-width: 767px) 100vw, 54vw" : "(max-width: 767px) 100vw, 46vw"} className="object-cover" />
              <div className="services-route-shade" />
              <div className="services-route-copy"><span>{service.number}</span><p>{service.eyebrow}</p><h3>{service.title}</h3><ArrowUpRight size={20} strokeWidth={1.4} /></div>
            </Link>;
          })}
        </div>
      </Container>
    </section>

    <section className="services-specialist-section bg-ink text-white">
      <Container>
        <div className="services-specialist-layout">
          <figure><Image src="/images/services/specialist-cargo.jpg" alt="Representative oversized industrial equipment prepared for specialist cargo movement" fill sizes="(max-width: 1023px) 100vw, 52vw" className="object-cover" /><div /><figcaption>Representative specialist-cargo imagery</figcaption></figure>
          <div className="services-specialist-copy">
            <p className="eyebrow text-gold">Specialist cargo</p>
            <h2>Built for cargo outside the standard pattern.</h2>
            <p>Non-standard cargo calls for earlier route decisions, clearer handling requirements and close coordination between every transport stage.</p>
            <div className="services-specialist-links">{specialistServiceKeys.map((key) => { const service = serviceContent[key]; return <Link key={key} href={`/services/${key}`}><span>{service.number}</span><div><strong>{service.eyebrow}</strong><small>{service.intro}</small></div><ArrowRight size={17} /></Link>; })}</div>
          </div>
        </div>
      </Container>
    </section>

    <section className="services-handling-section bg-white">
      <Container>
        <div className="services-section-heading"><div><p className="eyebrow text-rhododendron">Logistics & handling</p><h2>The services around the shipment.</h2></div><p>Preparation, storage, ground movement, gateway coordination and delivery connected to the wider freight plan.</p></div>
        <div className="services-handling-grid">
          {handlingServiceKeys.map((key) => {
            const service = serviceContent[key];
            return <Link key={key} href={`/services/${key}`} className={`services-handling-card ${key === "customs-clearance" ? "is-customs" : ""}`}>
              {key !== "customs-clearance" && <Image src={service.image} alt={service.imageAlt} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" />}
              <div className="services-handling-shade" />
              <div className="services-handling-copy"><span>{service.number}</span><h3>{service.eyebrow}</h3><p>{service.intro}</p><ArrowUpRight size={18} strokeWidth={1.4} /></div>
            </Link>;
          })}
        </div>
      </Container>
    </section>
  </PageShell>;
}
