"use client";
import { nepalOperationalDate } from "../../../../invoice-effective-status";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, UserCheck, UserPlus } from "lucide-react";
import { OpsButton, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";
import { crmCurrencies, type CrmCurrency } from "../../../crm/crm-data";
import type { FinanceCustomerSuggestion } from "../../finance-customer-resolution";

export function ShipmentInvoiceForm({
  shipmentReference,
  customerId,
  customerName,
  quoteReference,
  suggestions,
}: {
  shipmentReference: string;
  customerId: string | null;
  customerName: string | null;
  quoteReference: string | null;
  suggestions: FinanceCustomerSuggestion[];
}) {
  const router = useRouter();
  const today = nepalOperationalDate();
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "warning" | "danger" } | null>(null);
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [candidateCustomers, setCandidateCustomers] = useState(suggestions);
  const [form, setForm] = useState({
    issueDate: today,
    dueDate: "",
    currency: "NPR" as CrmCurrency,
    description: "Freight and Logistics",
    amount: "",
    taxRate: "0",
    notes: "",
  });

  async function confirmCustomer(targetCustomerId: string) {
    const target = targetCustomerId.trim().toUpperCase();
    if (!target) return;
    setLinkBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/finance/customer-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipmentReference, customerId: target, action: "confirm" }),
      });
      const data = await response.json() as { customerId?: string; error?: string };
      if (!response.ok || !data.customerId) throw new Error(data.error || "Customer could not be linked.");
      setNotice({ text: "Customer record confirmed. Reloading the invoice workspace…", tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Customer could not be linked.", tone: "danger" });
    } finally {
      setLinkBusy(false);
    }
  }

  async function createCustomerFromQuote() {
    setLinkBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/finance/customer-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipmentReference, action: "create_from_quote" }),
      });
      const data = await response.json() as {
        customerId?: string;
        customerName?: string;
        error?: string;
        code?: string;
        suggestions?: FinanceCustomerSuggestion[];
      };
      if (response.status === 409 && data.code === "possible_duplicate" && data.suggestions?.length) {
        setCandidateCustomers(data.suggestions);
        throw new Error("A similar customer record already exists. Confirm the correct existing customer below instead of creating a duplicate.");
      }
      if (!response.ok || !data.customerId) throw new Error(data.error || "Customer record could not be created.");
      setNotice({ text: `Customer record ${data.customerName || data.customerId} created and linked. Reloading…`, tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Customer record could not be created.", tone: "danger" });
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) {
      setNotice({ text: "Confirm or create the customer record before creating the invoice.", tone: "warning" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId,
          shipmentReference,
          amount: Number(form.amount),
          taxRate: Number(form.taxRate),
        }),
      });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Invoice could not be created.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Invoice"
      title="New invoice"
      description={<>For shipment <OpsMono>{shipmentReference}</OpsMono>{quoteReference ? <> · quote <OpsMono>{quoteReference}</OpsMono></> : null}</>}
      actions={<Link href={`/admin/jobs/${encodeURIComponent(shipmentReference)}`} className="ops-button" data-variant="secondary" data-size="md">Open Job File</Link>}
    />
    <div className="ops-content ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      {customerId ? <OpsNotice tone="success"><strong>Customer confirmed:</strong> {customerName || customerId} <OpsMono>{customerId}</OpsMono></OpsNotice> : <OpsSurface priority="warning" eyebrow="Before invoicing" title="Confirm who this shipment belongs to" description="Finance links the quote and shipment to the customer you confirm. A new customer can be created straight from the quote.">
        {candidateCustomers.length ? <div className="grid gap-3 md:grid-cols-2">{candidateCustomers.map((item) => <div key={item.id} className="ops-inset-group grid gap-2">
          <strong className="text-[var(--admin-ink)]">{item.display_name}</strong>
          <p className="m-0 text-[length:var(--app-text-sm)] text-[var(--admin-muted)]"><OpsMono>{item.id}</OpsMono> · matched by {item.reason}</p>
          <div><OpsButton variant="primary" disabled={linkBusy} onClick={() => confirmCustomer(item.id)}><UserCheck size={14} strokeWidth={1.75} aria-hidden="true"/>{linkBusy ? "Linking…" : "Confirm this customer"}</OpsButton></div>
        </div>)}</div> : <div className="ops-inset-group grid gap-2">
          <p className="m-0 text-[length:var(--app-text-sm)] text-[var(--admin-muted)]">No existing customer matched this quote. KCPL can create one from the quote’s company and contact details, mark it active and link this quote and shipment.</p>
          <div><OpsButton variant="primary" disabled={linkBusy || !quoteReference} onClick={createCustomerFromQuote}><UserPlus size={14} strokeWidth={1.75} aria-hidden="true"/>{linkBusy ? "Creating customer…" : "Create customer from quote"}</OpsButton></div>
        </div>}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <OpsField label="Or enter an existing customer reference" className="min-w-[280px] flex-1"><input className="ops-input" value={manualCustomerId} onChange={(event) => setManualCustomerId(event.target.value)} placeholder="KCPL-C-…"/></OpsField>
          <OpsButton variant="secondary" disabled={linkBusy || !manualCustomerId.trim()} onClick={() => confirmCustomer(manualCustomerId)}>Confirm existing customer</OpsButton>
        </div>
      </OpsSurface>}

      <OpsSurface title="Invoice draft" description={customerId ? "Complete the details, then create the draft." : "Unlocks once the customer is confirmed above."}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Issue date"><input required disabled={!customerId} type="date" className="ops-input" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field>
          <Field label="Due date"><input disabled={!customerId} type="date" className="ops-input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
          <Field label="Currency"><select disabled={!customerId} className="ops-select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Amount before tax"><input required disabled={!customerId} min="0.01" step="0.01" type="number" inputMode="decimal" className="ops-input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="Tax %"><input disabled={!customerId} min="0" max="100" step="0.01" type="number" inputMode="decimal" className="ops-input" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
          <Field label="Description"><input disabled={!customerId} className="ops-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea disabled={!customerId} className="ops-textarea min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4"><OpsButton type="submit" variant="primary" disabled={busy || !customerId}><FilePlus2 size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Creating…" : "Create invoice draft"}</OpsButton></div>
        </form>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <OpsField label={label}>{children}</OpsField>;
}
