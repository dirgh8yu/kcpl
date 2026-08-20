"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Link2, TriangleAlert, UserCheck, UserPlus } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../../../crm/crm-data";
import type { FinanceCustomerSuggestion } from "../../finance-customer-resolution";
import { OpsButton, OpsPageHeader, OpsPanel, OpsStatusBadge } from "../../../operations-ui";

export function ShipmentInvoiceForm({ shipmentReference, customerId, customerName, quoteReference, suggestions }: { shipmentReference: string; customerId: string | null; customerName: string | null; quoteReference: string | null; suggestions: FinanceCustomerSuggestion[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [candidateCustomers, setCandidateCustomers] = useState(suggestions);
  const [form, setForm] = useState({ issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "Freight and Logistics", amount: "", taxRate: "0", notes: "" });

  async function confirmCustomer(targetCustomerId: string) {
    const target = targetCustomerId.trim().toUpperCase();
    if (!target) return;
    setLinkBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/finance/customer-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shipmentReference, customerId: target, action: "confirm" }) });
      const data = await response.json() as { customerId?: string; error?: string };
      if (!response.ok || !data.customerId) throw new Error(data.error || "Customer could not be linked.");
      setNotice("CRM customer confirmed. Reloading the invoice workspace…");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Customer could not be linked."); }
    finally { setLinkBusy(false); }
  }

  async function createCustomerFromQuote() {
    setLinkBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/finance/customer-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shipmentReference, action: "create_from_quote" }) });
      const data = await response.json() as { customerId?: string; customerName?: string; error?: string; code?: string; suggestions?: FinanceCustomerSuggestion[] };
      if (response.status === 409 && data.code === "possible_duplicate" && data.suggestions?.length) {
        setCandidateCustomers(data.suggestions);
        throw new Error("A similar CRM customer already exists. Confirm the correct existing customer instead of creating a duplicate.");
      }
      if (!response.ok || !data.customerId) throw new Error(data.error || "CRM customer could not be created.");
      setNotice(`CRM customer ${data.customerName || data.customerId} created and linked. Reloading…`);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "CRM customer could not be created."); }
    finally { setLinkBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) { setNotice("Confirm or create the CRM customer before creating the invoice."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/finance/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, customerId, shipmentReference, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invoice could not be created."); }
    finally { setBusy(false); }
  }

  return <main>
    <OpsPageHeader eyebrow="Accounts receivable" title="Create shipment invoice" description={shipmentReference} breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Shipments", href: "/admin/shipments" }, { label: shipmentReference, href: `/admin/jobs/${encodeURIComponent(shipmentReference)}` }, { label: "Create invoice" }]} meta={quoteReference ? <span>Originating quote {quoteReference}</span> : undefined} actions={<><OpsButton href={`/admin/jobs/${encodeURIComponent(shipmentReference)}`}>Digital Job File</OpsButton><OpsButton href="/admin/finance">Finance & AR</OpsButton></>}/>
    <div className="ops-page-body ops-stack">
      {notice ? <div className="rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}

      <OpsPanel title="Shipment & customer" eyebrow="Invoice link" description="The invoice must be anchored to a CRM customer before the receivable is created.">
        <div className="grid gap-px bg-[#eceef0] sm:grid-cols-2"><div className="bg-white p-4"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#9299a0]">Shipment</p><p className="mt-1 text-xs font-semibold text-[#30363d]">{shipmentReference}</p>{quoteReference ? <p className="mt-1 text-[10px] text-[#858c94]">Quote {quoteReference}</p> : null}</div><div className="bg-white p-4"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#9299a0]">CRM customer</p>{customerId ? <div className="mt-1"><p className="flex items-center gap-2 text-xs font-semibold text-[#397052]"><Link2 size={12}/>{customerName || customerId}</p><p className="mt-1 text-[9px] text-[#858c94]">{customerId}</p></div> : <div className="mt-1 flex items-center gap-2"><TriangleAlert size={12} className="text-[#8a6734]"/><OpsStatusBadge tone="warning">Confirmation required</OpsStatusBadge></div>}</div></div>
      </OpsPanel>

      {!customerId ? <OpsPanel title="Confirm shipment customer" eyebrow="Customer resolution" description="KCPL will link the quote and shipment to the customer you confirm. New CRM records can be created directly from the quote when no existing account matches." action={<UserCheck size={15} className="text-[#7a84b6]"/>}>
        {candidateCustomers.length ? <div className="grid gap-px bg-[#eceef0] md:grid-cols-2">{candidateCustomers.map((item) => <div key={item.id} className="bg-white p-4"><p className="text-xs font-semibold text-[#30363d]">{item.display_name}</p><p className="mt-1 text-[9px] text-[#8c939b]">{item.id} · matched by {item.reason}</p><div className="mt-3"><OpsButton type="button" tone="primary" disabled={linkBusy} onClick={() => void confirmCustomer(item.id)}>{linkBusy ? "Linking…" : "Confirm this customer"}</OpsButton></div></div>)}</div> : <div className="p-4"><p className="text-[11px] text-[#69717a]">No existing CRM customer matched this quote.</p><OpsButton type="button" tone="primary" disabled={linkBusy || !quoteReference} onClick={() => void createCustomerFromQuote()} className="mt-3"><UserPlus size={12}/>{linkBusy ? "Creating customer…" : "Create CRM customer from quote"}</OpsButton><p className="mt-2 text-[9px] leading-4 text-[#9299a0]">The quote company/contact details are reused and the CRM audit trail is preserved.</p></div>}
        <div className="flex flex-wrap items-end gap-2 border-t border-[#eceef0] bg-[#fcfcfc] p-4"><label className="min-w-[260px] flex-1"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">Existing CRM customer reference</span><input value={manualCustomerId} onChange={(event) => setManualCustomerId(event.target.value)} placeholder="KCPL-C-..."/></label><OpsButton type="button" disabled={linkBusy || !manualCustomerId.trim()} onClick={() => void confirmCustomer(manualCustomerId)}>Confirm existing customer</OpsButton></div>
      </OpsPanel> : null}

      <OpsPanel title="Invoice draft" eyebrow="New receivable" description={customerId ? "Customer confirmed. Complete the commercial details below." : "Invoice creation unlocks after the CRM customer is confirmed or created."} action={<FilePlus2 size={15} className="text-[#7a84b6]"/>}>
        <form onSubmit={submit} className={`grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 ${customerId ? "" : "opacity-55"}`}>
          <Field label="Issue date"><input required disabled={!customerId} type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field><Field label="Due date"><input disabled={!customerId} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field><Field label="Currency"><select disabled={!customerId} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field><Field label="Amount before tax"><input required disabled={!customerId} min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field><Field label="Tax %"><input disabled={!customerId} min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field><div className="md:col-span-2 xl:col-span-3"><Field label="Description"><input disabled={!customerId} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field></div><div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea disabled={!customerId} rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div><div className="md:col-span-2 xl:col-span-4 flex justify-end"><OpsButton tone="primary" type="submit" disabled={busy || !customerId}>{busy ? "Creating…" : "Create invoice draft"}</OpsButton></div>
        </form>
      </OpsPanel>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>; }
