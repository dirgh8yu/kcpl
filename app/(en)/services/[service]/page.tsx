import { notFound } from "next/navigation";
import { ServiceDetailPage, services } from "../../../components/services-page";
import { createPageMetadata } from "../../../seo";
import { siteText, type SiteTextKey } from "../../../site-i18n";
import "../../../site.css";

// Search wording, used for both the title tag and the H1; menus keep the short names.
const searchTitles = {
  air: "Air freight to and from Nepal",
  ocean: "Ocean freight to and from Nepal",
  road: "Road freight in Nepal",
  customs: "Customs clearance in Nepal",
  project: "Project cargo in Nepal",
  warehouse: "Cargo warehousing in Nepal",
  delivery: "Cargo delivery in Nepal",
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
  const found = entry(service);
  if (!found) notFound();
  return <ServiceDetailPage locale="en" slug={found.slug} heading={searchTitles[found.key]}/>;
}
