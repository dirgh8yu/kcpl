"use client";

import { useRouter } from "next/navigation";
import type { CrmCustomerSummary } from "./crm-data";

export function CrmCustomerJump({ customers }: { customers: CrmCustomerSummary[] }) {
  const router = useRouter();
  if (!customers.length) return null;

  return (
    <div className="border-b border-black/10 bg-[#e9e4d8] px-5 py-2.5 text-[#10263f] lg:px-8">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.16em] text-black/40">Operational workspace</span>
          <span className="ml-2 text-xs font-bold">Open Customer 360</span>
        </div>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/admin/crm/${encodeURIComponent(event.target.value)}`);
          }}
          className="min-h-9 min-w-[240px] rounded-xl border border-black/10 bg-white px-3 text-xs font-bold outline-none focus:border-[#b78a3e]"
          aria-label="Open a Customer 360 workspace"
        >
          <option value="">Choose customer / partner…</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name} · {customer.primary_branch}</option>)}
        </select>
      </div>
    </div>
  );
}
