"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { kcplStaffRoleLabels, kcplStaffRoles, type KcplStaffRole } from "../staff-permissions";
import type { KcplStaffProfile } from "../staff-directory";

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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const activeCount = useMemo(() => profiles.filter((profile) => profile.active).length, [profiles]);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  return <main className="min-h-screen bg-[#f4f1e9] text-[#10263f]">
    <header className="bg-[#0b1724] px-5 py-7 text-white lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Administration</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-black tracking-[-.04em]">Staff & branch access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Manage staff roles and which KCPL branches each person can operate. Firebase Authentication still owns the account credentials.</p></div>
          <div className="flex gap-2"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65">{activeCount} active</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65">{profiles.length} profiles</span></div>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-6 p-5 lg:grid-cols-[.78fr_1.22fr] lg:p-8">
      <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><UserCog size={18}/></span><div><h2 className="font-black">Add or update staff</h2><p className="mt-1 text-xs leading-5 text-black/45">The email must already exist in Firebase Authentication.</p></div></div>
        {notice ? <div className="mt-5 rounded-xl bg-[#fff8e8] p-3 text-xs font-bold text-[#6d5427]">{notice}</div> : null}
        <form onSubmit={save} className="mt-5 space-y-4">
          <Field label="Firebase email"><input required type="email" className="staff-input" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Display name"><input className="staff-input" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}/></Field><Field label="Job title"><input className="staff-input" value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })}/></Field></div>
          <Field label="Phone"><input className="staff-input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></Field>
          <Field label="Role"><select className="staff-input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as KcplStaffRole })}>{kcplStaffRoles.map((role) => <option key={role} value={role}>{kcplStaffRoleLabels[role]}</option>)}</select></Field>
          <Field label="Branch access"><select className="staff-input" value={draft.branchScope} onChange={(event) => setDraft({ ...draft, branchScope: event.target.value as "all" | "selected" })}><option value="all">All branches</option><option value="selected">Selected branches</option></select></Field>
          {draft.branchScope === "selected" ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{kcplBranches.map((branch) => <button key={branch} type="button" onClick={() => toggleBranch(branch)} className={`rounded-xl border px-3 py-2 text-xs font-black ${draft.branches.includes(branch) ? "border-[#10263f] bg-[#10263f] text-white" : "border-black/10 bg-[#faf9f5] text-black/50"}`}>{branch}</button>)}</div> : null}
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/> Active account</label>
          <div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save staff profile"}</button><button type="button" onClick={() => setDraft(emptyDraft)} className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Clear</button></div>
        </form>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#d4ad62]/15 p-2.5 text-[#9a732f]"><UsersRound size={18}/></span><div><h2 className="font-black">Staff directory</h2><p className="mt-1 text-xs leading-5 text-black/45">Click a profile to edit role, branches or suspend access.</p></div></div><ShieldCheck size={18} className="text-emerald-600"/></div>
        <div className="mt-5 space-y-3">{profiles.length ? profiles.map((profile) => <button type="button" key={profile.uid} onClick={() => edit(profile)} className="w-full rounded-2xl border border-black/10 p-4 text-left transition hover:bg-[#faf9f5]"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-sm">{profile.display_name}</strong>{profile.active ? <CheckCircle2 size={13} className="text-emerald-600"/> : <span className="rounded-full bg-rose-50 px-2 py-1 text-[8px] font-black uppercase text-rose-700">Suspended</span>}</div><p className="mt-1 text-xs text-black/45">{profile.email}</p><p className="mt-1 text-[10px] font-bold text-black/35">{profile.job_title || "KCPL Staff"}</p></div><span className="rounded-full bg-[#10263f] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.08em] text-white">{kcplStaffRoleLabels[profile.role]}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{profile.branch_scope === "all" ? <span className="rounded-full bg-[#f4f1e9] px-2.5 py-1 text-[9px] font-black">All branches</span> : profile.branches.map((branch) => <span key={branch} className="rounded-full bg-[#f4f1e9] px-2.5 py-1 text-[9px] font-black">{branch}</span>)}</div></button>) : <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/40">No staff profiles yet. Existing bootstrap admins still work until profiles are added.</div>}</div>
      </section>
    </div>
    <style jsx global>{`.staff-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:12px;background:#faf9f5;padding:11px 12px;font-size:14px;outline:none}.staff-input:focus{border-color:#b78a3e}`}</style>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">{label}</span>{children}</label>;
}
