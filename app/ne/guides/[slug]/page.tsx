import { notFound } from "next/navigation";
import { FreightGuidePage } from "../../../components/freight-guide-page";
import { guides, guideSlugs, type GuideSlug } from "../../../guide-data";
import { createPageMetadata } from "../../../seo";
import "../../../site.css";

export function generateStaticParams() { return guideSlugs.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!guideSlugs.includes(slug as GuideSlug)) return {};
  const guide = guides.ne[slug as GuideSlug];
  return createPageMetadata({ title: guide.title, description: guide.description, path: `/ne/guides/${slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!guideSlugs.includes(slug as GuideSlug)) notFound();
  return <FreightGuidePage locale="ne" slug={slug as GuideSlug}/>;
}
