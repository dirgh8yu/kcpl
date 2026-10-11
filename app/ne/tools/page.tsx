import { ToolsIndexPage } from "../../components/tool-pages";
import { createPageMetadata } from "../../seo";
import { tools } from "../../tool-data";
import "../../site.css";

export const metadata = createPageMetadata({ title: tools.ne.index.title, description: tools.ne.index.description, path: "/ne/tools" });

export default function Page() {
  return <ToolsIndexPage locale="ne"/>;
}
