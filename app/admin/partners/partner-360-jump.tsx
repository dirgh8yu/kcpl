"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { OpsJumpMenu } from "../operations-ui";

/**
 * Opens a Partner 360 record straight from the Partners header. It used to be
 * a full-width native select band above the page; it is now a quiet header
 * control with a filterable list, and choosing a partner navigates as before.
 */
export function Partner360Jump({ partners }: { partners: Array<{ id: string; display_name: string }> }) {
  const router = useRouter();
  if (!partners.length) return null;
  return <OpsJumpMenu
    label="Partner 360"
    placeholder="Find a partner…"
    icon={<ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true"/>}
    options={partners.map((partner) => ({ value: partner.id, label: partner.display_name, detail: partner.id }))}
    onSelect={(partnerId) => router.push(`/admin/partners/${encodeURIComponent(partnerId)}`)}
  />;
}
