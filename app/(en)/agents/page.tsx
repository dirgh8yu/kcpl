import { AgentsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "agents.meta_title"), description: siteText("en", "agents.meta_description"), path: "/agents" });

export default function Page() { return <AgentsPage locale="en"/>; }
