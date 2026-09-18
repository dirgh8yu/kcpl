"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

// Public chrome needs an error boundary of its own: without one, any render failure in a
// public route drops to Next's unstyled default screen instead of KCPL's recoverable state.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("KCPL public route failed to render", error);
  }, [error]);

  return <><Header/><main className="not-found-page"><div className="not-found-grid" aria-hidden="true"/><Container className="not-found-shell"><div className="not-found-code" aria-hidden="true">!</div><div className="not-found-copy"><p className="eyebrow text-gold">Something went wrong</p><h1>This page could not be loaded.</h1><p>The request failed before the page finished rendering. Try again, return to the homepage, or contact the KCPL team about a shipment — tracking and enquiry links keep working.</p><div><button type="button" onClick={reset} className="not-found-primary"><AlertTriangle size={17}/> Try again</button><a href="/contact" className="not-found-secondary">Contact KCPL</a></div></div><div className="not-found-route" aria-hidden="true"><i/><span/><i/></div></Container></main><Footer/></>;
}
