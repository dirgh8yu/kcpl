import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { nepalOperationalDate } from "./invoice-effective-status";
import { canAccessBranchValue } from "./admin/branch-access-policy";
import { createDirectNotification } from "./admin/notifications/notification-centre.server";
import type { KcplStaffContext } from "./admin/staff-directory.server";
import { uploadShipmentDocument } from "./shipment-documents.server";
import {
  CARGO_CLAIMS,
  claimFilingFromInput,
  claimFromRecord,
  claimKindLabels,
  claimNoticeDue,
  claimNumber,
  claimSettlementFromInput,
  claimStatusLabels,
  type CargoClaim,
  type ClaimKind,
} from "./cargo-claims";

/*
 * Claims are one collection across shipments, so the register can list all
 * that are open; each carries its shipment, branch and customer. Photos are
 * stored as the shipment's documents, unreleased, and listed on the claim.
 */

type Actor = { name: string; email: string };
export type ClaimPhoto = { filename: string; contentType: string; data: ArrayBuffer };

function money(value: number, currency: string) { return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export async function readShipmentClaims(reference: string): Promise<CargoClaim[] | null> {
  if (!firebaseRuntimeConfigured() || !reference.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection(CARGO_CLAIMS).where("shipment_reference", "==", reference.trim().toUpperCase()).limit(50).get();
    return snapshot.docs.map((doc) => claimFromRecord(doc.id, doc.data() as Record<string, unknown>)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    console.error("KCPL claims read failed", error);
    return null;
  }
}

/**
 * Open a claim on a shipment, with its photos. The notice deadline is set
 * from the mode and the kind of claim; staff can move it once they have read
 * the contract.
 */
export async function createCargoClaim(reference: string, value: { kind: ClaimKind; description: string; noticed_on: string; claimed_amount: number | null; currency: string }, photos: ClaimPhoto[], reporter: Actor & { source: "customer" | "staff" }) {
  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(reference);
  const shipment = await shipmentRef.get();
  if (!shipment.exists) return { kind: "missing" as const };
  const customerId = typeof shipment.get("customer_id") === "string" ? shipment.get("customer_id") as string : null;
  const customer = customerId ? await db.collection("customers").doc(customerId).get() : null;
  const mode = typeof shipment.get("mode") === "string" ? shipment.get("mode") as string : "";
  const now = new Date();
  const number = claimNumber(now, randomBytes(4).toString("hex"));
  const ref = db.collection(CARGO_CLAIMS).doc();

  // Photos first, so the claim lists only the ones that saved.
  const photoIds: number[] = [];
  for (const [index, photo] of photos.entries()) {
    const stored = await uploadShipmentDocument(reference, {
      filename: `Claim ${number} photo ${index + 1} - ${photo.filename}`.slice(0, 200), contentType: photo.contentType, sizeBytes: photo.data.byteLength,
      documentType: "other", uploadedBy: reporter.name, uploadedByEmail: reporter.email, data: photo.data,
      source: reporter.source === "customer" ? "customer_portal" : "staff",
    }).catch(() => null);
    // The same photo already on the shipment is linked, not dropped.
    if ((stored?.kind === "created" || stored?.kind === "duplicate") && typeof stored.document?.id === "number" && !photoIds.includes(stored.document.id)) photoIds.push(stored.document.id);
  }

  const iso = now.toISOString();
  await ref.create({
    number, shipment_reference: reference, branch: shipment.get("primary_branch") ?? null, customer_id: customerId,
    customer_name: customer?.exists ? customer.get("display_name") ?? null : null, mode,
    kind: value.kind, description: value.description, noticed_on: value.noticed_on, claimed_amount: value.claimed_amount, currency: value.currency,
    status: "reported", notice_due: claimNoticeDue(mode, value.kind, value.noticed_on),
    against: null, against_name: null, filed_on: null, filed_reference: null,
    recovered_amount: null, compensation_amount: null, compensation_method: null, outcome_note: null,
    reported_by_name: reporter.name, reported_by_email: reporter.email, reported_source: reporter.source, photo_document_ids: photoIds,
    created_at: iso, updated_at: iso,
  });
  await shipmentRef.collection("job_activity").doc(`claim-${ref.id}`).create({
    type: "cargo_claim_reported", title: `${claimKindLabels[value.kind]} claim ${number} ${reporter.source === "customer" ? "reported by the customer" : "opened"}`,
    detail: value.description.slice(0, 160), actor_name: reporter.name, actor_email: reporter.email, created_at: iso,
  }).catch(() => undefined);

  // A customer's report goes in front of whoever runs the job.
  if (reporter.source === "customer") {
    const target = typeof shipment.get("job_assigned_to_email") === "string" ? shipment.get("job_assigned_to_email") as string : "";
    if (target.trim()) {
      await createDirectNotification({
        targetEmail: target, targetName: typeof shipment.get("job_assigned_to_name") === "string" ? shipment.get("job_assigned_to_name") as string : null,
        category: "shipments", severity: "warning", title: `${claimKindLabels[value.kind]} reported on ${reference}`,
        detail: `${reporter.name}: ${value.description.slice(0, 160)}. Give notice to the carrier or insurer by ${claimNoticeDue(mode, value.kind, value.noticed_on)}.`,
        actionPath: `/admin/jobs/${encodeURIComponent(reference)}?step=problems#shipment-claims`, parentReference: reference, sourceType: "operational", sourceId: ref.id,
      }).catch((error) => console.error("KCPL claim notification failed", error));
    }
  }
  return { kind: "created" as const, id: ref.id, number, photos: photoIds.length };
}

type ClaimMove =
  | { action: "file"; input: Record<string, unknown> }
  | { action: "settle"; input: Record<string, unknown> }
  | { action: "reject"; input: Record<string, unknown> }
  | { action: "withdraw"; input: Record<string, unknown> }
  | { action: "notice_due"; input: Record<string, unknown> };

/**
 * Move a claim on. Anyone on the Job File gives notice and files it; settling
 * or turning it down decides money, so it takes Accounts or Management.
 */
export async function moveCargoClaim(reference: string, id: string, move: ClaimMove, actor: Actor, context: KcplStaffContext) {
  const db = firebaseAdminDb();
  const ref = db.collection(CARGO_CLAIMS).doc(id);
  const today = nepalOperationalDate();
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists || doc.get("shipment_reference") !== reference) return { kind: "missing" as const };
    const claim = claimFromRecord(doc.id, doc.data() as Record<string, unknown>);
    const now = new Date().toISOString();
    let title = "";
    let detail: string | null = null;
    if (move.action === "file") {
      if (claim.status !== "reported") return { kind: "invalid_status" as const };
      const checked = claimFilingFromInput(move.input, claim, today);
      if (!checked.ok) return { kind: "invalid" as const, error: checked.error };
      transaction.update(ref, { ...checked.value, status: "filed", filed_by_name: actor.name, updated_at: now });
      title = `Claim ${claim.number} filed${checked.value.against_name ? ` with ${checked.value.against_name}` : ""}`;
      detail = checked.value.filed_reference;
    } else if (move.action === "notice_due") {
      if (claim.status !== "reported") return { kind: "invalid_status" as const };
      const due = typeof move.input.noticeDue === "string" ? move.input.noticeDue.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || (claim.noticed_on && due < claim.noticed_on)) return { kind: "invalid" as const, error: "date" as const };
      transaction.update(ref, { notice_due: due, updated_at: now });
      title = `Claim ${claim.number}: notice due ${due}`;
    } else if (move.action === "settle") {
      if (!context.permissions.canManageFinance) return { kind: "finance_only" as const };
      if (claim.status !== "reported" && claim.status !== "filed") return { kind: "invalid_status" as const };
      const checked = claimSettlementFromInput(move.input);
      if (!checked.ok) return { kind: "invalid" as const, error: checked.error };
      transaction.update(ref, { ...checked.value, status: "settled", settled_by_name: actor.name, settled_on: today, updated_at: now });
      title = `Claim ${claim.number} settled`;
      detail = [checked.value.recovered_amount ? `${money(checked.value.recovered_amount, claim.currency)} recovered` : "", checked.value.compensation_amount ? `${money(checked.value.compensation_amount, claim.currency)} to the customer` : ""].filter(Boolean).join(" · ") || null;
    } else if (move.action === "reject") {
      if (!context.permissions.canManageFinance) return { kind: "finance_only" as const };
      if (claim.status !== "reported" && claim.status !== "filed") return { kind: "invalid_status" as const };
      const reason = typeof move.input.reason === "string" ? move.input.reason.trim().slice(0, 500) : "";
      if (reason.length < 10) return { kind: "reason_required" as const };
      transaction.update(ref, { status: "rejected", outcome_note: reason, settled_by_name: actor.name, settled_on: today, updated_at: now });
      title = `Claim ${claim.number} not accepted`;
      detail = reason;
    } else {
      if (claim.status !== "reported" && claim.status !== "filed") return { kind: "invalid_status" as const };
      const reason = typeof move.input.reason === "string" ? move.input.reason.trim().slice(0, 300) : "";
      transaction.update(ref, { status: "withdrawn", outcome_note: reason || "Withdrawn at the customer's request", updated_at: now });
      title = `Claim ${claim.number} withdrawn`;
      detail = reason || null;
    }
    transaction.create(db.collection("shipments").doc(reference).collection("job_activity").doc(`claim-${id}-${Date.now()}`), {
      type: "cargo_claim_updated", title, detail, actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "updated" as const };
  });
}

/** The customer takes back a claim KCPL hasn't filed yet. */
export async function withdrawCustomerClaim(customerId: string, reference: string, id: string, actor: Actor) {
  const db = firebaseAdminDb();
  const ref = db.collection(CARGO_CLAIMS).doc(id);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists || doc.get("shipment_reference") !== reference || doc.get("customer_id") !== customerId) return { kind: "missing" as const };
    if (doc.get("status") !== "reported") return { kind: "invalid_status" as const };
    const now = new Date().toISOString();
    transaction.update(ref, { status: "withdrawn", outcome_note: "Withdrawn by the customer", updated_at: now });
    transaction.create(db.collection("shipments").doc(reference).collection("job_activity").doc(`claim-${id}-${Date.now()}`), {
      type: "cargo_claim_updated", title: `Claim ${text(doc.get("number"))} withdrawn by the customer`, detail: null, actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "updated" as const };
  });
}

function text(value: unknown) { return typeof value === "string" ? value : ""; }

/** Open claims in the viewer's branches, soonest notice first; and the last few closed. */
export async function loadClaimsRegister(context: KcplStaffContext): Promise<{ kind: "ready"; open: CargoClaim[]; closed: CargoClaim[] } | { kind: "unavailable" }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const [open, recent] = await Promise.all([
      db.collection(CARGO_CLAIMS).where("status", "in", ["reported", "filed"]).limit(1000).get(),
      db.collection(CARGO_CLAIMS).where("updated_at", ">=", new Date(Date.now() - 90 * 86_400_000).toISOString()).orderBy("updated_at", "desc").limit(100).get(),
    ]);
    const visible = (claim: CargoClaim) => canAccessBranchValue(context, claim.branch);
    return {
      kind: "ready",
      open: open.docs.map((doc) => claimFromRecord(doc.id, doc.data() as Record<string, unknown>)).filter(visible),
      closed: recent.docs.map((doc) => claimFromRecord(doc.id, doc.data() as Record<string, unknown>)).filter((claim) => visible(claim) && !["reported", "filed"].includes(claim.status)).slice(0, 20),
    };
  } catch (error) {
    console.error("KCPL claims register failed", error);
    return { kind: "unavailable" };
  }
}

export { claimStatusLabels };
