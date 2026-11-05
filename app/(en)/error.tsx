"use client";

import { useEffect } from "react";
import { PageHead } from "../components/route-parts";
import { SiteShell } from "../components/site-chrome";
import "../site.css";

// Public chrome needs an error boundary of its own: without one, any render failure in a
// public route drops to Next's unstyled default screen instead of KCPL's recoverable state.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("KCPL public route failed to render", error);
  }, [error]);

  return (
    <SiteShell locale="en" path="/">
      <PageHead title="This page could not be loaded." intro="The request failed before the page finished rendering.">
        <button type="button" onClick={reset} className="btn">Try again</button>
      </PageHead>
    </SiteShell>
  );
}
