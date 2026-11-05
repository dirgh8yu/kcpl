import { AgentsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "agents.meta_title"), description: siteText("ne", "agents.meta_description"), path: "/ne/agents" });

export default function Page() { return <AgentsPage locale="ne"/>; }
