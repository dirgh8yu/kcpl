import { GalleryPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({ title: siteText("ne", "gallery.meta_title"), description: siteText("ne", "gallery.meta_description"), path: "/ne/gallery" });

export default function Page() { return <GalleryPage locale="ne" />; }
