"use client";

import { useEffect, useState } from "react";

// Radix portals default to document.body, which is outside `.kcpl-admin-route`
// where the `--admin-*` design tokens are scoped. Portaling into the admin
// content root keeps those tokens (and legacy `.kcpl-admin-content` styles) in
// scope so overlays render with the correct surface, borders and text colours.
// Shared by every workspace that opens an OpsDialog-based inspector panel.
export function useAdminPortalContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Deliberate: the portal target only exists in the DOM post-mount, and is
    // unavailable during SSR, so it can't be read in a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer(document.getElementById("workspace-content"));
  }, []);
  return container;
}
