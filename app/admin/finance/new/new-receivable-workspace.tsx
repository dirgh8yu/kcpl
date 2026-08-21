"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ReceiptText } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../../crm/crm-data";
import { OpsButton, OpsField, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";

function nepalToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function NewReceivableWorkspace() {
  const router = useRouter();
  const today = nepalToday();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ shipmentReference: "", customerId: "", issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "Freight and logistics services", amount: "", taxRate: "0", notes: "" });
  const shipmentMode = Boolean(form.shipmentReference.trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, shipmentReference: form.shipmentReference.trim().toUpperCase(), customerId: form.customerId.trim().toUpperCase(), amount: Number(form.amount), taxRate: Number(form.taxRate) }),
      });
      const data = await response.json() as { reference?: string; error?: string; resolutionPath?: string };
      if (!response.ok && data.resolutionPath) { router.push(data.resolutionPath); return; }
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invoice could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Quick create" title="New receivable" description="Create a customer invoice directly. Use either a shipment reference, which resolves its CRM customer automatically, or a KCPL customer reference for a general receivable." actions={<Link href="/admin/finance" className="ops-button" data-variant="secondary" data-size="md">Cancel</Link>}/>
    <div className="ops-content ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      <OpsSurface eyebrow="Customer invoice" title="Create invoice draft" description="Shipment-linked invoicing preserves the existing customer-linking guard and sends unresolved jobs to the dedicated resolution workflow.">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OpsField label="Shipment reference" hint="Optional. If entered, KCPL resolves the CRM customer from the shipment."><input value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value, customerId: event.target.value.trim() ? "" : form.customerId })} placeholder="KCPL-S-..."/></OpsField>
          <OpsField label={shipmentMode ? "Customer reference" : "Customer reference"} hint={shipmentMode ? "Resolved automatically from the shipment." : "Required when no shipment is entered. KCPL-C-..."}><input disabled={shipmentMode} value={shipmentMode ? "Resolved from shipment" : form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></OpsField>
          <OpsField label="Issue date"><input required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></OpsField>
          <OpsField label="Due date"><input type="date" min={form.issueDate || undefined} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField>
          <OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
          <OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField>
          <OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField>
          <OpsField label="Description"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></OpsField>
          <OpsField label="Invoice notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4"><OpsButton variant="primary" disabled={busy}><ReceiptText size={13}/>{busy ? "Creating…" : "Create invoice draft"}</OpsButton><Link href="/admin/finance" className="ops-button" data-variant="ghost" data-size="md">Cancel</Link></div>
        </form>
      </OpsSurface>
    </div>
  </OpsPage>;
}
