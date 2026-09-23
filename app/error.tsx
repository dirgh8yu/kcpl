"use client";

import { useEffect } from "react";
import { PublicShell } from "./components/public-shell";

// Public chrome needs an error boundary of its own: without one, any render failure in a
// public route drops to Next's unstyled default screen instead of KCPL's recoverable state.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("KCPL public route failed to render", error);
  }, [error]);

  return <PublicShell title="This page could not be loaded." intro="The request failed before the page finished rendering.">
    <button type="button" onClick={reset} className="text-base font-semibold underline">Try again</button>
  </PublicShell>;
}
