import { LanesIndexPage } from "../../components/lane-pages";
import { laneIndex } from "../../lane-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: laneIndex.zh.title, description: laneIndex.zh.description, path: "/zh/lanes" });

export default function Page() { return <LanesIndexPage locale="zh"/>; }
