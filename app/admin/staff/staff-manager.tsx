"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, CheckCircle2, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { kcplStaffRoleLabels, kcplStaffRoles, type KcplStaffRole } from "../staff-permissions";
import type { KcplStaffProfile } from "../staff-directory";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

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

const emptyDraft: Draft = { email: "", displayName: "", jobTitle: "", phone: "", role: "operations", branchScope: "selected", branches: ["Kathmandu"], active: true };

export function StaffManager({ initialProfiles }: { initialProfiles: KcplStaffProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | KcplStaffRole>("all");
  const activeCount = useMemo(() => profiles.filter((profile) => profile.active).length, [profiles]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (roleFilter !== "all" && profile.role !== roleFilter) return false;
      if (!needle) return true;
      return [profile.display_name, profile.email, profile.job_title ?? "", profile.phone ?? "", profile.role, ...profile.branches].join(" ").toLowerCase().includes(needle);
    });
  }, [profiles, query, roleFilter]);

  function edit(profile: KcplStaffProfile) {
    setDraft({ email: profile.email, displayName: profile.display_name, jobTitle: profile.job_title ?? "", phone: profile.phone ?? "", role: profile.role, branchScope: profile.branch_scope, branches: profile.branches, active: profile.active });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleBranch(branch: KcplBranch) {
    setDraft((current) => ({ ...current, branches: current.branches.includes(branch) ? current.branches.filter((item) => item !== branch) : [...current.branches, branch] }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { profile?: KcplStaffProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not save the staff profile.");
      setProfiles((current) => [...current.filter((item) => item.uid !== data.profile!.uid), data.profile!].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setDraft(emptyDraft); setNotice(`${data.profile.display_name} saved.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the staff profile."); }
    finally { setBusy(false); }
  }

  const suspended = profiles.length - activeCount;
  const allBranchCount = profiles.filter((profile) => profile.branch_scope === "all").length;

  return <OpsPage>
    <OpsPageHeader eyebrow="Administration" title="People & branches" description="Manage who can operate KCPL and where. Firebase Authentication owns credentials; this directory controls the role and branch scope applied after sign-in." meta={<><span>{profiles.length} staff profiles</span><span>{activeCount} active</span></>} />
    <OpsStatStrip><OpsStat label="Active staff" value={activeCount} icon={<CheckCircle2 size={13}/>} tone="success"/><OpsStat label="Suspended" value={suspended} tone={suspended ? "danger" : "neutral"}/><OpsStat label="All-branch access" value={allBranchCount} icon={<ShieldCheck size={13}/>} /><OpsStat label="Branches" value={kcplBranches.length}/></OpsStatStrip>

    <div className="ops-content-wide grid gap-4 xl:grid-cols-[minmax(320px,.72fr)_minmax(0,1.28fr)] xl:items-start">
      <OpsSurface eyebrow="Access profile" title={draft.email ? `Edit ${draft.displayName || draft.email}` : "Add or update staff"} description="The Firebase email must already exist in Authentication. Access changes here do not change the person’s password.">
        {notice ? <div className="mb-4"><OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
        <form onSubmit={save} className="grid gap-4">
          <OpsField label="Firebase email"><input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></OpsField>
          <div className="grid gap-3 sm:grid-cols-2"><OpsField label="Display name"><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}/></OpsField><OpsField label="Job title"><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })}/></OpsField></div>
          <OpsField label="Phone"><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></OpsField>
          <div className="grid gap-3 sm:grid-cols-2"><OpsField label="Role"><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as KcplStaffRole })}>{kcplStaffRoles.map((role) => <option key={role} value={role}>{kcplStaffRoleLabels[role]}</option>)}</select></OpsField><OpsField label="Branch access"><select value={draft.branchScope} onChange={(event) => setDraft({ ...draft, branchScope: event.target.value as "all" | "selected" })}><option value="all">All branches</option><option value="selected">Selected branches</option></select></OpsField></div>
          {draft.branchScope === "selected" ? <div><p className="mb-2 text-[9px] font-bold text-[#665c55]">Allowed branches</p><div className="flex flex-wrap gap-2">{kcplBranches.map((branch) => <button key={branch} type="button" onClick={() => toggleBranch(branch)} className="ops-badge" data-tone={draft.branches.includes(branch) ? "accent" : "neutral"}>{draft.branches.includes(branch) ? <Check size={10}/> : null}{branch}</button>)}</div></div> : <div className="rounded-[12px] bg-[#faf7f4] p-3 text-[9px] leading-5 text-[#80766e]">This person can operate records across every configured KCPL branch.</div>}
          <label className="flex items-center gap-2 text-[10px] font-semibold text-[#675e57]"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/>Active account</label>
          <div className="flex gap-2"><OpsButton variant="primary" disabled={busy}>{busy ? "Saving…" : "Save staff profile"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setDraft(emptyDraft)}>Clear</OpsButton></div>
        </form>
      </OpsSurface>

      <OpsSurface eyebrow="Directory" title="Staff access" description="Select a person to edit role, branch scope or suspend access." flush>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, role or branch"/><select className="ops-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | KcplStaffRole)}><option value="all">All roles</option>{kcplStaffRoles.map((role) => <option key={role} value={role}>{kcplStaffRoleLabels[role]}</option>)}</select></div>
        {filtered.length ? <div className="divide-y divide-[#eee7e1]">{filtered.map((profile) => <button type="button" key={profile.uid} onClick={() => edit(profile)} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-[#fcf8f4] sm:px-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efe4dc] text-[10px] font-bold text-[#8f5544]">{profile.display_name.trim().split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase() || "KC"}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[10px] text-[#514840]">{profile.display_name}</strong><OpsBadge tone={profile.active ? "success" : "danger"}>{profile.active ? "Active" : "Suspended"}</OpsBadge><OpsBadge tone="accent">{kcplStaffRoleLabels[profile.role]}</OpsBadge></div><p className="mt-1 text-[9px] text-[#877d75]">{profile.email}</p><p className="mt-1 text-[8px] text-[#9c928a]">{profile.job_title || "KCPL Staff"}{profile.phone ? ` · ${profile.phone}` : ""}</p><div className="mt-2 flex flex-wrap gap-1.5">{profile.branch_scope === "all" ? <OpsBadge>All branches</OpsBadge> : profile.branches.map((branch) => <OpsBadge key={branch}>{branch}</OpsBadge>)}</div></div><UserCog size={14} className="mt-1 shrink-0 text-[#a19890]"/></button>)}</div> : <OpsEmptyState icon={<UsersRound size={18}/>} title="No staff match" description="Change the search or role filter. Existing bootstrap admins still work until staff profiles are added."/>}
      </OpsSurface>
    </div>
  </OpsPage>;
}
