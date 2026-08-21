"use client";

import { FormEvent, useState } from "react";
import { Archive, Pencil, Save, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  crmAccountStatusLabels,
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStageLabels,
  crmLeadStages,
  crmRelationshipLabels,
  crmRelationshipTypes,
  kcplBranches,
  type CrmCustomerDetail,
  type CrmRelationshipType,
} from "../crm-data";
import { kcplStaffRoleLabels, type StaffCapabilities } from "../../staff-permissions";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";

function csv(values: string[]) {
  return values.join(", ");
}

function list(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function CrmCustomerProfileEditor({ customer, permissions }: { customer: CrmCustomerDetail; permissions: StaffCapabilities }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    entityKind: customer.entity_kind,
    displayName: customer.display_name,
    legalName: customer.legal_name ?? "",
    tradingName: customer.trading_name ?? "",
    relationshipTypes: [...customer.relationship_types],
    accountStatus: customer.account_status,
    leadStage: customer.lead_stage,
    leadSource: customer.lead_source ?? "",
    primaryEmail: customer.primary_email ?? "",
    primaryPhone: customer.primary_phone ?? "",
    website: customer.website ?? "",
    industry: customer.industry ?? "",
    taxId: customer.tax_id ?? "",
    country: customer.country,
    primaryBranch: customer.primary_branch,
    accountManagerName: customer.account_manager_name ?? "",
    accountManagerEmail: customer.account_manager_email ?? "",
    accountManagerPhone: customer.account_manager_phone ?? "",
    billingEmail: customer.billing_email ?? "",
    tags: csv(customer.tags),
    transportPreferences: csv(customer.transport_preferences),
    internalSummary: customer.internal_summary ?? "",
    preferredCurrency: customer.preferred_currency,
    paymentTermsDays: customer.commercial.payment_terms_days?.toString() ?? "",
    creditLimit: customer.commercial.credit_limit?.toString() ?? "",
    pricingNotes: customer.commercial.pricing_notes ?? "",
    markupPercent: customer.commercial.markup_percent?.toString() ?? "",
    preferredCarriers: csv(customer.commercial.preferred_carriers),
  });

  function field(name: string, value: unknown) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleRelationship(type: CrmRelationshipType) {
    if (type === "customer") return;
    setForm((current) => ({
      ...current,
      relationshipTypes: current.relationshipTypes.includes(type)
        ? current.relationshipTypes.filter((item) => item !== type)
        : [...current.relationshipTypes, type],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        tags: list(form.tags),
        transportPreferences: list(form.transportPreferences),
      };
      if (!permissions.canEditCommercial) {
        delete payload.preferredCurrency;
        delete payload.pricingNotes;
        delete payload.markupPercent;
        delete payload.preferredCarriers;
      } else {
        payload.preferredCarriers = list(form.preferredCarriers);
      }
      if (!permissions.canManageCredit) {
        delete payload.paymentTermsDays;
        delete payload.creditLimit;
      }

      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Customer could not be updated.");
      setNotice("Customer profile updated.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Customer could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveCustomer() {
    if (!window.confirm(`Archive ${customer.display_name}? Quotes, shipments and documents will be preserved.`)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Customer could not be archived.");
      router.push("/admin/crm");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Customer could not be archived.");
      setBusy(false);
    }
  }

  return (
    <section className="bg-[#f4f1e9] px-5 pb-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] rounded-[26px] border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b78a3e]">Account controls</p>
              <span className="flex items-center gap-1 rounded-full bg-[#10263f] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-white"><ShieldCheck size={11} />{kcplStaffRoleLabels[permissions.role]}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-black/45">Edit the master CRM profile. Archive preserves the complete customer history.</p>
          </div>
          <div className="flex gap-2">
            {permissions.canArchiveCustomer ? <button type="button" disabled={busy} onClick={archiveCustomer} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700"><Archive size={13} />Archive</button> : null}
            {permissions.canEditCustomer ? <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-xl bg-[#10263f] px-3 py-2 text-[10px] font-black text-white">{open ? <X size={13} /> : <Pencil size={13} />}{open ? "Close editor" : "Edit customer"}</button> : null}
          </div>
        </div>
        {notice ? <div className="mt-4 rounded-xl bg-[#fff8e8] px-4 py-3 text-xs font-bold text-[#6d5427]">{notice}</div> : null}

        {open ? <form onSubmit={save} className="mt-6 space-y-6 border-t border-black/10 pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Record type"><select className="crm360-input" value={form.entityKind} onChange={(event) => field("entityKind", event.target.value)}>{crmEntityKinds.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Display name"><input required className="crm360-input" value={form.displayName} onChange={(event) => field("displayName", event.target.value)} /></Field>
            <Field label="Legal name"><input className="crm360-input" value={form.legalName} onChange={(event) => field("legalName", event.target.value)} /></Field>
            <Field label="Trading name"><input className="crm360-input" value={form.tradingName} onChange={(event) => field("tradingName", event.target.value)} /></Field>
            <Field label="Account status"><select className="crm360-input" value={form.accountStatus} onChange={(event) => field("accountStatus", event.target.value)}>{crmAccountStatuses.map((value) => <option key={value} value={value}>{crmAccountStatusLabels[value]}</option>)}</select></Field>
            <Field label="Lead stage"><select className="crm360-input" value={form.leadStage} onChange={(event) => field("leadStage", event.target.value)}>{crmLeadStages.map((value) => <option key={value} value={value}>{crmLeadStageLabels[value]}</option>)}</select></Field>
            <Field label="Lead source"><select className="crm360-input" value={form.leadSource} onChange={(event) => field("leadSource", event.target.value)}><option value="">Not recorded</option>{crmLeadSources.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
            <Field label="Primary branch"><select className="crm360-input" value={form.primaryBranch} onChange={(event) => field("primaryBranch", event.target.value)}>{kcplBranches.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          </div>

          <div><p className="mb-2 text-[9px] font-black uppercase tracking-[.13em] text-black/40">Relationships</p><div className="flex flex-wrap gap-2">{crmRelationshipTypes.map((type) => <button key={type} type="button" onClick={() => toggleRelationship(type)} disabled={type === "customer"} className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${form.relationshipTypes.includes(type) ? "border-[#10263f] bg-[#10263f] text-white" : "border-black/10 bg-[#faf9f5] text-black/50"}`}>{crmRelationshipLabels[type]}</button>)}</div></div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Primary email"><input type="email" className="crm360-input" value={form.primaryEmail} onChange={(event) => field("primaryEmail", event.target.value)} /></Field>
            <Field label="Primary phone"><input className="crm360-input" value={form.primaryPhone} onChange={(event) => field("primaryPhone", event.target.value)} /></Field>
            <Field label="Billing email"><input type="email" className="crm360-input" value={form.billingEmail} onChange={(event) => field("billingEmail", event.target.value)} /></Field>
            <Field label="Country"><input className="crm360-input" value={form.country} onChange={(event) => field("country", event.target.value)} /></Field>
            <Field label="Website"><input className="crm360-input" value={form.website} onChange={(event) => field("website", event.target.value)} /></Field>
            <Field label="Industry"><input className="crm360-input" value={form.industry} onChange={(event) => field("industry", event.target.value)} /></Field>
            <Field label="PAN / VAT / Tax ID"><input className="crm360-input" value={form.taxId} onChange={(event) => field("taxId", event.target.value)} /></Field>
            <Field label="Tags"><input className="crm360-input" value={form.tags} onChange={(event) => field("tags", event.target.value)} placeholder="VIP, Importer, China Trade" /></Field>
            <div className="md:col-span-2 xl:col-span-2"><Field label="Account manager"><StaffAssignmentPicker branch={form.primaryBranch} value={{ name: form.accountManagerName, email: form.accountManagerEmail, phone: form.accountManagerPhone }} onChange={(staff) => setForm((current) => ({ ...current, accountManagerName: staff.name, accountManagerEmail: staff.email, accountManagerPhone: staff.phone }))}/></Field></div>
            <Field label="Transport preferences"><input className="crm360-input" value={form.transportPreferences} onChange={(event) => field("transportPreferences", event.target.value)} /></Field>
          </div>

          <Field label="Internal account summary"><textarea className="crm360-input min-h-24 resize-y" value={form.internalSummary} onChange={(event) => field("internalSummary", event.target.value)} /></Field>

          {permissions.canEditCommercial ? <div className="rounded-2xl border border-[#d4ad62]/30 bg-[#fffaf0] p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8b6b32]">Commercial pricing</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Currency"><select className="crm360-input" value={form.preferredCurrency} onChange={(event) => field("preferredCurrency", event.target.value)}>{crmCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Default markup %"><input inputMode="decimal" className="crm360-input" value={form.markupPercent} onChange={(event) => field("markupPercent", event.target.value)} /></Field>
            <Field label="Preferred carriers"><input className="crm360-input" value={form.preferredCarriers} onChange={(event) => field("preferredCarriers", event.target.value)} /></Field>
            <div className="md:col-span-2 xl:col-span-4"><Field label="Pricing notes"><textarea className="crm360-input min-h-20 resize-y" value={form.pricingNotes} onChange={(event) => field("pricingNotes", event.target.value)} /></Field></div>
          </div></div> : null}

          {permissions.canManageCredit ? <div className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-black/40">Credit control</p><div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Payment terms days"><input inputMode="numeric" className="crm360-input" value={form.paymentTermsDays} onChange={(event) => field("paymentTermsDays", event.target.value)} /></Field>
            <Field label="Credit limit"><input inputMode="decimal" className="crm360-input" value={form.creditLimit} onChange={(event) => field("creditLimit", event.target.value)} /></Field>
            <Field label="Outstanding balance"><div className="crm360-input flex items-center bg-[#f4f1ed] text-[#6f6862]">{customer.commercial.outstanding_balance === null ? "No receivable balance" : `${customer.preferred_currency} ${customer.commercial.outstanding_balance.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`} · calculated from Receivables</div></Field>
          </div></div> : null}

          <div className="flex justify-end"><button type="submit" disabled={busy || !form.relationshipTypes.length} className="flex items-center gap-2 rounded-xl bg-[#10263f] px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14} />{busy ? "Saving…" : "Save customer"}</button></div>
        </form> : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">{label}</span>{children}</label>;
}