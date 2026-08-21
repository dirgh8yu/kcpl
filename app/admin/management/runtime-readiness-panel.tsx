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
  if (status === "ready") return <CheckCircle2 size={14}/>;
  if (status === "warning") return <AlertTriangle size={14}/>;
  return <ShieldAlert size={14}/>;
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
    <div className="ops-content-wide pb-8">
      <OpsSurface
        eyebrow="Production control"
        title="Runtime readiness"
        description="Live configuration checks for the services KCPL Operations depends on. This view reports configuration state only and never exposes credentials or secret values."
        action={<OpsButton variant="ghost" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={12} className={loading ? "animate-spin" : ""}/>{loading ? "Checking" : "Refresh"}</OpsButton>}
      >
        {loading && !readiness ? <p className="text-[10px] text-[#81776f]">Checking the production runtime…</p> : error ? <OpsEmptyState icon={<ShieldAlert size={17}/>} title="Readiness check unavailable" description={error}/> : readiness ? <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <OpsBadge tone={tone(readiness.overall)} dot>{readiness.overall === "ready" ? "Production ready" : readiness.overall === "warning" ? "Ready with warnings" : "Production blocked"}</OpsBadge>
            <span className="text-[9px] font-semibold text-[#81776f]">{readiness.summary.ready} ready · {readiness.summary.warnings} warnings · {readiness.summary.blocked} blocked</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readiness.checks.map((item) => <div key={item.id} className="rounded-[12px] border border-[#e8e0d9] bg-[#fffdfa] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <strong className="flex items-center gap-2 text-[10px] text-[#514840]"><span className={item.status === "ready" ? "text-[#66806b]" : item.status === "warning" ? "text-[#9a682f]" : "text-[#b65355]"}><StatusIcon status={item.status}/></span>{item.label}</strong>
                <OpsBadge tone={tone(item.status)}>{item.status}</OpsBadge>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-[#81776f]">{item.detail}</p>
            </div>)}
          </div>
        </> : null}
      </OpsSurface>
    </div>
  );
}
