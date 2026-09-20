"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsNotice,
  OpsSurface,
} from "../../../admin/operations-ui";
import type { PortalRemittance } from "../../portal-remittance.server";
import { portalDate, portalFileSize } from "../../portal-format";

export function PortalRemittancePanel({
  reference,
  initialRemittances,
  currency,
}: {
  reference: string;
  initialRemittances: PortalRemittance[];
  currency: string;
}) {
  const router = useRouter();
  const [remittances, setRemittances] = useState(initialRemittances);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    if (!(form.get("file") instanceof File) || !(form.get("file") as File).size) {
      setError("Attach the bank receipt or payment advice.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/portal/invoices/${encodeURIComponent(reference)}/remittance`, {
        method: "POST",
        body: form,
      });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The remittance could not be sent.");
      setNotice(data.message ?? "Sent to KCPL accounts.");
      setOpen(false);

      const listing = await fetch(`/api/portal/invoices/${encodeURIComponent(reference)}/remittance`, { cache: "no-store" });
      const listed = await listing.json() as { ok?: boolean; remittances?: PortalRemittance[] };
      if (listed.ok && listed.remittances) setRemittances(listed.remittances);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The remittance could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsSurface
      eyebrow="Payment"
      title="Tell KCPL you have paid"
      description="Send the bank receipt or payment advice. Accounts match it against the bank before the invoice updates, so the balance here will not change immediately."
      action={<OpsButton variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? "Cancel" : "Send a receipt"}</OpsButton>}
    >
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

        {open ? (
          <form onSubmit={submit} className="portal-form" aria-busy={busy}>
            <div className="portal-form-grid">
              <OpsField label="Amount paid" hint="Optional, but it helps accounts match the payment.">
                <input name="amount" inputMode="decimal" placeholder="25000" disabled={busy}/>
              </OpsField>
              <OpsField label="Currency">
                <input name="currency" maxLength={3} defaultValue={currency} disabled={busy}/>
              </OpsField>
              <OpsField label="Date paid">
                <input name="paidOn" type="date" disabled={busy}/>
              </OpsField>
              <OpsField label="Receipt" hint="PDF, JPEG, PNG or WEBP, up to 10 MB.">
                <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy}/>
              </OpsField>
            </div>
            <OpsField label="Reference or note" hint="Optional. The bank reference, or which invoices this payment covers.">
              <textarea name="note" placeholder="NEFT ref 993201, covers this invoice and KCPL-I-20260812-004." disabled={busy}/>
            </OpsField>
            <div className="portal-form-actions">
              <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
                <Banknote size={14} strokeWidth={1.75} aria-hidden="true"/>
                <span>{busy ? "Sending…" : "Send to accounts"}</span>
              </OpsButton>
            </div>
          </form>
        ) : null}

        {remittances.length ? (
          <ul className="portal-document-list">
            {remittances.map((remittance) => (
              <li key={remittance.id}>
                <span className="portal-document-icon" aria-hidden="true"><Receipt size={15} strokeWidth={1.75}/></span>
                <span className="portal-document-main">
                  <strong>
                    {remittance.amount === null ? "Payment receipt" : `${remittance.currency ?? ""} ${remittance.amount}`}
                    {remittance.paid_on ? ` · paid ${portalDate(remittance.paid_on)}` : ""}
                  </strong>
                  <span>
                    {remittance.filename} · {portalFileSize(remittance.size_bytes)} · sent {portalDate(remittance.uploaded_at)}
                    {remittance.note ? ` · ${remittance.note}` : ""}
                  </span>
                </span>
                <OpsBadge tone={remittance.review_state === "acknowledged" ? "success" : "info"}>
                  {remittance.review_state === "acknowledged" ? "Acknowledged" : "With accounts"}
                </OpsBadge>
                <a
                  className="ops-button"
                  data-variant="secondary"
                  data-size="sm"
                  href={`/api/portal/invoices/${encodeURIComponent(reference)}/remittance/${encodeURIComponent(remittance.id)}`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <OpsEmptyState
            compact
            kind="neutral"
            icon={<Receipt size={18}/>}
            title="No payment receipts sent"
            description="If you have paid this invoice, sending the receipt helps KCPL match it quickly."
          />
        )}
      </div>
    </OpsSurface>
  );
}
