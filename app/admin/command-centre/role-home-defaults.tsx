"use client";

import { useLayoutEffect } from "react";
import type { KcplStaffRole } from "../staff-permissions";

type HomeSections = {
  attention: boolean;
  movement: boolean;
  branch: boolean;
  staff: boolean;
  recent: boolean;
};

const defaults: Record<KcplStaffRole, HomeSections> = {
  management: { attention: true, movement: true, branch: true, staff: true, recent: true },
  accounts: { attention: true, movement: true, branch: true, staff: false, recent: true },
  commercial: { attention: true, movement: true, branch: false, staff: false, recent: true },
  operations: { attention: true, movement: true, branch: true, staff: false, recent: true },
};

const sharedKey = "kcpl-ops-home-sections";
const roleMarkerKey = "kcpl-ops-home-role-v31";

export function RoleHomeDefaults({ role }: { role: KcplStaffRole }) {
  useLayoutEffect(() => {
    const previousRole = window.localStorage.getItem(roleMarkerKey) as KcplStaffRole | null;
    if (previousRole === role) return;

    const currentShared = window.localStorage.getItem(sharedKey);
    if (previousRole && currentShared) {
      window.localStorage.setItem(`${sharedKey}:${previousRole}`, currentShared);
    }

    const savedForRole = window.localStorage.getItem(`${sharedKey}:${role}`);
    window.localStorage.setItem(sharedKey, savedForRole || JSON.stringify(defaults[role]));
    window.localStorage.setItem(roleMarkerKey, role);
  }, [role]);

  return null;
}
