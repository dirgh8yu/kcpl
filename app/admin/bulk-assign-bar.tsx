"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRoundCheck, X } from "lucide-react";
import { OpsButton, OpsNotice } from "./operations-ui";
import { StaffAssignmentPicker } from "./staff-assignment-picker";

type Result = { ok?: boolean; assigned?: string[]; failed?: { reference: string; error: string }[]; error?: string };

/** Shows once rows are ticked: give them all one owner, or clear the ticks. */
export function BulkAssignBar({ references, onClear }: { references: string[]; onClear: () => void }) {
  const router = useRouter();
  const [owner, setOwner] = useState({ uid: "", name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  async function assign() {
    if (!owner.uid) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/shipments/bulk-assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ references, assignedToUid: owner.uid }),
      });
      const data = await response.json().catch(() => ({})) as Result;
      const assigned = data.assigned?.length ?? 0;
      const failed = data.failed ?? [];
      if (!assigned && !failed.length) throw new Error(data.error || "The owners couldn’t be changed. Try again.");
      setNotice({
        tone: failed.length ? (assigned ? "warning" : "danger") : "success",
        text: `${assigned ? `${assigned} shipment${assigned === 1 ? "" : "s"} now owned by ${owner.name || owner.email}.` : ""}${failed.length ? ` Not changed: ${failed.map((item) => `${item.reference} (${item.error})`).join(", ")}.` : ""}`.trim(),
      });
      if (assigned) { onClear(); router.refresh(); }
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "The owners couldn’t be changed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!references.length) return notice ? <div className="ops-bulk-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null;
  return <div className="ops-bulk-bar" role="region" aria-label="Selected shipments">
    <strong>{references.length} selected</strong>
    <div className="ops-bulk-bar-picker"><StaffAssignmentPicker compact emptyLabel="Choose an owner…" value={owner} onChange={(value) => setOwner({ uid: value.uid ?? "", name: value.name, email: value.email, phone: value.phone })}/></div>
    <OpsButton variant="primary" size="sm" disabled={busy || !owner.uid} onClick={() => void assign()}><UserRoundCheck size={13} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Assigning…" : "Give them this owner"}</OpsButton>
    <OpsButton variant="ghost" size="sm" disabled={busy} onClick={onClear}><X size={13} strokeWidth={1.75} aria-hidden="true"/>Clear</OpsButton>
    {notice ? <div className="ops-bulk-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
  </div>;
}
