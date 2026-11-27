import { LanesIndexPage } from "../../components/lane-pages";
import { laneIndex } from "../../lane-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: laneIndex.en.title, description: laneIndex.en.description, path: "/lanes" });

export default function Page() { return <LanesIndexPage locale="en"/>; }
