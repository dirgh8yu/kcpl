import { ToolsIndexPage } from "../../components/tool-pages";
import { createPageMetadata } from "../../seo";
import { tools } from "../../tool-data";
import "../../site.css";

export const metadata = createPageMetadata({ title: tools.en.index.title, description: tools.en.index.description, path: "/tools" });

export default function Page() {
  return <ToolsIndexPage locale="en"/>;
}
