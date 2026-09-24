"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pin } from "lucide-react";
import { shipmentStatusLabels } from "../shipment-types";
import { useFreshnessLabel, useRegisterSnapshot } from "./use-register-poll";
import { OpsPopover } from "./operations-ui";
import type { CommandCentreData } from "./command-centre/command-centre-data";

type PulseRow = { key: string; label: string; value: number; tone: "info" | "warning" | "danger" | "neutral"; href: string };

/** Compact live shipments strip for the Customs and Delivery workspaces.
 * Reuses the register poll architecture verbatim (same endpoint, merge
 * guard, transition diff) so every operational surface shares one notion of
 * "now". Failures and hidden tabs keep the last server-rendered numbers.
 *
 * Metrics are pinnable per workspace; the pin set rides on the URL
 * (`?<urlParam>=key,key`) so a personalised strip survives reloads and is
 * shareable. Unpinning falls back to the first three rows, never to zero. */
export function RegisterPulseStrip({ initialData, rows, className, urlParam }: { initialData: CommandCentreData; rows: (data: CommandCentreData) => PulseRow[]; className?: string; urlParam: string }) {
  const { data, changes } = useRegisterSnapshot(initialData);
  const freshness = useFreshnessLabel(Date.parse(data.generated_at) || 0);
  const available = useMemo(() => rows(data), [data, rows]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const validKeys = useMemo(() => new Set(available.map((row) => row.key)), [available]);
  const readUrl = useCallback((): Set<string> => {
    const raw = new URLSearchParams(window.location.search).get(urlParam);
    if (!raw) return new Set();
    return new Set(raw.split(",").filter((key) => validKeys.has(key)));
  }, [urlParam, validKeys]);
  // Local mirror of the URL pin set: React owns the checkbox state, the URL
  // stays the persistence layer (replaceState — no history spam).
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(() => new Set());
  const readUrlRef = useRef(readUrl);
  useEffect(() => {
    readUrlRef.current = readUrl;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the URL persistence layer into state after mount/param change
    setPinnedKeys(readUrl());
  }, [readUrl]);

  const visibleRows = useMemo(() => available.filter((row) => pinnedKeys.has(row.key)), [available, pinnedKeys]);
  // No pins (or an emptied pin set) = the uncustomised strip: every metric.
  const configured = visibleRows.length ? visibleRows : available;
  const fallback = !visibleRows.length;

  const togglePin = useCallback((key: string) => {
    const current = new Set(readUrlRef.current());
    if (current.has(key)) current.delete(key);
    else current.add(key);
    const ordered = available.filter((row) => current.has(row.key)).map((row) => row.key);
    const url = new URL(window.location.href);
    if (ordered.length && ordered.length < available.length) url.searchParams.set(urlParam, ordered.join(","));
    else url.searchParams.delete(urlParam);
    window.history.replaceState(null, "", url.toString());
    setPinnedKeys(new Set(ordered));
  }, [available, urlParam]);

  return (
    <section className={`register-pulse-strip ${className ?? ""}`} aria-label="Live shipment pulse">
      <div className="register-pulse-strip-cells">
        {configured.map((row) => (
          <Link key={row.key} href={row.href} className="register-pulse-cell" data-tone={row.tone} data-zero={row.value === 0 || undefined}>
            <span className="register-pulse-label">{row.label}</span>
            <span className="register-pulse-value">{row.value}</span>
          </Link>
        ))}
        <span className="register-pulse-freshness" data-stale={freshness.stale || undefined} title={`Snapshot ${data.generated_at}`}>{freshness.label}</span>
        <OpsPopover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
          <OpsPopover.Trigger asChild>
            <button type="button" className="register-pulse-configure" aria-label="Configure pinned metrics" aria-expanded={pickerOpen} title={fallback ? "Pin the metrics you want on this strip" : "Pinned — click to change"}>
              <Pin size={12} strokeWidth={1.75} aria-hidden="true" data-active={fallback ? undefined : "true"}/>
            </button>
          </OpsPopover.Trigger>
          <OpsPopover.Portal>
            <OpsPopover.Content sideOffset={6} align="end" className="register-pulse-picker" collisionPadding={12}>
              <p className="register-pulse-picker-head">Pinned metrics</p>
              {available.map((row) => {
                const active = fallback ? configured.some((item) => item.key === row.key) : pinnedKeys.has(row.key);
                return <label key={row.key} className="register-pulse-picker-row">
                  <input type="checkbox" checked={active} onChange={() => togglePin(row.key)}/>
                  <span>{row.label}</span>
                  {active ? <Check size={11} strokeWidth={2} aria-hidden="true"/> : null}
                </label>;
              })}
              <p className="register-pulse-picker-note">Pins are saved in this workspace’s page address, so they survive reloads and can be shared.</p>
            </OpsPopover.Content>
          </OpsPopover.Portal>
        </OpsPopover.Root>
      </div>
      {changes.length ? (
        <div className="register-pulse-changes" role="status" aria-live="polite">
          {changes.slice(0, 3).map((change) => (
            <Link key={`${change.reference}:${change.to}`} href={`/admin/shipments?status=${change.to}`} className="register-pulse-change">
              <span className="register-pulse-dot" aria-hidden="true"/>
              <span className="ops-mono">{change.reference}</span> → {shipmentStatusLabels[change.to]}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Row builders shared by both workspaces so the strip stays a one-liner.
 * `key` is the stable pin identifier. */
export function customsPulseRows(data: CommandCentreData): PulseRow[] {
  const active = data.jobs.filter((job) => job.status !== "delivered");
  return [
    { key: "in_transit", label: "In transit", value: active.filter((job) => job.status === "in_transit").length, tone: "info", href: "/admin/shipments?status=in_transit" },
    { key: "customs", label: "Customs", value: active.filter((job) => job.status === "customs_clearance").length, tone: "warning", href: "/admin/shipments?status=customs_clearance" },
    { key: "attention", label: "Attention", value: active.filter((job) => job.status === "exception").length, tone: "danger", href: "/admin/shipments?attention=1" },
    // No register-wide total here. The scope bar below already ends in "All
    // shipments", counting the customs scope, and the header says the same
    // number again -- a second, larger total beside them read as a
    // contradiction rather than as wider context.
  ];
}

export function deliveryPulseRows(data: CommandCentreData): PulseRow[] {
  const active = data.jobs.filter((job) => job.status !== "delivered");
  return [
    // Out for delivery is deliberately absent: it is the second cell of the
    // scope bar directly below, with the same count. This strip earns its space
    // by showing what the delivery queue does not.
    // in_transit is informational everywhere else (Overview pulse, customs strip), not neutral.
    { key: "in_transit", label: "In transit", value: active.filter((job) => job.status === "in_transit").length, tone: "info", href: "/admin/shipments?status=in_transit" },
    { key: "delivered", label: "Delivered today", value: data.jobs.filter((job) => job.status === "delivered").length, tone: "neutral", href: "/admin/shipments?status=delivered" },
    { key: "attention", label: "Attention", value: active.filter((job) => job.status === "exception").length, tone: "danger", href: "/admin/shipments?attention=1" },
  ];
}
