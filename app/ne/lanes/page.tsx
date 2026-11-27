import { LanesIndexPage } from "../../components/lane-pages";
import { laneIndex } from "../../lane-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: laneIndex.ne.title, description: laneIndex.ne.description, path: "/ne/lanes" });

export default function Page() { return <LanesIndexPage locale="ne"/>; }
