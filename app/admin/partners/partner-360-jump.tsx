"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { OpsButton } from "../operations-ui";

export function Partner360Jump({ partners }: { partners: Array<{ id: string; display_name: string }> }) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  if (!partners.length) return null;

  return <div className="ops-content-wide pt-4">
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#e9e1da] bg-[#fffdfa] px-3 py-2.5 shadow-[0_8px_28px_rgba(81,61,47,.035)]">
      <span className="flex items-center gap-2 text-[10px] font-semibold text-[#746b64]"><Search size={12} className="text-[#a36a57]"/>Open Partner 360</span>
      <select className="ops-select min-w-[240px] flex-1" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} aria-label="Choose Partner 360 record">
        <option value="">Choose a partner…</option>
        {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.id}</option>)}
      </select>
      <OpsButton variant="secondary" size="sm" disabled={!partnerId} onClick={() => partnerId && router.push(`/admin/partners/${encodeURIComponent(partnerId)}`)}>Open <ArrowRight size={11}/></OpsButton>
    </div>
  </div>;
}
