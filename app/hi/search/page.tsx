import { SearchPage } from "../../components/search-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = {
  ...createPageMetadata({ title: siteText("hi", "search.meta_title"), description: siteText("hi", "search.meta_description"), path: "/hi/search" }),
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const value = (await searchParams).q;
  return <SearchPage locale="hi" query={Array.isArray(value) ? value[0] : value}/>;
}
