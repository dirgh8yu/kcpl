"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { OpsFileDrop } from "../../../admin/ops-file-drop";
import { PARTNER_BILL_CURRENCIES } from "../../partner-bills";
import type { PartnerBillRow } from "../../partner-bills.server";

function day(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

/** The partner's invoices to KCPL for this shipment, and sending a new one. */
export function PartnerBills({ reference, bills, today }: { reference: string; bills: PartnerBillRow[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(bills.length === 0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setNotice({ text: "Attach the invoice (PDF or a photo).", tone: "danger" }); return; }
    const form = new FormData(event.currentTarget);
    form.set("file", file);
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/partner/shipments/${encodeURIComponent(reference)}/bills`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "The invoice couldn’t be sent.");
      setNotice({ text: "Invoice sent. KCPL’s Accounts check it against the shipment before paying.", tone: "success" });
      setFile(null); setOpen(false); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The invoice couldn’t be sent.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  return <OpsSurface
    title="Your invoices"
    description="Send your invoice for this shipment here, instead of by email. You can follow it until it is paid."
    action={bills.length ? <OpsButton variant="secondary" size="xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Close" : "Send an invoice"}</OpsButton> : undefined}
  >
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    {open ? <form onSubmit={submit} className="portal-form" aria-busy={busy}>
      <div className="portal-form-grid">
        <OpsField label="Invoice number"><input name="invoiceNumber" required maxLength={80} spellCheck={false}/></OpsField>
        <OpsField label="Invoice date"><input type="date" name="invoiceDate" required max={today} defaultValue={today}/></OpsField>
        <OpsField label="Currency"><select name="currency" defaultValue="USD">{PARTNER_BILL_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
        <OpsField label="Amount before VAT"><input name="amount" required inputMode="decimal"/></OpsField>
        <OpsField label="VAT"><select name="vatRate" defaultValue="0"><option value="0">None</option><option value="13">13% (Nepal VAT invoice)</option></select></OpsField>
        <OpsField label="What it is for" hint="Optional"><input name="description" maxLength={200} placeholder="Ocean freight, handling, trucking…"/></OpsField>
      </div>
      <OpsFileDrop prompt="Choose the invoice" hint="PDF or a photo, up to 15 MB" accept="application/pdf,image/jpeg,image/png,image/webp" chosen={file?.name ?? null} onFiles={(files) => setFile(files[0] ?? null)}/>
      <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><Receipt size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Sending…" : "Send invoice"}</OpsButton></div>
    </form> : null}
    {bills.length ? <ul className="portal-container-list">{bills.map((bill) => <li key={bill.reference}>
      <div className="min-w-0"><strong><OpsMono>{bill.invoice_number}</OpsMono> · {money(bill.total, bill.currency)}</strong><span>Dated {day(bill.invoice_date)}{bill.status === "partially_paid" ? ` · ${money(bill.amount_paid, bill.currency)} paid` : ""}</span></div>
      <OpsBadge tone={bill.status === "paid" ? "success" : bill.status === "void" ? "danger" : bill.status === "draft" ? "info" : "neutral"}>{bill.status_label}</OpsBadge>
    </li>)}</ul> : null}
  </OpsSurface>;
}
