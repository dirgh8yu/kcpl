import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function branchArray(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

export async function checkShipmentBranchAccess(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const shipment = await db.collection("shipments").doc(normalized).get();
  if (!shipment.exists) return { kind: "missing" as const };

  let primary = branchValue(shipment.get("primary_branch"));
  const customerId = typeof shipment.get("customer_id") === "string" ? shipment.get("customer_id") as string : "";
  if (!primary && customerId) {
    const customer = await db.collection("customers").doc(customerId).get();
    if (customer.exists) primary = branchValue(customer.get("primary_branch"));
  }
  primary ||= "Kathmandu";
  const handling = branchArray(shipment.get("handling_branches"));
  if (!handling.includes(primary)) handling.unshift(primary);

  const allowed = staff.can_access_all_branches
    || staffCanAccessBranch(staff, primary)
    || handling.some((branch) => staffCanAccessBranch(staff, branch));
  return allowed
    ? { kind: "allowed" as const, primaryBranch: primary, handlingBranches: handling }
    : { kind: "forbidden" as const };
}
