"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArrangementState, SavedLayout, WorkspaceKey } from "@/app/admin/operations-arrangeable";
import {
  isDefaultArrangementFor,
  moveSection,
  normalizeArrangementFor,
  normalizeSavedLayouts,
  serializeArrangement,
  serializeSavedLayouts,
  WORKSPACE_SECTIONS,
} from "@/app/admin/operations-arrangeable";

const SAVE_DEBOUNCE_MS = 900;
const LOCAL_STORAGE_PREFIX = "kcpl.admin.arrangement.";

export type StaffArrangementStatus = "idle" | "saving" | "saved" | "error";

export type StaffArrangementHook = {
  state: ArrangementState;
  status: StaffArrangementStatus;
  applyState: (next: ArrangementState) => void;
  toggleHidden: (id: string) => void;
  moveSectionToward: (id: string, direction: "up" | "down") => boolean;
  resetArrangement: () => void;
  loadError: boolean;
  saved: SavedLayout[];
  saveCurrentAs: (name: string) => SavedLayout | null;
  deleteSaved: (id: string) => void;
};

function initialFor(workspace: WorkspaceKey): ArrangementState {
  return { order: [...WORKSPACE_SECTIONS[workspace]], hidden: [] };
}

function readLocalCache(workspace: WorkspaceKey): ArrangementState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PREFIX + workspace);
    return raw ? normalizeArrangementFor(workspace, JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalCache(workspace: WorkspaceKey, state: ArrangementState) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_PREFIX + workspace, JSON.stringify({ order: state.order, hidden: state.hidden }));
  } catch {
    // Storage can be unavailable (private mode, quota); the server copy wins.
  }
}

export function useStaffArrangement(workspace: WorkspaceKey = "overview"): StaffArrangementHook {
  const [state, setState] = useState<ArrangementState>(() => initialFor(workspace));
  const [status, setStatus] = useState<StaffArrangementStatus>("idle");
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState<SavedLayout[]>(() => []);
  const savedRef = useRef<SavedLayout[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the server was last told (or the out-of-the-box default before the
  // first load). Every save decision compares against this, so "returning to a
  // previously-saved state" never fires a redundant PUT.
  const serverStateRef = useRef<string>(serializeArrangement(initialFor(workspace)));
  // The server copy is authoritative; the localStorage cache is only consulted
  // when the load fails (offline / API down) so a staff member keeps their
  // arrangement rather than snapping back to default.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/staff-layout?workspace=${workspace}`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as { order?: unknown; hidden?: unknown; saved?: unknown };
        if (!cancelled) {
          const loaded = normalizeArrangementFor(workspace, data);
          setState(loaded);
          serverStateRef.current = serializeArrangement(loaded);
          setSaved(normalizeSavedLayouts(workspace, data.saved));
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          const fallback = readLocalCache(workspace);
          if (fallback && !isDefaultArrangementFor(workspace, fallback)) setState(fallback);
          setLoadError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  // What the server was last told (or the out-of-the-box default before the
  // first load). Every save decision compares against this, so "returning to a
  // previously-saved state" never fires a redundant PUT.
  // Debounced server save whenever the state differs from what the server was
  // last told — including "back to default" (e.g. applying the Manager preset
  // over a custom layout). Local cache written in step so a failed save still
  // survives a reload on this device.
  useEffect(() => {
    if (serializeArrangement(state) === serverStateRef.current) return;
    writeLocalCache(workspace, state);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        setStatus("saving");
        try {
          const response = await fetch(`/api/admin/staff-layout?workspace=${workspace}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...JSON.parse(serializeArrangement(state)), saved: JSON.parse(serializeSavedLayouts(savedRef.current)) }),
          });
          if (response.ok) serverStateRef.current = serializeArrangement(state);
          setStatus(response.ok ? "saved" : "error");
        } catch {
          setStatus("error");
        }
      })();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, workspace]);

  const applyState = useCallback((next: ArrangementState) => {
    setState(normalizeArrangementFor(workspace, next));
  }, [workspace]);

  // Saving a layout persists immediately (not debounced): the action is an
  // explicit user decision and the name should not silently race a drag.
  const persistNow = useCallback(
    async (state: ArrangementState, saved: SavedLayout[]) => {
      setStatus("saving");
      try {
        const response = await fetch(`/api/admin/staff-layout?workspace=${workspace}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...JSON.parse(serializeArrangement(state)), saved: JSON.parse(serializeSavedLayouts(saved)) }),
        });
        if (response.ok) serverStateRef.current = serializeArrangement(state);
        setStatus(response.ok ? "saved" : "error");
        return response.ok;
      } catch {
        setStatus("error");
        return false;
      }
    },
    [workspace],
  );

  const saveCurrentAs = useCallback(
    (rawName: string): SavedLayout | null => {
      const name = rawName.trim().slice(0, 24);
      if (!name) return null;
      const entry: SavedLayout = {
        id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        order: [...state.order],
        hidden: [...state.hidden],
      };
      const next = [...savedRef.current.filter((layout) => layout.id !== entry.id), entry].slice(-6);
      savedRef.current = next;
      setSaved(next);
      void persistNow(state, next);
      return entry;
    },
    [persistNow, state],
  );

  const deleteSaved = useCallback(
    (id: string) => {
      const next = savedRef.current.filter((layout) => layout.id !== id);
      savedRef.current = next;
      setSaved(next);
      void persistNow(state, next);
    },
    [persistNow, state],
  );

  const toggleHidden = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      hidden: current.hidden.includes(id)
        ? current.hidden.filter((entry) => entry !== id)
        : [...current.hidden, id],
    }));
  }, []);

  const moveSectionToward = useCallback((id: string, direction: "up" | "down") => {
    let moved = false;
    setState((current) => {
      const index = current.order.indexOf(id);
      if (index === -1) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.order.length) return current;
      moved = true;
      return { ...current, order: moveSection(current.order, id, current.order[targetIndex]) };
    });
    return moved;
  }, []);

  const resetArrangement = useCallback(() => {
    const fresh = initialFor(workspace);
    setState(fresh);
    writeLocalCache(workspace, fresh);
    setStatus("saving");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/staff-layout?workspace=${workspace}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...JSON.parse(serializeArrangement(fresh)), saved: JSON.parse(serializeSavedLayouts(savedRef.current)) }),
        });
        if (response.ok) serverStateRef.current = serializeArrangement(fresh);
        setStatus(response.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    })();
  }, [workspace]);

  return { state, status, applyState, toggleHidden, moveSectionToward, resetArrangement, loadError, saved, saveCurrentAs, deleteSaved };
}
