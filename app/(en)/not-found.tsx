import type { Metadata } from "next";
import { NotFoundPage } from "../components/not-found-page";
import "../site.css";

// The layout's title template adds the site name.
export const metadata: Metadata = { title: "Page not found", description: "This address does not match a page on the Kapileshwor Cargo site. The freight guides, services and quote form are one click away.", robots: { index: false, follow: true } };

export default function NotFound() {
  return <NotFoundPage/>;
}
