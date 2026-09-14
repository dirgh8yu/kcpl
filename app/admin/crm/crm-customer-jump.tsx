"use client";

import { useRouter } from "next/navigation";
import type { CrmCustomerSummary } from "./crm-data";

export function CrmCustomerJump({ customers }: { customers: CrmCustomerSummary[] }) {
  const router = useRouter();
  if (!customers.length) return null;

  return (
    <div className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-2.5 sm:px-6 lg:px-7">
      <div className="mx-auto flex max-w-[1152px] flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[length:var(--app-label-size)] font-semibold uppercase tracking-[.06em] text-[var(--admin-muted)]">Customer workspace</span>
          <span className="ml-2 text-[12px] font-semibold text-[var(--admin-ink)]">Open Customer 360</span>
        </div>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/admin/crm/${encodeURIComponent(event.target.value)}`);
          }}
          className="h-8 min-w-[240px] rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white px-3 text-[12px] font-medium text-[var(--admin-ink)] outline-none focus:border-[#9a9a9a] focus:ring-2 focus:ring-black/[.06]"
          aria-label="Open a Customer 360 workspace"
        >
          <option value="">Choose customer…</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name} · {customer.primary_branch}</option>)}
        </select>
      </div>
    </div>
  );
}
