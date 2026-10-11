import { ToolsIndexPage } from "../../components/tool-pages";
import { createPageMetadata } from "../../seo";
import { tools } from "../../tool-data";
import "../../site.css";

export const metadata = createPageMetadata({ title: tools.zh.index.title, description: tools.zh.index.description, path: "/zh/tools" });

export default function Page() {
  return <ToolsIndexPage locale="zh"/>;
}
