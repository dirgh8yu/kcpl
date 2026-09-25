"use client";

import { useState } from "react";
import { OpsButton, OpsNotice } from "../../operations-ui";

/** Accounts: look at the customer's statement of account, then email it to
 * the customer's portal owners as a PDF. The same statement the customer can
 * download from the portal and the KCPL app. */
export function CrmStatementPanel({ customerId }: { customerId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const url = `/api/admin/crm/customers/${encodeURIComponent(customerId)}/statement`;

  async function send() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, { method: "POST" });
      const body = await response.json() as { ok?: boolean; error?: string; recipients?: string[] };
      if (!response.ok || !body.ok) throw new Error(body.error || "The statement could not be sent.");
      setMessage({ tone: "success", text: `Sent to ${(body.recipients ?? []).join(", ")}.` });
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "The statement could not be sent." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">
        What is owed, how overdue, and payments received in the last twelve months, per currency. Sent to the customer&apos;s portal owners.
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="ops-button" data-variant="secondary" data-size="md" href={url} target="_blank" rel="noreferrer">View statement (PDF)</a>
        <OpsButton variant="primary" disabled={busy} onClick={send}>{busy ? "Sending…" : "Email to customer"}</OpsButton>
      </div>
      {message ? <OpsNotice tone={message.tone}>{message.text}</OpsNotice> : null}
    </div>
  );
}
