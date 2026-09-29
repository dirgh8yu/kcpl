"use client";

import { useCallback, useSyncExternalStore } from "react";
import { UserRound } from "lucide-react";

// "Assigned to me" on the work lists. The choice is remembered per list in
// this browser, so an operator who works only their own shipments opens every
// list already narrowed. Storage is a convenience: when it is blocked the
// toggle still works for the visit.

import { ownedBy, type CurrentStaff } from "./mine-filter-policy";

export { ownedBy, type CurrentStaff };

const changeEvent = "kcpl:mine-filter";
const memory = new Map<string, boolean>();

function storageKey(list: string) { return `kcpl:mine:${list}`; }

function read(list: string) {
  try {
    const stored = window.localStorage.getItem(storageKey(list));
    if (stored !== null) return stored === "1";
  } catch { /* blocked storage: fall back to this visit's choice */ }
  return memory.get(list) ?? false;
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener("storage", notify); };
}

export function useMineFilter(list: string): [boolean, (next: boolean) => void] {
  const mine = useSyncExternalStore(subscribe, () => read(list), () => false);
  const setMine = useCallback((next: boolean) => {
    memory.set(list, next);
    try { window.localStorage.setItem(storageKey(list), next ? "1" : "0"); } catch { /* kept in memory */ }
    window.dispatchEvent(new Event(changeEvent));
  }, [list]);
  return [mine, setMine];
}

export function MineToggle({ mine, onChange, count }: { mine: boolean; onChange: (next: boolean) => void; count?: number }) {
  return <button type="button" className="ops-filter-choice ops-mine-toggle" aria-pressed={mine} data-active={mine || undefined} onClick={() => onChange(!mine)}>
    <UserRound size={13} strokeWidth={1.75} aria-hidden="true"/>Assigned to me{typeof count === "number" ? <span className="ops-scope-count">{count}</span> : null}
  </button>;
}
