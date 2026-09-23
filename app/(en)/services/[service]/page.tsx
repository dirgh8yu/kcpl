import { notFound } from "next/navigation";
import { ServiceDetailPage, services, type ServiceSlug } from "../../../components/services-page";
import { createPageMetadata } from "../../../seo";
import { siteText, type SiteTextKey } from "../../../site-i18n";
import "../../../site.css";

const searchTitles = {
  air: "Air Freight to and from Nepal",
  ocean: "Ocean Freight to and from Nepal",
  road: "Road Freight in Nepal",
  customs: "Customs Clearance in Nepal",
  project: "Project Cargo in Nepal",
  warehouse: "Cargo Warehousing in Nepal",
  delivery: "Cargo Delivery in Nepal",
} as const;

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
    title: searchTitles[found.key],
    description: siteText("en", `svc.${found.key}.summary` as SiteTextKey),
    path: `/services/${found.slug}`,
  });
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  if (!entry(service)) notFound();
  return <ServiceDetailPage locale="en" slug={service as ServiceSlug}/>;
}
