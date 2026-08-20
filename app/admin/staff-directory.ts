import type { KcplBranch } from "./crm/crm-data";
import type { KcplStaffRole, StaffCapabilities } from "./staff-permissions";

export type KcplStaffProfile = {
  uid: string;
  email: string;
  display_name: string;
  job_title: string | null;
  phone: string | null;
  role: KcplStaffRole;
  branch_scope: "all" | "selected";
  branches: KcplBranch[];
  active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type KcplStaffContext = {
  profile: KcplStaffProfile;
  permissions: StaffCapabilities;
  can_access_all_branches: boolean;
  branches: KcplBranch[];
};

export type StaffProfileInput = {
  email: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  role: KcplStaffRole;
  branchScope: "all" | "selected";
  branches: KcplBranch[];
  active: boolean;
};
