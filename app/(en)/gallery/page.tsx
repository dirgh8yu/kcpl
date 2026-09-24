import { GalleryPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({ title: siteText("en", "gallery.meta_title"), description: siteText("en", "gallery.meta_description"), path: "/gallery" });

export default function Page() { return <GalleryPage locale="en" />; }
