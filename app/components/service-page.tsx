import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ServiceContent } from "../service-content";
import { Container } from "./container";
import { PageShell } from "./page-shell";

export function ServicePage({ content, slug }: { content: ServiceContent; slug: string }) {
  const path = `/services/${slug}`;
  return <PageShell eyebrow={content.eyebrow} title={content.title} intro={content.intro} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: content.eyebrow, href: path }]}>
    <section className="service-detail-story bg-offwhite">
      <Container>
        <div className="service-detail-layout">
          <figure className="service-detail-visual">
            <Image src={content.image} alt={content.imageAlt} fill sizes="(max-width: 1023px) 100vw, 58vw" className="object-cover" />
            <div className="service-detail-shade" />
            <figcaption><span>{content.number}</span><div><strong>{content.eyebrow}</strong><small>Representative logistics imagery</small></div></figcaption>
          </figure>
          <div className="service-detail-overview">
            <p className="eyebrow text-gold">Service overview</p>
            <h2>{content.overviewTitle}</h2>
            <p>{content.description}</p>
            <Link href={`/quote?mode=${slug === "air-freight" ? "air" : slug === "sea-freight" ? "sea" : slug === "road-freight" || slug === "ground-transport" ? "road" : "unsure"}`} className="service-detail-quote" data-analytics-event="service_quote_click">Discuss this movement <ArrowUpRight size={18} strokeWidth={1.5} /></Link>
          </div>
        </div>
      </Container>
    </section>

    <section className="service-scope-section bg-ink text-white">
      <Container>
        <div className="service-scope-heading"><p className="eyebrow text-gold">What KCPL coordinates</p><h2>The operational pieces behind the service.</h2></div>
        <div className="service-scope-list">
          {content.points.map((point, index) => <article key={point.title}><span>0{index + 1}</span><div><h3>{point.title}</h3><p>{point.detail}</p></div></article>)}
        </div>
      </Container>
    </section>

    <section className="service-context-section bg-white">
      <Container>
        <div className="service-context-layout">
          <div><p className="eyebrow text-rhododendron">A connected route</p><h2>{content.contextTitle}</h2></div>
          <div><p>{content.contextCopy}</p><Link href="/quote" className="text-link mt-8">Request a quote <ArrowRight size={16} /></Link></div>
        </div>
        <div className="service-related"><span>Continue exploring</span>{content.related.map((item) => <Link key={item.href} href={item.href}>{item.title}<ArrowUpRight size={16} strokeWidth={1.5} /></Link>)}</div>
      </Container>
    </section>
  </PageShell>;
}
