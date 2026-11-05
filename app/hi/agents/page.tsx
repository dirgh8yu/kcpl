import { AgentsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "agents.meta_title"), description: siteText("hi", "agents.meta_description"), path: "/hi/agents" });

export default function Page() { return <AgentsPage locale="hi"/>; }
