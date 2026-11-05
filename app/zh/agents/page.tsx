import { AgentsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "agents.meta_title"), description: siteText("zh", "agents.meta_description"), path: "/zh/agents" });

export default function Page() { return <AgentsPage locale="zh"/>; }
