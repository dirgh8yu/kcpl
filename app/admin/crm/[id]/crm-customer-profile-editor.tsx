"use client";

import { FormEvent, useState } from "react";
import { Archive, Pencil, Save, X } from "lucide-react";
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
import type { StaffCapabilities } from "../../staff-permissions";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";
import { readable } from "../../readable";
import { OpsButton, OpsField, OpsNotice } from "../../operations-ui";

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
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
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
    setNotice(null);
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
      setNotice({ text: "Customer profile updated.", tone: "success" });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Customer could not be updated.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function archiveCustomer() {
    if (!window.confirm(`Archive ${customer.display_name}? Quotes, shipments and documents will be preserved.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Customer could not be archived.");
      router.push("/admin/crm");
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Customer could not be archived.", tone: "danger" });
      setBusy(false);
    }
  }

  return (
    <div className="crm-tool-panel">
      <div className="crm-tool-bar">
        <p className="crm-tool-intro">Edit the customer’s details. Archiving keeps their full history.</p>
        <div className="flex gap-2">
          {permissions.canArchiveCustomer ? <OpsButton variant="danger" disabled={busy} onClick={archiveCustomer}><Archive size={14} strokeWidth={1.75} aria-hidden="true"/>Archive</OpsButton> : null}
          {permissions.canEditCustomer ? <OpsButton variant={open ? "secondary" : "primary"} onClick={() => setOpen((value) => !value)}>{open ? <X size={14} strokeWidth={1.75} aria-hidden="true"/> : <Pencil size={14} strokeWidth={1.75} aria-hidden="true"/>}{open ? "Close editor" : "Edit customer"}</OpsButton> : null}
        </div>
      </div>
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

        {open ? <form onSubmit={save} className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Record type"><select className="ops-select" value={form.entityKind} onChange={(event) => field("entityKind", event.target.value)}>{crmEntityKinds.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Display name"><input required className="ops-input" value={form.displayName} onChange={(event) => field("displayName", event.target.value)} /></Field>
            <Field label="Legal name"><input className="ops-input" value={form.legalName} onChange={(event) => field("legalName", event.target.value)} /></Field>
            <Field label="Trading name"><input className="ops-input" value={form.tradingName} onChange={(event) => field("tradingName", event.target.value)} /></Field>
            <Field label="Account status"><select className="ops-select" value={form.accountStatus} onChange={(event) => field("accountStatus", event.target.value)}>{crmAccountStatuses.map((value) => <option key={value} value={value}>{crmAccountStatusLabels[value]}</option>)}</select></Field>
            <Field label="Lead stage"><select className="ops-select" value={form.leadStage} onChange={(event) => field("leadStage", event.target.value)}>{crmLeadStages.map((value) => <option key={value} value={value}>{crmLeadStageLabels[value]}</option>)}</select></Field>
            <Field label="Lead source"><select className="ops-select" value={form.leadSource} onChange={(event) => field("leadSource", event.target.value)}><option value="">Not recorded</option>{crmLeadSources.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></Field>
            <Field label="Primary branch"><select className="ops-select" value={form.primaryBranch} onChange={(event) => field("primaryBranch", event.target.value)}>{kcplBranches.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          </div>

          <div><p className="crm-tool-heading">Relationships</p><div className="flex flex-wrap gap-2">{crmRelationshipTypes.map((type) => <button key={type} type="button" onClick={() => toggleRelationship(type)} disabled={type === "customer"} className="crm-chip" aria-pressed={form.relationshipTypes.includes(type)}>{crmRelationshipLabels[type]}</button>)}</div></div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Primary email"><input type="email" className="ops-input" value={form.primaryEmail} onChange={(event) => field("primaryEmail", event.target.value)} /></Field>
            <Field label="Primary phone"><input className="ops-input" value={form.primaryPhone} onChange={(event) => field("primaryPhone", event.target.value)} /></Field>
            <Field label="Billing email"><input type="email" className="ops-input" value={form.billingEmail} onChange={(event) => field("billingEmail", event.target.value)} /></Field>
            <Field label="Country"><input className="ops-input" value={form.country} onChange={(event) => field("country", event.target.value)} /></Field>
            <Field label="Website"><input className="ops-input" value={form.website} onChange={(event) => field("website", event.target.value)} /></Field>
            <Field label="Industry"><input className="ops-input" value={form.industry} onChange={(event) => field("industry", event.target.value)} /></Field>
            <Field label="PAN / VAT / Tax ID"><input className="ops-input" value={form.taxId} onChange={(event) => field("taxId", event.target.value)} /></Field>
            <Field label="Tags"><input className="ops-input" value={form.tags} onChange={(event) => field("tags", event.target.value)} placeholder="VIP, Importer, China Trade" /></Field>
            <div className="md:col-span-2 xl:col-span-2"><Field label="Account manager"><StaffAssignmentPicker branch={form.primaryBranch} value={{ name: form.accountManagerName, email: form.accountManagerEmail, phone: form.accountManagerPhone }} onChange={(staff) => setForm((current) => ({ ...current, accountManagerName: staff.name, accountManagerEmail: staff.email, accountManagerPhone: staff.phone }))}/></Field></div>
            <Field label="Transport preferences"><input className="ops-input" value={form.transportPreferences} onChange={(event) => field("transportPreferences", event.target.value)} /></Field>
          </div>

          <Field label="Internal account summary"><textarea className="ops-textarea min-h-24" value={form.internalSummary} onChange={(event) => field("internalSummary", event.target.value)} /></Field>

          {permissions.canEditCommercial ? <div className="ops-inset-group"><p className="crm-tool-heading">Commercial pricing</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Currency"><select className="ops-select" value={form.preferredCurrency} onChange={(event) => field("preferredCurrency", event.target.value)}>{crmCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Default markup %"><input inputMode="decimal" className="ops-input" value={form.markupPercent} onChange={(event) => field("markupPercent", event.target.value)} /></Field>
            <Field label="Preferred carriers"><input className="ops-input" value={form.preferredCarriers} onChange={(event) => field("preferredCarriers", event.target.value)} /></Field>
            <div className="md:col-span-2 xl:col-span-4"><Field label="Pricing notes"><textarea className="ops-textarea min-h-20" value={form.pricingNotes} onChange={(event) => field("pricingNotes", event.target.value)} /></Field></div>
          </div></div> : null}

          {permissions.canManageCredit ? <div className="ops-inset-group"><p className="crm-tool-heading">Credit control</p><div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Payment terms days"><input inputMode="numeric" className="ops-input" value={form.paymentTermsDays} onChange={(event) => field("paymentTermsDays", event.target.value)} /></Field>
            <Field label="Credit limit"><input inputMode="decimal" className="ops-input" value={form.creditLimit} onChange={(event) => field("creditLimit", event.target.value)} /></Field>
            <Field label="Outstanding balance"><div className="ops-input flex items-center bg-[var(--admin-surface-soft)] text-[var(--admin-muted)]">{customer.commercial.outstanding_balance === null ? "No receivable balance" : `${customer.preferred_currency} ${customer.commercial.outstanding_balance.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`} · calculated from Receivables</div></Field>
          </div></div> : null}

          <div className="flex justify-end"><OpsButton type="submit" variant="primary" disabled={busy || !form.relationshipTypes.length}><Save size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Saving…" : "Save customer"}</OpsButton></div>
        </form> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <OpsField label={label}>{children}</OpsField>;
}