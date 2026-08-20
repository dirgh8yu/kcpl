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
import { OpsButton, OpsPanel, OpsStatusBadge } from "../../operations-ui";

function csv(values: string[]) { return values.join(", "); }
function list(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }

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
    billingEmail: customer.billing_email ?? "",
    tags: csv(customer.tags),
    transportPreferences: csv(customer.transport_preferences),
    internalSummary: customer.internal_summary ?? "",
    preferredCurrency: customer.preferred_currency,
    paymentTermsDays: customer.commercial.payment_terms_days?.toString() ?? "",
    creditLimit: customer.commercial.credit_limit?.toString() ?? "",
    outstandingBalance: customer.commercial.outstanding_balance?.toString() ?? "",
    pricingNotes: customer.commercial.pricing_notes ?? "",
    markupPercent: customer.commercial.markup_percent?.toString() ?? "",
    preferredCarriers: csv(customer.commercial.preferred_carriers),
  });

  function field(name: string, value: unknown) { setForm((current) => ({ ...current, [name]: value })); }

  function toggleRelationship(type: CrmRelationshipType) {
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
      const payload: Record<string, unknown> = { ...form, tags: list(form.tags), transportPreferences: list(form.transportPreferences) };
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
        delete payload.outstandingBalance;
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
    } finally { setBusy(false); }
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

  return <OpsPanel
    title="Master customer profile"
    eyebrow="Account controls"
    description="Edit the canonical CRM record. Archiving preserves quotes, shipments, documents and audit history."
    action={<div className="flex flex-wrap items-center gap-2"><OpsStatusBadge tone="accent"><ShieldCheck size={10}/>{kcplStaffRoleLabels[permissions.role]}</OpsStatusBadge>{permissions.canArchiveCustomer ? <OpsButton tone="danger" disabled={busy} onClick={() => void archiveCustomer()}><Archive size={12}/>Archive</OpsButton> : null}{permissions.canEditCustomer ? <OpsButton tone={open ? "secondary" : "primary"} onClick={() => setOpen((value) => !value)}>{open ? <X size={12}/> : <Pencil size={12}/>} {open ? "Close editor" : "Edit customer"}</OpsButton> : null}</div>}
  >
    {notice ? <div className="border-b border-[#eceef0] bg-[#fcfcfc] px-4 py-3 text-[11px] text-[#59616a]">{notice}</div> : null}
    {!open ? <div className="grid gap-px bg-[#eceef0] sm:grid-cols-2 xl:grid-cols-4"><Snapshot label="Record type" value={form.entityKind === "company" ? "Company / organisation" : "Individual"}/><Snapshot label="Account status" value={crmAccountStatusLabels[form.accountStatus]}/><Snapshot label="Lead stage" value={crmLeadStageLabels[form.leadStage]}/><Snapshot label="Primary branch" value={form.primaryBranch}/></div> : null}

    {open ? <form onSubmit={save} className="p-4">
      <div className="grid gap-3 xl:grid-cols-2">
        <FormSection title="Identity & relationship">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Record type"><select value={form.entityKind} onChange={(event) => field("entityKind", event.target.value)}>{crmEntityKinds.map((value) => <option key={value} value={value}>{value === "company" ? "Company / organisation" : "Individual"}</option>)}</select></Field><Field label="Display name"><input required value={form.displayName} onChange={(event) => field("displayName", event.target.value)}/></Field><Field label="Legal name"><input value={form.legalName} onChange={(event) => field("legalName", event.target.value)}/></Field><Field label="Trading name"><input value={form.tradingName} onChange={(event) => field("tradingName", event.target.value)}/></Field><Field label="Account status"><select value={form.accountStatus} onChange={(event) => field("accountStatus", event.target.value)}>{crmAccountStatuses.map((value) => <option key={value} value={value}>{crmAccountStatusLabels[value]}</option>)}</select></Field><Field label="Lead stage"><select value={form.leadStage} onChange={(event) => field("leadStage", event.target.value)}>{crmLeadStages.map((value) => <option key={value} value={value}>{crmLeadStageLabels[value]}</option>)}</select></Field><Field label="Lead source"><select value={form.leadSource} onChange={(event) => field("leadSource", event.target.value)}><option value="">Not recorded</option>{crmLeadSources.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field><Field label="Primary branch"><select value={form.primaryBranch} onChange={(event) => field("primaryBranch", event.target.value)}>{kcplBranches.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field></div>
          <div className="mt-3"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">Relationships</span><div className="flex flex-wrap gap-1.5">{crmRelationshipTypes.map((type) => <button key={type} type="button" onClick={() => toggleRelationship(type)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${form.relationshipTypes.includes(type) ? "border-[#dce0fa] bg-[#f1f3ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#737b84]"}`}>{crmRelationshipLabels[type]}</button>)}</div></div>
        </FormSection>

        <FormSection title="Contact & ownership">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Primary email"><input type="email" value={form.primaryEmail} onChange={(event) => field("primaryEmail", event.target.value)}/></Field><Field label="Primary phone"><input value={form.primaryPhone} onChange={(event) => field("primaryPhone", event.target.value)}/></Field><Field label="Billing email"><input type="email" value={form.billingEmail} onChange={(event) => field("billingEmail", event.target.value)}/></Field><Field label="Country"><input value={form.country} onChange={(event) => field("country", event.target.value)}/></Field><Field label="Website"><input value={form.website} onChange={(event) => field("website", event.target.value)}/></Field><Field label="Industry"><input value={form.industry} onChange={(event) => field("industry", event.target.value)}/></Field><Field label="PAN / VAT / Tax ID"><input value={form.taxId} onChange={(event) => field("taxId", event.target.value)}/></Field><Field label="Tags"><input value={form.tags} onChange={(event) => field("tags", event.target.value)} placeholder="VIP, Importer, China Trade"/></Field><Field label="Account manager"><input value={form.accountManagerName} onChange={(event) => field("accountManagerName", event.target.value)}/></Field><Field label="Manager email"><input type="email" value={form.accountManagerEmail} onChange={(event) => field("accountManagerEmail", event.target.value)}/></Field><div className="sm:col-span-2"><Field label="Transport preferences"><input value={form.transportPreferences} onChange={(event) => field("transportPreferences", event.target.value)}/></Field></div></div>
        </FormSection>

        <FormSection title="Internal account context"><Field label="Internal account summary"><textarea rows={5} value={form.internalSummary} onChange={(event) => field("internalSummary", event.target.value)}/></Field></FormSection>

        {permissions.canEditCommercial ? <FormSection title="Commercial pricing"><div className="grid gap-3 sm:grid-cols-2"><Field label="Currency"><select value={form.preferredCurrency} onChange={(event) => field("preferredCurrency", event.target.value)}>{crmCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field><Field label="Default markup %"><input inputMode="decimal" value={form.markupPercent} onChange={(event) => field("markupPercent", event.target.value)}/></Field><div className="sm:col-span-2"><Field label="Preferred carriers"><input value={form.preferredCarriers} onChange={(event) => field("preferredCarriers", event.target.value)}/></Field></div><div className="sm:col-span-2"><Field label="Pricing notes"><textarea rows={4} value={form.pricingNotes} onChange={(event) => field("pricingNotes", event.target.value)}/></Field></div></div></FormSection> : null}

        {permissions.canManageCredit ? <FormSection title="Credit control"><div className="grid gap-3 sm:grid-cols-3"><Field label="Payment terms days"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => field("paymentTermsDays", event.target.value)}/></Field><Field label="Credit limit"><input inputMode="decimal" value={form.creditLimit} onChange={(event) => field("creditLimit", event.target.value)}/></Field><Field label="Outstanding balance"><input inputMode="decimal" value={form.outstandingBalance} onChange={(event) => field("outstandingBalance", event.target.value)}/></Field></div></FormSection> : null}
      </div>
      <div className="mt-4 flex justify-end border-t border-[#eceef0] pt-4"><OpsButton tone="primary" type="submit" disabled={busy || !form.relationshipTypes.length}><Save size={12}/>{busy ? "Saving…" : "Save customer"}</OpsButton></div>
    </form> : null}
  </OpsPanel>;
}

function Snapshot({ label, value }: { label: string; value: string }) { return <div className="bg-white p-3.5"><p className="text-[9px] text-[#9299a0]">{label}</p><p className="mt-1 text-[11px] font-semibold text-[#414850]">{value}</p></div>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-[#e4e6e9] bg-white p-4"><h3 className="mb-3 text-xs font-semibold text-[#343a40]">{title}</h3>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>; }
