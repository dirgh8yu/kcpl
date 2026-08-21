"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Handshake } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../../crm/crm-data";
import { partnerTypeLabels, partnerTypes, type PartnerOwnerBranch, type PartnerType } from "../partners-data";
import { OpsButton, OpsField, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";

export function NewPartnerWorkspace({ ownerOptions }: { ownerOptions: PartnerOwnerBranch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    type: "overseas_counterpart" as PartnerType,
    ownerBranch: ownerOptions[0],
    country: "Nepal",
    primaryContactName: "",
    primaryEmail: "",
    primaryPhone: "",
    preferredCurrency: "USD" as CrmCurrency,
    paymentTermsDays: "30",
    internalNotes: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          legalName: "",
          types: [form.type],
          modes: [],
          status: "active",
          preferred: false,
          country: form.country,
          ownerBranch: form.ownerBranch,
          citiesServed: [],
          countriesServed: [],
          portsServed: [],
          primaryContactName: form.primaryContactName,
          primaryEmail: form.primaryEmail,
          primaryPhone: form.primaryPhone,
          whatsapp: "",
          website: "",
          preferredCurrency: form.preferredCurrency,
          paymentTermsDays: Number(form.paymentTermsDays || 0),
          serviceRating: null,
          registrationNumber: "",
          taxId: "",
          contractReference: "",
          contractExpiryDate: "",
          documentUrl: "",
          commercialTerms: "",
          internalNotes: form.internalNotes,
          tags: [],
        }),
      });
      const data = await response.json() as { ok?: boolean; partner?: { id: string }; error?: string };
      if (!response.ok || !data.partner?.id) throw new Error(data.error || "Partner record could not be created.");
      router.push(`/admin/partners/${encodeURIComponent(data.partner.id)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Partner record could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Quick create" title="New partner" description="Add the working identity first, then complete contracts, service footprint and commercial details from Partner 360." actions={<Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Cancel</Link>}/>
    <div className="ops-content ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      <OpsSurface eyebrow="Partner identity" title="Add to the KCPL network" description="This uses the same Partner API, duplicate checks and branch permissions as the full Partner workspace.">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OpsField label="Partner / vendor name" className="md:col-span-2"><input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Agent, carrier, transporter or counterpart"/></OpsField>
          <OpsField label="Relationship type"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PartnerType })}>{partnerTypes.map((type) => <option key={type} value={type}>{partnerTypeLabels[type]}</option>)}</select></OpsField>
          <OpsField label="KCPL owner"><select value={form.ownerBranch} onChange={(event) => setForm({ ...form, ownerBranch: event.target.value as PartnerOwnerBranch })}>{ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></OpsField>
          <OpsField label="Country"><input required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}/></OpsField>
          <OpsField label="Primary contact"><input value={form.primaryContactName} onChange={(event) => setForm({ ...form, primaryContactName: event.target.value })}/></OpsField>
          <OpsField label="Email"><input type="email" value={form.primaryEmail} onChange={(event) => setForm({ ...form, primaryEmail: event.target.value })}/></OpsField>
          <OpsField label="Phone"><input value={form.primaryPhone} onChange={(event) => setForm({ ...form, primaryPhone: event.target.value })}/></OpsField>
          <OpsField label="Preferred currency"><select value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
          <OpsField label="Payment terms (days)"><input type="number" min="0" max="3650" step="1" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}/></OpsField>
          <OpsField label="Internal note" className="md:col-span-2 xl:col-span-4"><textarea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} placeholder="Optional setup context"/></OpsField>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4"><OpsButton variant="primary" disabled={busy}><Handshake size={13}/>{busy ? "Creating…" : "Create partner"}</OpsButton><Link href="/admin/partners" className="ops-button" data-variant="ghost" data-size="md">Cancel</Link></div>
        </form>
      </OpsSurface>
    </div>
  </OpsPage>;
}
