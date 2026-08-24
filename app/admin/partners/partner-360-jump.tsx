"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { OpsButton } from "../operations-ui";

export function Partner360Jump({ partners, canReconcile = false }: { partners: Array<{ id: string; display_name: string }>; canReconcile?: boolean }) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  if (!partners.length && !canReconcile) return null;

  return <div className="border-b border-[#e2e2e2] bg-[#f7f7f7]">
    <div className="ops-content-wide flex min-h-[54px] flex-wrap items-center gap-2 py-2">
      {partners.length ? <><span className="flex items-center gap-2 text-[11px] font-medium text-[#5b5b5b]"><Search size={12} className="text-[#dc143c]"/>Open Partner 360</span>
      <select className="ops-select min-w-[240px] flex-1" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} aria-label="Choose Partner 360 record">
        <option value="">Choose a partner…</option>
        {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.id}</option>)}
      </select>
      <OpsButton variant="secondary" size="sm" disabled={!partnerId} onClick={() => partnerId && router.push(`/admin/partners/${encodeURIComponent(partnerId)}`)}>Open <ArrowRight size={11}/></OpsButton></> : <span className="flex-1 text-[11px] text-[#737373]">No Partner records are available in your current scope.</span>}
      {canReconcile ? <Link href="/admin/partners/reconciliation" className="ops-button" data-variant="secondary" data-size="sm">Reconcile supplier bills</Link> : null}
    </div>
  </div>;
}
