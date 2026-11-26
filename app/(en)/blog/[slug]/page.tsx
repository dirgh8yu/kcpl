import { notFound } from "next/navigation";
import { BlogPostPage } from "../../../components/blog-pages";
import { blogPost, blogSlugs } from "../../../blog-data";
import { createPageMetadata } from "../../../seo";
import "../../../site.css";

export function generateStaticParams() { return blogSlugs.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = blogPost((await params).slug);
  return post ? createPageMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}` }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const post = blogPost((await params).slug);
  if (!post) notFound();
  return <BlogPostPage post={post}/>;
}
