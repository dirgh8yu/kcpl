import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function branch(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }

export async function linkTmsOrderCustomer(orderId: string, customerId: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const orderRef = firebaseAdminDb().collection("transport_orders").doc(orderId.trim().toUpperCase());
  const customerRef = firebaseAdminDb().collection("customers").doc(customerId.trim().toUpperCase());
  const [order, customer] = await Promise.all([orderRef.get(), customerRef.get()]);
  if (!order.exists) return { kind: "missing_order" as const };
  if (!customer.exists || customer.get("archived") === true) return { kind: "missing_customer" as const };
  const orderBranch = branch(order.get("branch"));
  const customerBranch = branch(customer.get("primary_branch"));
  if (!orderBranch || !customerBranch) return { kind: "invalid_branch" as const };
  if (!staffCanAccessBranch(staff, orderBranch) || !staffCanAccessBranch(staff, customerBranch)) return { kind: "forbidden" as const };
  if (["tendering", "booked", "cancelled"].includes(text(order.get("status")))) return { kind: "locked" as const };

  const now = new Date().toISOString();
  const customerName = text(customer.get("display_name"), customer.id);
  const batch = firebaseAdminDb().batch();
  batch.update(orderRef, { customer_id: customer.id, customer_name: customerName, updated_at: now });
  batch.create(orderRef.collection("events").doc(`evt-${crypto.randomUUID()}`), {
    type: "customer_linked",
    title: `Customer linked: ${customerName}`,
    detail: customer.id,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "linked" as const, customerId: customer.id, customerName };
}
