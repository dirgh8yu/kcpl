import { notFound } from "next/navigation";
import { ToolPage } from "../../../components/tool-pages";
import { createPageMetadata } from "../../../seo";
import { tools, toolSlugs, type ToolSlug } from "../../../tool-data";
import "../../../site.css";

export function generateStaticParams() { return toolSlugs.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!toolSlugs.includes(slug as ToolSlug)) return {};
  const tool = tools.zh[slug as ToolSlug];
  return createPageMetadata({ title: tool.title, description: tool.description, path: `/zh/tools/${slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!toolSlugs.includes(slug as ToolSlug)) notFound();
  return <ToolPage locale="zh" slug={slug as ToolSlug}/>;
}
