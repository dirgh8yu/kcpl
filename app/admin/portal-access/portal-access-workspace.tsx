"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Building2, KeyRound, UserPlus, Users2 } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsKpiRail,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
} from "../operations-ui";
import { portalRoleLabels, portalRoles, type PortalRole } from "../../portal/portal-access-policy";
import type { PortalAccountSummary } from "../../portal/portal-accounts.server";

type CustomerOption = { id: string; name: string; branch: string };

export function PortalAccessWorkspace({
  initialAccounts,
  customers,
}: {
  initialAccounts: PortalAccountSummary[];
  customers: CustomerOption[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [role, setRole] = useState<PortalRole>("owner");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCustomerId, setLinkCustomerId] = useState(customers[0]?.id ?? "");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) =>
      account.email.includes(needle) || account.customer_name.toLowerCase().includes(needle));
  }, [accounts, query]);

  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.name])),
    [customers],
  );

  async function refresh() {
    const response = await fetch("/api/admin/portal-access", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; accounts?: PortalAccountSummary[] };
    if (data.ok && data.accounts) setAccounts(data.accounts);
  }

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/portal-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { ok?: boolean; error?: string; link?: string | null; delivered?: boolean };
    if (!response.ok || !data.ok) throw new Error(data.error || "The change could not be saved.");
    return data;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      await post({ action: "save", email, customerId, role });
      setNotice(`${email.trim().toLowerCase()} can now sign in to the customer portal once they have set a password.`);
      setEmail("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portal account could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function invite(account: PortalAccountSummary) {
    if (busy) return;
    setBusy(account.email);
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      const data = await post({ action: "invite", email: account.email, customerName: account.customer_name });
      if (data.delivered) {
        setNotice(`An invitation has been emailed to ${account.email}.`);
      } else {
        setNotice(`No email provider is configured, so send this one-time link to ${account.email} yourself.`);
        setInviteLink(data.link ?? "");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The invitation could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function changeLink(action: "link" | "unlink") {
    if (busy) return;
    setBusy("link");
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      await post({ action, email: linkEmail, customerId: linkCustomerId });
      setNotice(action === "link"
        ? `${linkEmail} can now also see ${customerNames.get(linkCustomerId) ?? linkCustomerId}.`
        : `${linkEmail} can no longer see ${customerNames.get(linkCustomerId) ?? linkCustomerId}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The linked customer could not be changed.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(account: PortalAccountSummary) {
    if (busy) return;
    setBusy(account.email);
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      await post({ action: account.active ? "deactivate" : "activate", email: account.email });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portal account could not be updated.");
    } finally {
      setBusy("");
    }
  }

  const activeAccounts = accounts.filter((account) => account.active).length;
  const neverSignedIn = accounts.filter((account) => !account.bound).length;

  return (
    <OpsPage>
      <OpsPageHeader
        title="Customer Portal Access"
        description="Read-only customer logins for their own shipments, released documents and invoices. Portal accounts are separate from staff accounts."
        meta={<span>{accounts.length} portal account{accounts.length === 1 ? "" : "s"} · {activeAccounts} active</span>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6 org-stack">
        <OpsKpiRail label="Portal account summary">
          <OpsRailMetric label="Portal accounts" value={accounts.length}/>
          <OpsRailMetric label="Active" value={activeAccounts}/>
          <OpsRailMetric label="Disabled" value={accounts.length - activeAccounts}/>
          <OpsRailMetric label="Never signed in" value={neverSignedIn} tone={neverSignedIn ? "warning" : "neutral"}/>
        </OpsKpiRail>

        {notice || error || inviteLink ? <div className="org-stack org-notices">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
          {inviteLink ? <OpsNotice tone="warning" onDismiss={() => setInviteLink("")}><span className="ops-mono portal-invite">{inviteLink}</span></OpsNotice> : null}
        </div> : null}

        <div className="org-grid">
          <OpsSurface density="compact" title="Grant portal access" description="The contact receives a Firebase link to set their own password. KCPL never sets or holds a customer password.">
            <form onSubmit={submit} aria-busy={Boolean(busy)}>
              <div className="ops-form-grid portal-grid">
                <OpsField label="Customer contact email" className="ops-form-full">
                  <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="contact@customer.com" disabled={busy === "save"}/>
                </OpsField>
                <OpsField label="Customer account">
                  <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={busy === "save"} required>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>)}
                  </select>
                </OpsField>
                <OpsField label="Access level" hint="Account owners also see invoices and can raise requests.">
                  <select value={role} onChange={(event) => setRole(event.target.value as PortalRole)} disabled={busy === "save"}>
                    {portalRoles.map((value) => <option key={value} value={value}>{portalRoleLabels[value]}</option>)}
                  </select>
                </OpsField>
              </div>
              <div className="ops-form-actions">
                <OpsButton type="submit" variant="primary" size="sm" disabled={busy === "save" || !customers.length}>
                  <UserPlus size={14} strokeWidth={1.75} aria-hidden="true"/>{busy === "save" ? "Saving…" : "Grant access"}
                </OpsButton>
              </div>
            </form>
          </OpsSurface>

          <OpsSurface density="compact" title="Linked customer accounts" description="Let one login see several KCPL customers, for an agent or group. Only Management can grant this; an account owner cannot link themselves to another company.">
            <form onSubmit={(event) => { event.preventDefault(); void changeLink("link"); }} aria-busy={busy === "link"}>
              <div className="ops-form-grid portal-grid">
                <OpsField label="Portal login" className="ops-form-full">
                  <select value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} disabled={busy === "link"} required>
                    <option value="">Choose a login…</option>
                    {accounts.map((account) => <option key={account.email} value={account.email}>{account.email}</option>)}
                  </select>
                </OpsField>
                <OpsField label="Customer account to link" className="ops-form-full">
                  <select value={linkCustomerId} onChange={(event) => setLinkCustomerId(event.target.value)} disabled={busy === "link"} required>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>)}
                  </select>
                </OpsField>
              </div>
              <div className="ops-form-actions">
                <OpsButton type="button" variant="ghost" size="sm" disabled={busy === "link" || !linkEmail || !linkCustomerId} onClick={() => void changeLink("unlink")}>Remove link</OpsButton>
                <OpsButton type="submit" variant="primary" size="sm" disabled={busy === "link" || !linkEmail || !linkCustomerId}>
                  <Building2 size={14} strokeWidth={1.75} aria-hidden="true"/>{busy === "link" ? "Saving…" : "Link customer"}
                </OpsButton>
              </div>
            </form>
          </OpsSurface>
        </div>

        <OpsSurface
          density="compact"
          title="Provisioned portal logins"
          description={`${rows.length} of ${accounts.length} shown.`}
          action={<OpsSearch className="org-surface-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email or customer…" aria-label="Search portal accounts"/>}
          flush
        >
          {rows.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table portal-table" aria-label="Portal accounts">
                <thead><tr><th>Contact</th><th>Customer</th><th>Access</th><th>State</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.email}>
                      <td><span className="ops-cell-primary ops-mono ops-cell-clamp" title={account.email}>{account.email}</span>{account.created_by_email ? <span className="ops-cell-secondary ops-cell-clamp">Added by {account.created_by_email}</span> : null}</td>
                      <td><span className="ops-cell-primary ops-cell-clamp">{account.customer_name || account.customer_id}</span>{account.additional_customer_ids.length ? <span className="ops-cell-secondary ops-cell-clamp" title={account.additional_customer_ids.map((id) => customerNames.get(id) ?? id).join(", ")}>Also sees {account.additional_customer_ids.map((id) => customerNames.get(id) ?? id).join(", ")}</span> : null}</td>
                      <td>{portalRoleLabels[account.role]}</td>
                      <td><OpsBadge tone={account.active ? "success" : "neutral"}>{account.active ? "Active" : "Disabled"}</OpsBadge><span className="ops-cell-secondary">{account.bound ? "Signed in before" : "Never signed in"}</span></td>
                      <td><span className="ops-cell-muted org-nowrap">{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString("en-GB") : "—"}</span></td>
                      <td className="ops-cell-actions">
                        <OpsButton size="xs" variant="secondary" disabled={busy === account.email} onClick={() => invite(account)}><KeyRound size={14} strokeWidth={1.75} aria-hidden="true"/>Send invite</OpsButton>
                        <OpsButton size="xs" variant={account.active ? "danger" : "secondary"} disabled={busy === account.email} onClick={() => toggle(account)}>{account.active ? "Disable" : "Enable"}</OpsButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <OpsEmptyState compact kind={query ? "search" : "setup"} icon={<Users2 size={16} strokeWidth={1.75} aria-hidden="true"/>} title={query ? "No matching portal accounts" : "No customer portal accounts yet"} description={query ? "Try a different email or customer name." : "Grant access above to let a customer contact track their own shipments without calling the operations team."}/>
          )}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
