"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, UserPlus, UsersRound, X } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { kcplStaffRoleLabels, kcplStaffRoles, type KcplStaffRole } from "../staff-permissions";
import type { KcplStaffProfile } from "../staff-directory";
import { OpsActiveFilters, OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsFilterSelect, OpsInspectorHeader, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsSearch, OpsTableWrap } from "../operations-ui";

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

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

const emptyDraft: Draft = { email: "", displayName: "", jobTitle: "", phone: "", role: "operations", branchScope: "selected", branches: ["Kathmandu"], active: true };

export function StaffManager({ initialProfiles }: { initialProfiles: KcplStaffProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | KcplStaffRole>("all");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
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
    setEditingUid(profile.uid);
    revealPanel();
  }

  function startNew() { setDraft(emptyDraft); setNotice(""); setEditingUid("new"); revealPanel(); }
  function closePanel() { setEditingUid(null); }

  // Stacked layouts put the inspector under the register; bring it into view.
  function revealPanel() {
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  // Escape closes the inspector, as it does on the other registers.
  const panelOpen = editingUid !== null;
  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      setEditingUid(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelOpen]);

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
      setDraft(emptyDraft); setEditingUid("new"); setNotice(`${data.profile.display_name} saved.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the staff profile."); }
    finally { setBusy(false); }
  }

  const suspended = profiles.length - activeCount;
  const allBranchCount = profiles.filter((profile) => profile.branch_scope === "all").length;
  const compact = panelOpen;
  const filtersActive = Boolean(query.trim()) || roleFilter !== "all";

  return <OpsPage>
    <OpsPageHeader
      title="People & branches"
      description="Who can operate KCPL and where. Firebase Authentication owns credentials; this directory sets role and branch scope after sign-in."
      meta={<span>{profiles.length} staff profiles · {activeCount} active</span>}
      actions={<OpsButton variant="primary" onClick={startNew}><UserPlus size={16} strokeWidth={1.75} aria-hidden="true"/>Add staff</OpsButton>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsKpiRail label="Staff access summary">
        <OpsRailMetric label="Active staff" value={activeCount}/>
        <OpsRailMetric label="Suspended" value={suspended} tone={suspended ? "danger" : "neutral"}/>
        <OpsRailMetric label="All-branch access" value={allBranchCount}/>
        <OpsRailMetric label="Branches" value={kcplBranches.length}/>
      </OpsKpiRail>

      <OpsRegisterToolbar
        search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, role or branch" aria-label="Search staff"/>}
        actions={<>
          <OpsFilterSelect label="Role" value={roleFilter} allLabel="All roles" options={kcplStaffRoles.map((role) => ({ value: role, label: kcplStaffRoleLabels[role] }))} onChange={(value) => setRoleFilter(value as "all" | KcplStaffRole)}/>
          {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setRoleFilter("all"); }}>Reset</OpsButton> : null}
          <span className="ops-toolbar-divider" aria-hidden="true"/>
          <span className="ops-result-count" aria-live="polite">{filtered.length === profiles.length ? `${profiles.length} people` : `${filtered.length} of ${profiles.length}`}</span>
        </>}
      />
      <OpsActiveFilters chips={roleFilter !== "all" ? [{ key: "role", label: kcplStaffRoleLabels[roleFilter], title: `Role: ${kcplStaffRoleLabels[roleFilter]}`, onRemove: () => setRoleFilter("all") }] : []}/>

      <div className="ops-register-layout" data-inspector={panelOpen ? "open" : undefined}>
        <section className="ops-surface" aria-label="Staff access">
          {filtered.length ? <OpsTableWrap>
            <table className="ops-table ops-register-table staff-table" data-compact={compact || undefined} aria-label="Staff directory">
              <thead><tr><th>Person</th><th>Role</th><th>Branch access</th><th>Status</th>{compact ? null : <th>Title · phone</th>}</tr></thead>
              <tbody>{filtered.map((profile) => {
                const chosen = editingUid === profile.uid;
                return <tr key={profile.uid} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => edit(profile)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); edit(profile); } }}>
                  <td><span className="ops-cell-primary ops-cell-clamp" title={profile.display_name}>{profile.display_name}</span><span className="ops-cell-secondary ops-cell-clamp">{profile.email}</span></td>
                  <td><span className="ops-cell-primary">{kcplStaffRoleLabels[profile.role]}</span></td>
                  <td><span className="ops-cell-clamp" title={profile.branch_scope === "all" ? "All branches" : profile.branches.join(", ")}>{profile.branch_scope === "all" ? "All branches" : profile.branches.join(" · ") || "No branches"}</span></td>
                  <td><OpsBadge tone={profile.active ? "success" : "danger"}>{profile.active ? "Active" : "Suspended"}</OpsBadge></td>
                  {compact ? null : <td><span className="ops-cell-primary ops-cell-clamp">{profile.job_title || "KCPL Staff"}</span>{profile.phone ? <span className="ops-cell-secondary">{profile.phone}</span> : null}</td>}
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<UsersRound size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No staff match" description="Change the search or role filter. Existing bootstrap admins still work until staff profiles are added."/>}
          {filtered.length ? <footer className="ops-register-footer"><span>Select a person to edit role, branch scope or suspend access.</span></footer> : null}
        </section>

        {panelOpen ? <aside ref={panelRef} className="ops-inspector" aria-label={draft.email ? `Edit ${draft.displayName || draft.email}` : "Add staff"}>
          <OpsInspectorHeader
            kicker={editingUid === "new" ? "New access profile" : draft.email}
            title={editingUid === "new" ? "Add or update staff" : draft.displayName || draft.email}
            subtitle="The Firebase email must already exist in Authentication. Access changes never change the person’s password."
            actions={<button type="button" className="ops-inspector-close" onClick={closePanel} aria-label="Close staff inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
          />
          <form onSubmit={save} className="staff-form">
            <div className="ops-inspector-scroll">
              <div className="ops-inspector-body">
                {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
                <div className="ops-inspector-form">
                  <OpsField label="Firebase email" className="col-span-full"><input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></OpsField>
                  <OpsField label="Display name"><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}/></OpsField>
                  <OpsField label="Job title"><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })}/></OpsField>
                  <OpsField label="Phone" className="col-span-full"><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></OpsField>
                  <OpsField label="Role"><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as KcplStaffRole })}>{kcplStaffRoles.map((role) => <option key={role} value={role}>{kcplStaffRoleLabels[role]}</option>)}</select></OpsField>
                  <OpsField label="Branch access"><select value={draft.branchScope} onChange={(event) => setDraft({ ...draft, branchScope: event.target.value as "all" | "selected" })}><option value="all">All branches</option><option value="selected">Selected branches</option></select></OpsField>
                  {draft.branchScope === "selected" ? <div className="col-span-full staff-branches" role="group" aria-label="Allowed branches">
                    <span className="ops-field-label">Allowed branches</span>
                    <div className="ops-filter-choices">{kcplBranches.map((branch) => { const on = draft.branches.includes(branch); return <button key={branch} type="button" onClick={() => toggleBranch(branch)} className="ops-filter-choice staff-branch" data-active={on || undefined} aria-pressed={on}>{on ? <Check size={12} strokeWidth={2} aria-hidden="true"/> : null}{branch}</button>; })}</div>
                  </div> : <p className="col-span-full ops-inspector-hint">This person can operate records across every configured KCPL branch.</p>}
                  <label className="col-span-full staff-active"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/>Active account</label>
                </div>
              </div>
            </div>
            <footer className="ops-inspector-footer">
              <OpsButton type="button" variant="ghost" size="sm" onClick={() => { setDraft(emptyDraft); setEditingUid("new"); }}>Clear</OpsButton>
              <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save staff profile"}</OpsButton>
            </footer>
          </form>
        </aside> : null}
      </div>
    </div>
  </OpsPage>;
}
