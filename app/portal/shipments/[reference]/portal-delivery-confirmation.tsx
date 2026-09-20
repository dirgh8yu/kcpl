"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { portalDateTime } from "../../portal-format";

export function PortalDeliveryConfirmation({
  reference,
  confirmedAt,
  confirmedBy,
  canConfirm,
}: {
  reference: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/portal/shipments/${encodeURIComponent(reference)}/confirm-delivery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receivedBy: form.get("receivedBy"), note: form.get("note") }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The confirmation could not be sent.");
      setNotice(data.message ?? "Thank you.");
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The confirmation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  if (confirmedAt) {
    return (
      <OpsSurface eyebrow="Receipt" title="You confirmed this cargo arrived" priority="success">
        <p className="portal-footnote">
          <CheckCircle2 size={14} aria-hidden="true"/> Confirmed {portalDateTime(confirmedAt)}
          {confirmedBy ? ` · received by ${confirmedBy}` : ""}. KCPL still completes its own proof-of-delivery checks before
          closing the file.
        </p>
      </OpsSurface>
    );
  }

  if (!canConfirm) return null;

  return (
    <OpsSurface
      eyebrow="Receipt"
      title="Has this cargo arrived?"
      description="Telling KCPL it landed helps the team close the file and chase anything that is missing."
      action={<OpsButton variant="primary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? "Cancel" : "Confirm receipt"}</OpsButton>}
    >
      {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

      {open ? (
        <form onSubmit={confirm} className="portal-form" aria-busy={busy}>
          <div className="portal-form-grid">
            <OpsField label="Who received it" hint="Optional. The name of the person at your site.">
              <input name="receivedBy" placeholder="Site storekeeper" disabled={busy}/>
            </OpsField>
          </div>
          <OpsField label="Anything KCPL should know" hint="Optional. Damage, shortages or delivery problems.">
            <textarea name="note" placeholder="Two cartons arrived open; photographs to follow." disabled={busy}/>
          </OpsField>
          <div className="portal-form-actions">
            <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
              <PackageCheck size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{busy ? "Sending…" : "Confirm it arrived"}</span>
            </OpsButton>
          </div>
        </form>
      ) : null}
    </OpsSurface>
  );
}
