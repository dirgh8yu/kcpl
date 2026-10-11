import { ToolsIndexPage } from "../../components/tool-pages";
import { createPageMetadata } from "../../seo";
import { tools } from "../../tool-data";
import "../../site.css";

export const metadata = createPageMetadata({ title: tools.hi.index.title, description: tools.hi.index.description, path: "/hi/tools" });

export default function Page() {
  return <ToolsIndexPage locale="hi"/>;
}
