"use client";

import { useMemo, useState, type FormEvent } from "react";
import { KeyRound, UserPlus, Users2 } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  OpsToolbar,
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

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) =>
      account.email.includes(needle) || account.customer_name.toLowerCase().includes(needle));
  }, [accounts, query]);

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

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Organisation"
        title="Customer Portal Access"
        description="Give a customer contact a read-only login to their own shipments, released documents and invoices. Portal accounts are separate from staff accounts and can never hold both."
        meta={<><span>{accounts.length} portal account{accounts.length === 1 ? "" : "s"}</span><span>{accounts.filter((account) => account.active).length} active</span></>}
      />

      <div className="ops-content">
        <div className="ops-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
          {inviteLink ? <OpsNotice tone="warning" onDismiss={() => setInviteLink("")}><OpsMono>{inviteLink}</OpsMono></OpsNotice> : null}

          <OpsSurface
            eyebrow="Provision"
            title="Grant portal access"
            description="The contact receives a Firebase link to set their own password. KCPL never sets or holds a customer password."
          >
            <form onSubmit={submit} className="portal-form" aria-busy={Boolean(busy)}>
              <div className="portal-form-grid">
                <OpsField label="Customer contact email">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="contact@customer.com"
                    disabled={busy === "save"}
                  />
                </OpsField>
                <OpsField label="Customer account">
                  <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={busy === "save"} required>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>
                    ))}
                  </select>
                </OpsField>
                <OpsField label="Access level" hint="Account owners also see invoices and can raise requests.">
                  <select value={role} onChange={(event) => setRole(event.target.value as PortalRole)} disabled={busy === "save"}>
                    {portalRoles.map((value) => <option key={value} value={value}>{portalRoleLabels[value]}</option>)}
                  </select>
                </OpsField>
              </div>
              <div className="portal-form-actions">
                <OpsButton type="submit" variant="primary" disabled={busy === "save" || !customers.length}>
                  <UserPlus size={15} strokeWidth={1.75} aria-hidden="true"/>
                  <span>{busy === "save" ? "Saving…" : "Grant access"}</span>
                </OpsButton>
              </div>
            </form>
          </OpsSurface>

          <OpsSurface eyebrow="Accounts" title="Provisioned portal logins" flush>
            <OpsToolbar>
              <OpsSearch
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email or customer…"
                aria-label="Search portal accounts"
              />
              <span className="portal-toolbar-count">{rows.length} shown</span>
            </OpsToolbar>

            {rows.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Customer</th>
                      <th>Access</th>
                      <th>State</th>
                      <th>Last sign-in</th>
                      <th><span className="portal-sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((account) => (
                      <tr key={account.email}>
                        <td>
                          <OpsMono>{account.email}</OpsMono>
                          {account.created_by_email ? <span className="portal-cell-detail">Added by {account.created_by_email}</span> : null}
                        </td>
                        <td>{account.customer_name || account.customer_id}</td>
                        <td>{portalRoleLabels[account.role]}</td>
                        <td>
                          <OpsBadge tone={account.active ? "success" : "neutral"} dot>{account.active ? "Active" : "Disabled"}</OpsBadge>
                          <span className="portal-cell-detail">{account.bound ? "Signed in before" : "Never signed in"}</span>
                        </td>
                        <td>{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString("en-GB") : "—"}</td>
                        <td>
                          <OpsButton size="sm" variant="secondary" disabled={busy === account.email} onClick={() => invite(account)}>
                            <KeyRound size={14} strokeWidth={1.75} aria-hidden="true"/>
                            <span>Send invite</span>
                          </OpsButton>
                          <OpsButton size="sm" variant={account.active ? "danger" : "secondary"} disabled={busy === account.email} onClick={() => toggle(account)}>
                            {account.active ? "Disable" : "Enable"}
                          </OpsButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind={query ? "search" : "setup"}
                  icon={<Users2 size={18}/>}
                  title={query ? "No matching portal accounts" : "No customer portal accounts yet"}
                  description={query
                    ? "Try a different email or customer name."
                    : "Grant access above to let a customer contact track their own shipments without calling the operations team."}
                />
              </div>
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
