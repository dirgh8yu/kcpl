"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { sidebarRailCookie } from "./sidebar-rail";

type SidebarRail = { rail: boolean; setRail: (rail: boolean) => void };

const SidebarRailContext = createContext<SidebarRail>({ rail: false, setRail: () => undefined });

/** Held by the admin layout, which stays mounted between pages, so the
 * sidebar keeps its width while each page draws its own shell. */
export function SidebarRailProvider({ initialRail, children }: { initialRail: boolean; children: React.ReactNode }) {
  const [rail, setRailState] = useState(initialRail);
  const setRail = useCallback((next: boolean) => {
    setRailState(next);
    try { document.cookie = sidebarRailCookie(next, window.location.protocol === "https:"); } catch { /* cookies blocked: the choice lasts this visit */ }
  }, []);
  const value = useMemo(() => ({ rail, setRail }), [rail, setRail]);
  return <SidebarRailContext.Provider value={value}>{children}</SidebarRailContext.Provider>;
}

export function useSidebarRail() {
  return useContext(SidebarRailContext);
}
