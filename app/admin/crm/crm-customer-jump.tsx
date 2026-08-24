"use client";

import { useRouter } from "next/navigation";
import type { CrmCustomerSummary } from "./crm-data";

export function CrmCustomerJump({ customers }: { customers: CrmCustomerSummary[] }) {
  const router = useRouter();
  if (!customers.length) return null;

  return (
    <div className="border-b border-[#e2e2e2] bg-[#f6f6f3] px-4 py-2.5 sm:px-6 lg:px-7">
      <div className="mx-auto flex max-w-[1152px] flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#737373]">Customer workspace</span>
          <span className="ml-2 text-[12px] font-semibold text-[#141414]">Open Customer 360</span>
        </div>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/admin/crm/${encodeURIComponent(event.target.value)}`);
          }}
          className="h-8 min-w-[240px] rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-medium text-[#141414] outline-none focus:border-[#9a9a9a] focus:ring-2 focus:ring-black/[.06]"
          aria-label="Open a Customer 360 workspace"
        >
          <option value="">Choose customer…</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name} · {customer.primary_branch}</option>)}
        </select>
      </div>
    </div>
  );
}
