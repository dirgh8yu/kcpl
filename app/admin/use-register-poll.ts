"use client";

import { useEffect, useRef, useState } from "react";
import type { ShipmentStatus } from "../shipment-types";
import type { CommandCentreData } from "./command-centre/command-centre-data";

/** Quiet live-polling architecture shared by the shipments register, the
 * Overview pulse widget and the Customs/Delivery pulse strips. All callers
 * read the same register-refresh endpoint — identical branch scoping, QA-mock
 * behaviour and limits on every surface. */

export const REGISTER_POLL_MS = 60_000;

export type RegisterStatusChange = { reference: string; from: ShipmentStatus; to: ShipmentStatus };

export type RegisterSnapshotResult = {
  /** Accepted snapshot (newer than anything applied so far). */
  snapshot: CommandCentreData;
  /** Status transitions this snapshot introduced, oldest first. */
  changes: RegisterStatusChange[];
};

/** A poll must never downgrade a complete snapshot to a partial one. */
export function mergeRegisterSnapshot(current: Pick<CommandCentreData, "partial">, incoming: CommandCentreData): CommandCentreData | null {
  if (!current.partial && incoming.partial) return null;
  return incoming;
}

/** Pure diff of one incoming snapshot against the previously known statuses. */
export function diffRegisterStatuses(
  known: ReadonlyMap<string, ShipmentStatus>,
  incoming: CommandCentreData,
): RegisterStatusChange[] {
  const changes: RegisterStatusChange[] = [];
  for (const job of incoming.jobs) {
    const before = known.get(job.reference);
    if (before && before !== job.status) changes.push({ reference: job.reference, from: before, to: job.status });
  }
  return changes;
}

export function toStatusMap(data: CommandCentreData): Map<string, ShipmentStatus> {
  return new Map(data.jobs.map((job) => [job.reference, job.status]));
}

/** Poll the register snapshot every 60s. Returns the newest accepted snapshot
 * plus the changes it introduced (only on the poll that introduced them).
 * Polls pause while the tab is hidden and re-run on visibility regain;
 * failures and stale responses never disturb the caller's view. */
export function useRegisterSnapshot(initialData: CommandCentreData): {
  data: CommandCentreData;
  changes: RegisterStatusChange[];
} {
  const [data, setData] = useState(initialData);
  const [changes, setChanges] = useState<RegisterStatusChange[]>([]);
  const appliedAtRef = useRef(Date.parse(initialData.generated_at) || 0);
  const knownStatusesRef = useRef(toStatusMap(initialData));
  const dataRef = useRef(initialData);

  // Re-adopt server props on client navigation, but only when newer.
  useEffect(() => {
    const generatedAt = Date.parse(initialData.generated_at) || 0;
    if (generatedAt > appliedAtRef.current) {
      appliedAtRef.current = generatedAt;
      knownStatusesRef.current = toStatusMap(initialData);
      dataRef.current = initialData;
      setData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    let disposed = false;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      // Report what this client last rendered; the server diffs against its
      // fresh authoritative snapshot and persists real transitions as
      // activity notifications (see /api/admin/shipments/queue).
      const known = Object.fromEntries(knownStatusesRef.current);
      fetch(`/api/admin/shipments/queue?known=${encodeURIComponent(JSON.stringify(known))}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const result = await response.json() as { ok?: boolean; data?: CommandCentreData };
          if (disposed || !result.ok || !result.data) return;
          const incoming = result.data;
          const generatedAt = Date.parse(incoming.generated_at) || 0;
          if (generatedAt <= appliedAtRef.current) return;
          const merged = mergeRegisterSnapshot(dataRef.current, incoming);
          if (!merged) return;
          appliedAtRef.current = generatedAt;
          const nextChanges = diffRegisterStatuses(knownStatusesRef.current, merged);
          knownStatusesRef.current = toStatusMap(merged);
          dataRef.current = merged;
          setData(merged);
          setChanges(nextChanges);
        })
        .catch(() => { /* callers keep their last good snapshot */ });
    };
    const timer = window.setInterval(poll, REGISTER_POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  return { data, changes };
}

/** "Refreshed Xs ago" label derived off the applied snapshot timestamp. The
 * computation runs inside the tick effect (Date.now is impure) so render
 * stays pure. */
export function useFreshnessLabel(appliedAt: number): { label: string; stale: boolean } {
  const [freshness, setFreshness] = useState(() => ({ label: "Refreshed just now", stale: false }));
  useEffect(() => {
    const compute = () => {
      const seconds = Math.max(0, Math.round((Date.now() - appliedAt) / 1000));
      setFreshness({
        label: seconds < 5 ? "Refreshed just now" : seconds < 60 ? `Refreshed ${seconds}s ago` : `Refreshed ${Math.floor(seconds / 60)}m ago`,
        stale: seconds > 90,
      });
    };
    compute();
    const timer = window.setInterval(compute, REGISTER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [appliedAt]);
  return freshness;
}
