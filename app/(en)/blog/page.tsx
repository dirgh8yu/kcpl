import { BlogIndexPage } from "../../components/blog-pages";
import { blogIndex } from "../../blog-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: blogIndex.metaTitle, description: blogIndex.description, path: "/blog" });

export default function Page() {
  return <BlogIndexPage/>;
}
