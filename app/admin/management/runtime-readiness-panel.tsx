"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ProductionRuntimeReadiness, ProductionReadinessStatus } from "../../production-readiness";
import { OpsBadge, OpsButton, OpsEmptyState, OpsSurface } from "../operations-ui";

type ReadinessResponse = {
  ok?: boolean;
  readiness?: ProductionRuntimeReadiness;
  error?: string;
};

function tone(status: ProductionReadinessStatus): "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "warning") return "warning";
  return "danger";
}

function StatusIcon({ status }: { status: ProductionReadinessStatus }) {
  if (status === "ready") return <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>;
  if (status === "warning") return <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>;
  return <ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true"/>;
}

async function requestReadiness() {
  const response = await fetch("/api/admin/readiness", { cache: "no-store" });
  const data = await response.json() as ReadinessResponse;
  if (!response.ok || !data.readiness) throw new Error(data.error || "Runtime readiness could not be loaded.");
  return data.readiness;
}

export function RuntimeReadinessPanel() {
  const [readiness, setReadiness] = useState<ProductionRuntimeReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReadiness(await requestReadiness());
    } catch (loadError) {
      setReadiness(null);
      setError(loadError instanceof Error ? loadError.message : "Runtime readiness could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestReadiness()
      .then((next) => {
        if (!active) return;
        setReadiness(next);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setReadiness(null);
        setError(loadError instanceof Error ? loadError.message : "Runtime readiness could not be loaded.");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <OpsSurface
      density="compact"
      title="Runtime readiness"
      description="Live configuration checks for the services KCPL Operations depends on. Reports configuration state only; never exposes credentials or secret values."
      action={<OpsButton variant="ghost" size="xs" onClick={() => void load()} disabled={loading}><RefreshCw size={14} strokeWidth={1.75} className={loading ? "animate-spin" : undefined} aria-hidden="true"/>{loading ? "Checking" : "Refresh"}</OpsButton>}
    >
      {loading && !readiness ? <p className="org-empty">Checking the production runtime…</p> : error ? <OpsEmptyState compact icon={<ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Readiness check unavailable" description={error}/> : readiness ? <>
        <div className="readiness-summary">
          <OpsBadge tone={tone(readiness.overall)}>{readiness.overall === "ready" ? "Production ready" : readiness.overall === "warning" ? "Ready with warnings" : "Production blocked"}</OpsBadge>
          <span>{readiness.summary.ready} ready · {readiness.summary.warnings} warnings · {readiness.summary.blocked} blocked</span>
        </div>
        <ul className="readiness-checks">
          {readiness.checks.map((item) => <li key={item.id} data-status={item.status}>
            <StatusIcon status={item.status}/>
            <strong>{item.label}<span className="readiness-state">{item.status === "ready" ? "Ready" : item.status === "warning" ? "Warning" : "Blocked"}</span></strong>
            <p>{item.detail}</p>
          </li>)}
        </ul>
      </> : null}
    </OpsSurface>
  );
}
