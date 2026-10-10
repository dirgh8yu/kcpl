import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { nepalOperationalDate } from "./invoice-effective-status";
import { canAccessBranchValue } from "./admin/branch-access-policy";
import type { KcplStaffContext } from "./admin/staff-directory.server";
import { readShipmentContainers } from "./shipment-containers.server";
import type { ShipmentContainer } from "./shipment-containers";
import {
  CONTAINER_DEPOSITS,
  depositFromInput,
  depositFromRecord,
  depositRefundFromInput,
  depositStage,
  expectedDepositDeduction,
  type ContainerDeposit,
  type DepositStage,
} from "./container-deposits";

/*
 * Deposits are one collection across shipments, so the register can list
 * every deposit still with a line. Each carries its shipment and branch; the
 * Job File shows a shipment's own.
 */

type Actor = { name: string; email: string };
const MAX_PER_SHIPMENT = 50;

function money(amount: number, currency: string) { return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

async function writeActivity(reference: string, id: string, title: string, detail: string | null, actor: Actor, transaction?: FirebaseFirestore.Transaction) {
  const db = firebaseAdminDb();
  const ref = db.collection("shipments").doc(reference).collection("job_activity").doc(`deposit-${id}-${Date.now()}`);
  const data = { type: "container_deposit", title, detail, actor_name: actor.name, actor_email: actor.email, created_at: new Date().toISOString() };
  if (transaction) transaction.create(ref, data);
  else await ref.create(data).catch(() => undefined);
}

export async function readShipmentDeposits(reference: string): Promise<ContainerDeposit[] | null> {
  if (!firebaseRuntimeConfigured() || !reference.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection(CONTAINER_DEPOSITS).where("shipment_reference", "==", reference.trim().toUpperCase()).limit(MAX_PER_SHIPMENT).get();
    return snapshot.docs.map((doc) => depositFromRecord(doc.id, doc.data() as Record<string, unknown>)).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  } catch (error) {
    console.error("KCPL deposits read failed", error);
    return null;
  }
}

/** Record a deposit paid to the line for some or all of a shipment's containers. */
export async function addContainerDeposit(reference: string, input: Record<string, unknown>, actor: Actor) {
  const containers = await readShipmentContainers(reference) ?? [];
  const checked = depositFromInput(input, containers.map((container) => container.number), nepalOperationalDate());
  if (!checked.ok) return { kind: "invalid" as const, error: checked.error };
  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(reference);
  const ref = db.collection(CONTAINER_DEPOSITS).doc();
  return db.runTransaction(async (transaction) => {
    const shipment = await transaction.get(shipmentRef);
    if (!shipment.exists) return { kind: "missing" as const };
    const customerId = typeof shipment.get("customer_id") === "string" ? shipment.get("customer_id") as string : "";
    const customer = customerId ? await transaction.get(db.collection("customers").doc(customerId)) : null;
    const now = new Date().toISOString();
    transaction.create(ref, {
      ...checked.value, shipment_reference: reference, branch: shipment.get("primary_branch") ?? null,
      customer_id: customerId || null, customer_name: customer?.exists ? customer.get("display_name") ?? null : null,
      status: "held", claimed_on: null, claim_reference: null, refunded_on: null, amount_refunded: null, deduction: null, deduction_reason: null, closed_note: null,
      created_by_name: actor.name, created_by_email: actor.email, created_at: now, updated_at: now,
    });
    const boxes = checked.value.container_numbers.length ? `${checked.value.container_numbers.length} container${checked.value.container_numbers.length === 1 ? "" : "s"}` : "every container";
    await writeActivity(reference, ref.id, `Container deposit paid to ${checked.value.shipping_line}`, `${money(checked.value.amount, checked.value.currency)} for ${boxes}`, actor, transaction);
    transaction.update(shipmentRef, { updated_at: now });
    return { kind: "added" as const, id: ref.id };
  });
}

type Move =
  | { action: "claim"; claimedOn?: unknown; claimReference?: unknown }
  | { action: "refund"; receivedOn?: unknown; amountReceived?: unknown; deductionReason?: unknown; note?: unknown }
  | { action: "write_off"; reason?: unknown }
  | { action: "reopen" };

/**
 * Move a deposit on: claimed from the line, refunded (Accounts or
 * Management, with what was kept back and why), or written off (Management).
 */
export async function moveContainerDeposit(reference: string, id: string, move: Move, actor: Actor, context: KcplStaffContext) {
  const db = firebaseAdminDb();
  const ref = db.collection(CONTAINER_DEPOSITS).doc(id);
  const today = nepalOperationalDate();
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists || doc.get("shipment_reference") !== reference) return { kind: "missing" as const };
    const deposit = depositFromRecord(doc.id, doc.data() as Record<string, unknown>);
    const now = new Date().toISOString();
    if (move.action === "claim") {
      if (deposit.status !== "held") return { kind: "invalid_status" as const };
      const on = typeof move.claimedOn === "string" && move.claimedOn.trim() ? move.claimedOn.trim() : today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || on > today || on < deposit.paid_on) return { kind: "invalid_date" as const };
      const claimReference = typeof move.claimReference === "string" && move.claimReference.trim() ? move.claimReference.trim().slice(0, 120) : null;
      transaction.update(ref, { status: "claimed", claimed_on: on, claim_reference: claimReference, claimed_by_name: actor.name, updated_at: now });
      await writeActivity(reference, id, `Deposit refund claimed from ${deposit.shipping_line}`, `${money(deposit.amount, deposit.currency)}${claimReference ? ` · ${claimReference}` : ""}`, actor, transaction);
      return { kind: "updated" as const };
    }
    if (move.action === "refund") {
      if (!context.permissions.canManageFinance) return { kind: "finance_only" as const };
      if (deposit.status !== "held" && deposit.status !== "claimed") return { kind: "invalid_status" as const };
      const checked = depositRefundFromInput(deposit, move as Record<string, unknown>, today);
      if (!checked.ok) return { kind: "invalid_refund" as const, error: checked.error };
      transaction.update(ref, { ...checked.value, status: "refunded", refunded_by_name: actor.name, refunded_by_email: actor.email, closed_at: now, updated_at: now });
      const kept = checked.value.deduction ? ` · ${money(checked.value.deduction, deposit.currency)} kept for ${checked.value.deduction_reason}` : "";
      await writeActivity(reference, id, `Deposit refunded by ${deposit.shipping_line}`, `${money(checked.value.amount_refunded, deposit.currency)} back${kept}`, actor, transaction);
      return { kind: "updated" as const };
    }
    if (move.action === "write_off") {
      if (context.permissions.role !== "management") return { kind: "management_only" as const };
      if (deposit.status === "refunded" || deposit.status === "written_off") return { kind: "invalid_status" as const };
      const reason = typeof move.reason === "string" ? move.reason.trim().slice(0, 300) : "";
      if (reason.length < 10) return { kind: "reason_required" as const };
      transaction.update(ref, { status: "written_off", closed_note: reason, written_off_by_name: actor.name, written_off_on: today, closed_at: now, updated_at: now });
      await writeActivity(reference, id, `Deposit with ${deposit.shipping_line} written off`, `${money(deposit.amount, deposit.currency)} · ${reason}`, actor, transaction);
      return { kind: "updated" as const };
    }
    // A claim marked by mistake goes back to held.
    if (deposit.status !== "claimed") return { kind: "invalid_status" as const };
    transaction.update(ref, { status: "held", claimed_on: null, claim_reference: null, updated_at: now });
    await writeActivity(reference, id, `Deposit claim with ${deposit.shipping_line} taken back`, null, actor, transaction);
    return { kind: "updated" as const };
  });
}

export type DepositRegisterRow = {
  deposit: ContainerDeposit;
  stage: DepositStage;
  expected: ReturnType<typeof expectedDepositDeduction>;
};

/** Every deposit still with a line, in the viewer's branches, with where it stands; and the last few closed. */
export async function loadDepositRegister(context: KcplStaffContext): Promise<{ kind: "ready"; open: DepositRegisterRow[]; closed: ContainerDeposit[] } | { kind: "unavailable" }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const [open, closed] = await Promise.all([
      db.collection(CONTAINER_DEPOSITS).where("status", "in", ["held", "claimed"]).limit(1000).get(),
      // Closed in the last 90 days, newest first: one field, so no composite index.
      db.collection(CONTAINER_DEPOSITS).where("closed_at", ">=", new Date(Date.now() - 90 * 86_400_000).toISOString()).orderBy("closed_at", "desc").limit(20).get(),
    ]);
    const deposits = open.docs.map((doc) => depositFromRecord(doc.id, doc.data() as Record<string, unknown>)).filter((deposit) => canAccessBranchValue(context, deposit.branch));
    const references = [...new Set(deposits.map((deposit) => deposit.shipment_reference))];
    const containers = new Map<string, ShipmentContainer[]>();
    for (let index = 0; index < references.length; index += 20) {
      const batch = references.slice(index, index + 20);
      const lists = await Promise.all(batch.map((reference) => readShipmentContainers(reference)));
      batch.forEach((reference, position) => containers.set(reference, lists[position] ?? []));
    }
    const today = nepalOperationalDate();
    const rows = deposits.map((deposit) => {
      const boxes = containers.get(deposit.shipment_reference) ?? [];
      return { deposit, stage: depositStage(deposit, boxes, today), expected: expectedDepositDeduction(deposit, boxes, today) };
    });
    return {
      kind: "ready",
      open: rows,
      closed: closed.docs.map((doc) => depositFromRecord(doc.id, doc.data() as Record<string, unknown>)).filter((deposit) => canAccessBranchValue(context, deposit.branch)),
    };
  } catch (error) {
    console.error("KCPL deposit register failed", error);
    return { kind: "unavailable" };
  }
}
