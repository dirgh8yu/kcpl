"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { OpsJumpMenu } from "../operations-ui";
import type { CrmCustomerSummary } from "./crm-data";

/**
 * Opens a Customer 360 straight from the Customers header. It used to be a
 * full-width native select band above the page; it is now a quiet header
 * control with a filterable list, and choosing a customer navigates as before.
 */
export function CrmCustomerJump({ customers }: { customers: CrmCustomerSummary[] }) {
  const router = useRouter();
  if (!customers.length) return null;
  return <OpsJumpMenu
    label="Customer 360"
    placeholder="Find a customer…"
    icon={<ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true"/>}
    options={customers.map((customer) => ({ value: customer.id, label: customer.display_name, detail: customer.primary_branch }))}
    onSelect={(customerId) => router.push(`/admin/crm/${encodeURIComponent(customerId)}`)}
  />;
}
