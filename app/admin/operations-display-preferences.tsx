"use client";

import { useEffect } from "react";
import { type DisplayPreferences } from "./notifications/display-preferences";

type DisplayPreferencesEvent = CustomEvent<{ preferences: DisplayPreferences }>;

/** Client bootstrap for per-staff display preferences. Loads the stored choice
 * (or defaults on first use / any failure) and reflects it as data attributes
 * on the route root, where the stylesheet turns them into the compact and
 * reduced-motion token overrides. The server layout already renders the right
 * attributes on first paint; this covers hydration timing and keeps the choice
 * current when the account panel's Display tab saves. Renders nothing. */
export function OperationsDisplayPreferences() {
  useEffect(() => {
    const root = document.querySelector(".kcpl-admin-route");
    if (!root) return;

    const apply = (preferences: DisplayPreferences) => {
      root.setAttribute("data-density", preferences.density);
      root.setAttribute("data-motion", preferences.motion);
    };

    let cancelled = false;
    fetch("/api/admin/display-preferences", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ ok: true; preferences: DisplayPreferences }> : null)
      .then((data) => { if (!cancelled && data?.ok && data.preferences) apply(data.preferences); })
      .catch(() => { /* Defaults are already live; never block the shell on this. */ });

    const onSaved = (event: Event) => {
      const detail = (event as DisplayPreferencesEvent).detail;
      if (detail?.preferences) apply(detail.preferences);
    };
    window.addEventListener("kcpl:display-preferences-changed", onSaved);
    return () => { cancelled = true; window.removeEventListener("kcpl:display-preferences-changed", onSaved); };
  }, []);

  // Renders nothing — this component is a pure side-effect bootstrap.
  return null;
}
