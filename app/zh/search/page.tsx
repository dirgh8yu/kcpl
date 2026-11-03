import { SearchPage } from "../../components/search-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = {
  ...createPageMetadata({ title: siteText("zh", "search.meta_title"), description: siteText("zh", "search.meta_description"), path: "/zh/search" }),
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const value = (await searchParams).q;
  return <SearchPage locale="zh" query={Array.isArray(value) ? value[0] ?? "" : value ?? ""}/>;
}
