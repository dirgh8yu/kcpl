"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Search, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { kcplStaffRoleLabels, kcplStaffRoles, type KcplStaffRole } from "../staff-permissions";
import type { KcplStaffProfile } from "../staff-directory";
import { OpsButton, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPageHeader, OpsPanel, OpsStatusBadge, OpsTableFrame } from "../operations-ui";

type Draft = {
  email: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  role: KcplStaffRole;
  branchScope: "all" | "selected";
  branches: KcplBranch[];
  active: boolean;
};

const emptyDraft: Draft = {
  email: "",
  displayName: "",
  jobTitle: "",
  phone: "",
  role: "operations",
  branchScope: "selected",
  branches: ["Kathmandu"],
  active: true,
};

export function StaffManager({ initialProfiles }: { initialProfiles: KcplStaffProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const activeCount = useMemo(() => profiles.filter((profile) => profile.active).length, [profiles]);
  const managementCount = useMemo(() => profiles.filter((profile) => profile.role === "management" && profile.active).length, [profiles]);
  const allBranchCount = useMemo(() => profiles.filter((profile) => profile.branch_scope === "all" && profile.active).length, [profiles]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) => [profile.display_name, profile.email, profile.job_title ?? "", profile.role, profile.branch_scope, profile.branches.join(" ")].join(" ").toLowerCase().includes(needle));
  }, [profiles, query]);

  function edit(profile: KcplStaffProfile) {
    setDraft({
      email: profile.email,
      displayName: profile.display_name,
      jobTitle: profile.job_title ?? "",
      phone: profile.phone ?? "",
      role: profile.role,
      branchScope: profile.branch_scope,
      branches: profile.branches,
      active: profile.active,
    });
    setNotice("");
  }

  function toggleBranch(branch: KcplBranch) {
    setDraft((current) => ({
      ...current,
      branches: current.branches.includes(branch)
        ? current.branches.filter((item) => item !== branch)
        : [...current.branches, branch],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json() as { profile?: KcplStaffProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not save the staff profile.");
      setProfiles((current) => [...current.filter((item) => item.uid !== data.profile!.uid), data.profile!].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setDraft(emptyDraft);
      setNotice(`${data.profile.display_name} saved.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the staff profile.");
    } finally {
      setBusy(false);
    }
  }

  return <main>
    <OpsPageHeader
      eyebrow="Administration"
      title="Staff & branch access"
      description="Manage KCPL staff roles and operating scope. Firebase Authentication continues to own account credentials."
      breadcrumbs={[{ label: "Network" }, { label: "Staff & branches" }]}
      actions={<OpsButton onClick={() => { setDraft(emptyDraft); setNotice(""); }}><UserCog size={13}/>New profile</OpsButton>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Staff profiles" value={profiles.length} icon={<UsersRound size={13}/>}/>
        <OpsMetric label="Active" value={activeCount} icon={<CheckCircle2 size={13}/>} tone="success"/>
        <OpsMetric label="Management" value={managementCount} icon={<ShieldCheck size={13}/>}/>
        <OpsMetric label="All-branch access" value={allBranchCount} icon={<ShieldCheck size={13}/>} tone={allBranchCount ? "warning" : "neutral"}/>
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <OpsPanel title={draft.email ? "Edit staff access" : "Add staff access"} eyebrow="Profile editor" description="The email must already exist in Firebase Authentication.">
          <form onSubmit={save} className="space-y-3 p-4">
            <Field label="Firebase email"><input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Field label="Display name"><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}/></Field><Field label="Job title"><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })}/></Field></div>
            <Field label="Phone"><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></Field>
            <Field label="Role"><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as KcplStaffRole })}>{kcplStaffRoles.map((role) => <option key={role} value={role}>{kcplStaffRoleLabels[role]}</option>)}</select></Field>
            <Field label="Branch access"><select value={draft.branchScope} onChange={(event) => setDraft({ ...draft, branchScope: event.target.value as "all" | "selected" })}><option value="all">All branches</option><option value="selected">Selected branches</option></select></Field>
            {draft.branchScope === "selected" ? <div><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">Allowed branches</span><div className="flex flex-wrap gap-1.5">{kcplBranches.map((branch) => <button key={branch} type="button" onClick={() => toggleBranch(branch)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${draft.branches.includes(branch) ? "border-[#dce0fa] bg-[#f1f3ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#737b84]"}`}>{branch}</button>)}</div></div> : <div className="rounded-lg border border-[#eadfca] bg-[#fbf7ef] px-3 py-2 text-[10px] leading-4 text-[#806134]">All-branch access exposes company-wide operational data. Use it only when the staff role requires it.</div>}
            <label className="flex items-center gap-2 text-[11px] font-medium text-[#59616a]"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/>Active account</label>
            <div className="flex justify-end gap-2 border-t border-[#eceef0] pt-3"><OpsButton type="button" onClick={() => setDraft(emptyDraft)}>Clear</OpsButton><OpsButton tone="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</OpsButton></div>
          </form>
        </OpsPanel>

        <OpsTableFrame toolbar={<div className="flex flex-wrap items-center gap-3"><div><h2 className="text-xs font-semibold text-[#30363d]">Staff directory</h2><p className="mt-0.5 text-[10px] text-[#8c939b]">Click a row to edit role, branches or account status.</p></div><label className="ops-search-field ml-auto"><Search size={13} className="text-[#8b9299]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff, role or branch"/></label></div>} footer={<span>{filtered.length} of {profiles.length} profiles</span>}>
          {filtered.length ? <table className="ops-dense-table min-w-[850px]"><thead><tr><th className="px-4 text-left">Staff</th><th className="px-3 text-left">Role</th><th className="px-3 text-left">Branch access</th><th className="px-3 text-left">Phone</th><th className="px-4 text-right">Status</th></tr></thead><tbody>{filtered.map((profile) => <tr key={profile.uid} onClick={() => edit(profile)} className="cursor-pointer"><td className="px-4"><strong className="font-medium text-[#30363d]">{profile.display_name}</strong><p className="mt-0.5 text-[10px] text-[#9299a0]">{profile.email}{profile.job_title ? ` · ${profile.job_title}` : ""}</p></td><td className="px-3"><OpsStatusBadge tone={profile.role === "management" ? "accent" : profile.role === "accounts" ? "info" : "neutral"}>{kcplStaffRoleLabels[profile.role]}</OpsStatusBadge></td><td className="px-3">{profile.branch_scope === "all" ? <OpsStatusBadge tone="warning">All branches</OpsStatusBadge> : <div className="flex flex-wrap gap-1">{profile.branches.map((branch) => <OpsStatusBadge key={branch}>{branch}</OpsStatusBadge>)}</div>}</td><td className="px-3 text-[#69717a]">{profile.phone || "—"}</td><td className="px-4 text-right">{profile.active ? <OpsStatusBadge tone="success">Active</OpsStatusBadge> : <OpsStatusBadge tone="danger">Suspended</OpsStatusBadge>}</td></tr>)}</tbody></table> : <OpsEmptyState title="No staff profiles match" detail={profiles.length ? "Try a different name, role or branch." : "Existing bootstrap administrators still work until profiles are added."}/>} 
        </OpsTableFrame>
      </div>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>;
}
