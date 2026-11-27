import { LanesIndexPage } from "../../components/lane-pages";
import { laneIndex } from "../../lane-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: laneIndex.hi.title, description: laneIndex.hi.description, path: "/hi/lanes" });

export default function Page() { return <LanesIndexPage locale="hi"/>; }
