import type { Metadata } from "next";
import { NotFoundPage } from "../components/not-found-page";
import "../site.css";

// The layout's title template adds the site name.
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <NotFoundPage/>;
}
