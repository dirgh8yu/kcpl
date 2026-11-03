import { SearchPage } from "../../components/search-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = {
  ...createPageMetadata({ title: siteText("ne", "search.meta_title"), description: siteText("ne", "search.meta_description"), path: "/ne/search" }),
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const value = (await searchParams).q;
  return <SearchPage locale="ne" query={Array.isArray(value) ? value[0] ?? "" : value ?? ""}/>;
}
