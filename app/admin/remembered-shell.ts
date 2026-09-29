"use client";

import { useSyncExternalStore } from "react";

// The loading state between two staff pages draws the real sidebar and top
// bar from what the last page's shell remembered, so only the page body shows
// placeholders. Session storage only: it is cleared with the tab, holds no
// data beyond what the sidebar already shows, and a blocked store simply
// falls back to the placeholder chrome.

export type RememberedShell = {
  userName: string;
  canViewCommercial: boolean;
  canManageJobFile: boolean;
  canManageFinance: boolean;
  canManageStaff: boolean;
  isManagement: boolean;
};

const key = "kcpl:shell";
let cachedRaw: string | null = null;
let cachedValue: RememberedShell | null = null;

export function rememberShell(value: RememberedShell) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: loading falls back to placeholders */ }
}

function read(): RememberedShell | null {
  let raw: string | null = null;
  try { raw = window.sessionStorage.getItem(key); } catch { return null; }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<RememberedShell> : null;
    cachedValue = parsed && typeof parsed.userName === "string" ? {
      userName: parsed.userName,
      canViewCommercial: parsed.canViewCommercial === true,
      canManageJobFile: parsed.canManageJobFile === true,
      canManageFinance: parsed.canManageFinance === true,
      canManageStaff: parsed.canManageStaff === true,
      isManagement: parsed.isManagement === true,
    } : null;
  } catch { cachedValue = null; }
  return cachedValue;
}

const subscribe = () => () => undefined;

export function useRememberedShell() {
  return useSyncExternalStore(subscribe, read, () => null);
}
