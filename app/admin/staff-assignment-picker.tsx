"use client";

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

type StaffAssignmentValue = {
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

async function loadOptions() {
  if (cachedOptions) return cachedOptions;
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
    loadOptions()
      .then((next) => { if (alive) { setOptions(next); setError(""); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Could not load the KCPL staff directory."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const eligible = useMemo(() => options.filter((option) => appliesToBranch(option, branch)), [branch, options]);
  const selected = useMemo(() => {
    const email = value.email.trim().toLowerCase();
    if (email) return options.find((option) => option.email.toLowerCase() === email) ?? null;
    const name = value.name.trim().toLowerCase();
    return name ? options.find((option) => option.display_name.toLowerCase() === name) ?? null : null;
  }, [options, value.email, value.name]);

  const selectValue = selected?.uid ?? (value.name || value.email ? "__current__" : "");

  function choose(uid: string) {
    if (!uid) {
      onChange({ name: "", email: "", phone: "" });
      return;
    }
    if (uid === "__current__") return;
    const option = options.find((item) => item.uid === uid);
    if (!option) return;
    onChange({ name: option.display_name, email: option.email, phone: option.phone ?? "" });
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
        {eligible.map((option) => (
          <option key={option.uid} value={option.uid}>
            {option.display_name}{option.job_title ? ` · ${option.job_title}` : ""}{option.phone ? ` · ${option.phone}` : ""}
          </option>
        ))}
      </select>

      {error ? <OpsNotice tone="warning">{error} You can still leave the current assignment unchanged.</OpsNotice> : null}

      {(selected || value.name || value.email || value.phone) ? (
        <div className={`rounded-[10px] border border-[#e9e2dc] bg-[#faf8f5] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-[#6f6760]">
            <span className="flex items-center gap-1.5 font-semibold text-[#514a44]"><UserRound size={11}/>{selected?.display_name || value.name || "Staff member"}</span>
            {(selected?.email || value.email) ? <span className="flex items-center gap-1.5"><Mail size={10}/>{selected?.email || value.email}</span> : null}
            {(selected?.phone || value.phone) ? <span className="flex items-center gap-1.5"><Phone size={10}/>{selected?.phone || value.phone}</span> : <span className="text-[#9a918a]">No phone saved</span>}
          </div>
          {selected ? <p className="mt-1.5 text-[9px] text-[#958c85]">{selected.job_title || "KCPL staff"} · {selected.branch_scope === "all" ? "All branches" : selected.branches.join(", ") || "No branch recorded"}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
