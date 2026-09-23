import Link from "next/link";
import { PublicShell } from "./components/public-shell";

export default function NotFound() {
  return <PublicShell title="This page is not available." intro="The address may be incorrect, or the page may no longer exist.">
    <Link href="/quote" className="text-base font-semibold underline">Request a freight quote</Link>
  </PublicShell>;
}
