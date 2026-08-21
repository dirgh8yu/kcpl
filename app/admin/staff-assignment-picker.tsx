"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import { OpsNotice } from "./operations-ui";

export type StaffAssignmentOption = {
  uid: string;
  display_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: string;
  branch_scope: "all" | "selected";
  branches: string[];
};

export type StaffAssignmentValue = {
  uid?: string;
  name: string;
  email: string;
  phone: string;
};

type Props = {
  value: StaffAssignmentValue;
  onChange: (value: StaffAssignmentValue) => void;
  branch?: string;
  allowUnassigned?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

let cachedOptions: StaffAssignmentOption[] | null = null;
let pendingOptions: Promise<StaffAssignmentOption[]> | null = null;

async function loadOptions(force = false) {
  if (!force && cachedOptions) return cachedOptions;
  if (pendingOptions) return pendingOptions;
  pendingOptions = fetch("/api/admin/staff/options", { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json() as { options?: StaffAssignmentOption[]; error?: string };
      if (!response.ok || !data.options) throw new Error(data.error || "Could not load the KCPL staff directory.");
      cachedOptions = data.options;
      return data.options;
    })
    .finally(() => { pendingOptions = null; });
  return pendingOptions;
}

function appliesToBranch(option: StaffAssignmentOption, branch?: string) {
  if (!branch) return true;
  if (option.branch_scope === "all") return true;
  return option.branches.includes(branch);
}

export function StaffAssignmentPicker({ value, onChange, branch, allowUnassigned = true, disabled = false, compact = false }: Props) {
  const [options, setOptions] = useState<StaffAssignmentOption[]>(cachedOptions ?? []);
  const [loading, setLoading] = useState(!cachedOptions);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    loadOptions(true)
      .then((next) => { if (alive) { setOptions(next); setError(""); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Could not load the KCPL staff directory."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const eligible = useMemo(() => options.filter((option) => appliesToBranch(option, branch)), [branch, options]);
  const selected = useMemo(() => {
    const uid = value.uid?.trim();
    if (uid) {
      const byUid = options.find((option) => option.uid === uid);
      if (byUid) return byUid;
    }
    const email = value.email.trim().toLowerCase();
    if (email) return options.find((option) => option.email.toLowerCase() === email) ?? null;
    const name = value.name.trim().toLowerCase();
    return name ? options.find((option) => option.display_name.toLowerCase() === name) ?? null : null;
  }, [options, value.email, value.name, value.uid]);

  useEffect(() => {
    if (!selected) return;
    const canonical = { uid: selected.uid, name: selected.display_name, email: selected.email, phone: selected.phone ?? "" };
    if (value.uid === canonical.uid && value.name === canonical.name && value.email === canonical.email && value.phone === canonical.phone) return;
    onChange(canonical);
  }, [onChange, selected, value.email, value.name, value.phone, value.uid]);

  const visibleOptions = useMemo(() => {
    if (!selected || eligible.some((option) => option.uid === selected.uid)) return eligible;
    return [selected, ...eligible];
  }, [eligible, selected]);
  const selectValue = selected?.uid ?? (value.name || value.email ? "__current__" : "");

  function choose(uid: string) {
    if (!uid) {
      onChange({ uid: "", name: "", email: "", phone: "" });
      return;
    }
    if (uid === "__current__") return;
    const option = options.find((item) => item.uid === uid);
    if (!option) return;
    onChange({ uid: option.uid, name: option.display_name, email: option.email, phone: option.phone ?? "" });
  }

  return (
    <div className="grid gap-2">
      <select
        value={selectValue}
        onChange={(event) => choose(event.target.value)}
        disabled={disabled || loading}
        aria-label="Choose staff member from KCPL staff directory"
      >
        {allowUnassigned ? <option value="">Unassigned</option> : null}
        {selectValue === "__current__" ? <option value="__current__">{value.name || value.email} · current assignment</option> : null}
        {visibleOptions.map((option) => (
          <option key={option.uid} value={option.uid}>
            {option.display_name}{option.job_title ? ` · ${option.job_title}` : ""}{option.phone ? ` · ${option.phone}` : ""}{branch && !appliesToBranch(option, branch) ? " · outside selected branch" : ""}
          </option>
        ))}
      </select>

      {error ? <OpsNotice tone="warning">{error} You can still leave the current assignment unchanged.</OpsNotice> : null}

      {(selected || value.name || value.email || value.phone) ? (
        <div className={`rounded-[10px] border border-[#e9e2dc] bg-[#faf8f5] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-[#6f6760]">
            {selected ? (
              <Link href={`/admin/workload/${encodeURIComponent(selected.uid)}`} className="flex items-center gap-1.5 font-semibold text-[#514a44] hover:text-[#a45747] hover:underline">
                <UserRound size={11}/>{selected.display_name}
              </Link>
            ) : <span className="flex items-center gap-1.5 font-semibold text-[#514a44]"><UserRound size={11}/>{value.name || "Staff member"}</span>}
            {(selected?.email || value.email) ? <a href={`mailto:${selected?.email || value.email}`} className="flex items-center gap-1.5 hover:text-[#a45747] hover:underline"><Mail size={10}/>{selected?.email || value.email}</a> : null}
            {(selected?.phone || value.phone) ? <a href={`tel:${selected?.phone || value.phone}`} className="flex items-center gap-1.5 hover:text-[#a45747] hover:underline"><Phone size={10}/>{selected?.phone || value.phone}</a> : <span className="text-[#9a918a]">No phone saved</span>}
          </div>
          {selected ? <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[9px] text-[#958c85]"><span>{selected.job_title || "KCPL staff"}</span><span>·</span>{selected.branch_scope === "all" ? <span>All branches</span> : selected.branches.length ? selected.branches.map((staffBranch, index) => <span key={staffBranch} className="inline-flex items-center gap-1">{index ? <span>·</span> : null}<Link href={`/admin/branches/${encodeURIComponent(staffBranch)}`} className="hover:text-[#a45747] hover:underline">{staffBranch}</Link></span>) : <span>No branch recorded</span>}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
