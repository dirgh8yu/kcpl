"use client";

import { useEffect, useRef } from "react";

/*
 * One refresh control for every workspace: the top bar's. It re-renders the
 * server page and announces this event, so a workspace that keeps its own
 * client-side data reloads it too. Pages used to carry a second Refresh
 * button of their own.
 */
export const WORKSPACE_REFRESH_EVENT = "kcpl:refresh-workspace";

export function announceWorkspaceRefresh() {
  window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
}

/** Runs [refresh] whenever the top bar's refresh is pressed. */
export function useWorkspaceRefresh(refresh: () => unknown) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const handler = () => { void latest.current(); };
    window.addEventListener(WORKSPACE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, handler);
  }, []);
}
