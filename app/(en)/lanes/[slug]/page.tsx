import { notFound } from "next/navigation";
import { LanePage } from "../../../components/lane-pages";
import { laneFor, laneSlugs, type LaneSlug } from "../../../lane-data";
import { createPageMetadata } from "../../../seo";
import "../../../site.css";

export function generateStaticParams() { return laneSlugs.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!laneSlugs.includes(slug as LaneSlug)) return {};
  const lane = laneFor("en", slug as LaneSlug);
  return createPageMetadata({ title: lane.title, description: lane.description, path: `/lanes/${slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!laneSlugs.includes(slug as LaneSlug)) notFound();
  return <LanePage locale="en" slug={slug as LaneSlug}/>;
}
