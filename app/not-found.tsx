import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

export default function NotFound() {
  return <><Header/><main className="not-found-page"><div className="not-found-grid" aria-hidden="true"/><Container className="not-found-shell"><div className="not-found-code" aria-hidden="true">404</div><div className="not-found-copy"><p className="eyebrow text-gold">Route not found</p><h1>This page has moved beyond the map.</h1><p>The address may be incorrect or the page may no longer be available. Return to KCPL&apos;s homepage or contact the team about a shipment.</p><div><Link href="/" className="not-found-primary"><ArrowLeft size={17}/> Return home</Link><Link href="/contact" className="not-found-secondary">Contact KCPL <ArrowUpRight size={17}/></Link></div></div><div className="not-found-route" aria-hidden="true"><i/><span/><i/></div></Container></main><Footer/></>;
}
