import { notFound } from "next/navigation";
import { ServiceDetailPage, services, type ServiceSlug } from "../../../components/services-page";
import { createPageMetadata } from "../../../seo";
import { siteText, type SiteTextKey } from "../../../site-i18n";
import "../../../site.css";

export function generateStaticParams() {
  return services.map((service) => ({ service: service.slug }));
}

function entry(slug: string) {
  return services.find((service) => service.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const found = entry(service);
  if (!found) return {};
  return createPageMetadata({
    title: siteText("hi", `svc.${found.key}.title` as SiteTextKey),
    description: siteText("hi", `svc.${found.key}.summary` as SiteTextKey),
    path: `/hi/services/${found.slug}`,
  });
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  if (!entry(service)) notFound();
  return <ServiceDetailPage locale="hi" slug={service as ServiceSlug}/>;
}
