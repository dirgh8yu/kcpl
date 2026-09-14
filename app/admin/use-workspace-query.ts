"use client";

import { useCallback, useSyncExternalStore } from "react";

const changeEvent = "kcpl:workspace-query";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(changeEvent, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(changeEvent, notify); };
}
function snapshot() { return window.location.search; }
function serverSnapshot() { return ""; }

/** Shareable register state without a server request on every keystroke.
 * Preserves unrelated parameters and supports Back/Forward and blocked storage.
 */
export function useWorkspaceQuery() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const update = useCallback((values: Record<string, string | null>, history: "replace" | "push" = "replace") => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    // Next.js preserves its own history metadata with its native history integration.
    if (history === "push") window.history.pushState(null, "", next);
    else window.history.replaceState(null, "", next);
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return { params: new URLSearchParams(search), search, update };
}
