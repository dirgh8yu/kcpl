"use client";

import { CheckCircle2, FileWarning, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { KcplDocumentCategory } from "./document-vault";
import type { ShipmentDocumentChecklist } from "./document-checklist";

type ApiResponse = {
  ok?: boolean;
  checklist?: ShipmentDocumentChecklist;
  error?: string;
};

export function DocumentChecklistEditor({
  initialChecklist,
  canManage,
}: {
  initialChecklist: ShipmentDocumentChecklist;
  canManage: boolean;
}) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [savingCategory, setSavingCategory] = useState<KcplDocumentCategory | null>(null);
  const [error, setError] = useState("");

  async function setRequired(category: KcplDocumentCategory, required: boolean) {
    setError("");
    setSavingCategory(category);
    try {
      const response = await fetch("/api/admin/documents/checklist", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipment: checklist.shipment_reference, category, required }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.checklist) throw new Error(data.error || "Checklist could not be updated.");
      setChecklist(data.checklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist could not be updated.");
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-[#b78a3e]"><ShieldCheck size={15}/><span className="text-[10px] font-black uppercase tracking-[.16em]">Shipment checklist</span></div>
          <h2 className="mt-2 text-xl font-black tracking-[-.025em] text-[#10263f]">{checklist.shipment_reference}</h2>
          <p className="mt-1 text-xs text-black/55">{checklist.customer_name || "Unlinked customer"} · {checklist.mode} · {checklist.branch}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${checklist.missing_count ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {checklist.missing_count ? `${checklist.missing_count} missing` : "Complete"}
          </span>
          <a href={`/admin/documents?shipment=${encodeURIComponent(checklist.shipment_reference)}`} className="rounded-xl bg-[#10263f] px-4 py-2 text-[10px] font-black uppercase tracking-[.08em] text-white">Upload document</a>
        </div>
      </div>

      <div className="grid gap-px border-b border-black/10 bg-black/10 sm:grid-cols-3">
        <Metric label="Required" value={String(checklist.required_count)}/>
        <Metric label="Present" value={String(checklist.present_required_count)}/>
        <Metric label="Completion" value={`${checklist.completion_percent}%`}/>
      </div>

      {error ? <p className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</p> : null}

      <div className="divide-y divide-black/5">
        {checklist.items.map((item) => {
          const saving = savingCategory === item.category;
          return (
            <div key={item.category} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_160px_170px] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {item.present ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600"/> : <FileWarning size={15} className={item.required ? "shrink-0 text-amber-600" : "shrink-0 text-black/30"}/>} 
                  <p className="truncate text-sm font-black text-[#1c344a]">{item.label}</p>
                  {item.overridden ? <span className="rounded-full bg-[#f2ede2] px-2 py-0.5 text-[8px] font-black uppercase tracking-[.08em] text-[#8a6c36]">Custom</span> : null}
                </div>
                <p className="mt-1 pl-[23px] text-[10px] text-black/45">{item.present ? `${item.document_count} current file${item.document_count === 1 ? "" : "s"} in Vault` : item.required ? "Required document is missing" : "Optional for this shipment"}</p>
              </div>
              <div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] ${item.present ? "border-emerald-200 bg-emerald-50 text-emerald-800" : item.required ? "border-amber-200 bg-amber-50 text-amber-800" : "border-black/10 bg-black/[.025] text-black/45"}`}>
                  {item.present ? "Present" : item.required ? "Missing" : "Optional"}
                </span>
              </div>
              <div className="flex justify-start md:justify-end">
                {canManage ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setRequired(item.category, !item.required)}
                    className="inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-[9px] font-black uppercase tracking-[.07em] text-[#30485e] hover:bg-black/[.025] disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin"/> : null}
                    {item.required ? "Mark not required" : "Make required"}
                  </button>
                ) : <span className="text-[9px] font-semibold text-black/35">Read only</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#fbfbfa] px-5 py-3"><p className="text-[9px] font-black uppercase tracking-[.1em] text-black/40">{label}</p><p className="mt-1 text-lg font-black tabular-nums text-[#10263f]">{value}</p></div>;
}
