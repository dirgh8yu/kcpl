import { firebaseAdminDb } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { tmsModes, type TmsMode } from "../rating/tms-rating";
import { buildDocumentIntelligence, defaultCustomsSteps, defaultWorkflowTasks } from "../workflow-defaults";

type Actor = { name: string; email: string };
type ArtifactKind = "standard" | "consolidation_master" | "consolidation_house";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function modeValue(value: unknown): TmsMode | null { return tmsModes.includes(value as TmsMode) ? value as TmsMode : null; }
function artifactKind(value: unknown): ArtifactKind | null {
  return ["standard", "consolidation_master", "consolidation_house"].includes(text(value)) ? text(value) as ArtifactKind : null;
}

export const TMS_BOOKING_ARTIFACT_SEED_VERSION = 2;

export async function ensureBookingArtifacts(referenceValue: string, fallbackActor: Actor) {
  const reference = referenceValue.trim().toUpperCase();
  if (!reference) throw new Error("booking_artifact_missing_reference");
  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(reference);
  const shipment = await shipmentRef.get();
  if (!shipment.exists) throw new Error("booking_artifact_missing_shipment");
  if (shipment.get("booking_artifact_seed_version") !== TMS_BOOKING_ARTIFACT_SEED_VERSION) return { kind: "legacy" as const };
  if (text(shipment.get("booking_artifacts_seeded_at"))) return { kind: "ready" as const };

  const branch = branchValue(shipment.get("primary_branch"));
  const mode = modeValue(shipment.get("mode"));
  const kind = artifactKind(shipment.get("booking_artifact_kind"));
  if (!branch || !mode || !kind) throw new Error("booking_artifact_invalid_shipment");

  const origin = text(shipment.get("origin"));
  const destination = text(shipment.get("destination"));
  const carrier = text(shipment.get("carrier"), "Carrier");
  const carrierReference = text(shipment.get("carrier_reference"));
  const loadId = nullable(shipment.get("consolidation_load_id"));
  const createdAt = text(shipment.get("created_at"), new Date().toISOString());
  const actor = {
    name: text(shipment.get("booking_actor_name"), fallbackActor.name || "KCPL Operations"),
    email: text(shipment.get("booking_actor_email"), fallbackActor.email),
  };
  const documentPlan = buildDocumentIntelligence({ mode, origin, destination, primaryBranch: branch });
  const eventNumericId = Math.max(1, Date.parse(createdAt) || Date.now());
  const batch = db.batch();

  const eventTitle = kind === "consolidation_master"
    ? "Consolidated booking confirmed"
    : kind === "consolidation_house"
      ? "Booking confirmed under consolidated load"
      : "Booking confirmed";
  const eventDetails = kind === "standard"
    ? `Booked with ${carrier}. Carrier / partner reference: ${carrierReference}.`
    : `${loadId ? `Consolidation ${loadId}. ` : ""}Booked with ${carrier}. Master / carrier reference: ${carrierReference}.`;
  batch.set(shipmentRef.collection("events").doc("booking-confirmed"), {
    id: eventNumericId,
    shipment_reference: reference,
    title: eventTitle,
    location: origin || null,
    details: eventDetails,
    event_time: createdAt,
    created_at: createdAt,
    author_name: actor.name || "KCPL Operations",
  }, { merge: true });

  defaultWorkflowTasks(mode, branch).forEach((task, index) => {
    batch.set(shipmentRef.collection("job_tasks").doc(`workflow-task-${index + 1}`), {
      title: task.title,
      detail: task.detail,
      branch: task.branch,
      due_at: null,
      assigned_to_uid: null,
      assigned_to_name: null,
      assigned_to_email: null,
      assigned_to_phone: null,
      completed: false,
      completed_at: null,
      completed_by: null,
      created_at: createdAt,
      created_by: actor.email || "workflow@kcpl.internal",
      workflow_seeded: true,
    }, { merge: true });
  });
  defaultCustomsSteps(mode, branch).forEach((step, index) => {
    batch.set(shipmentRef.collection("customs_steps").doc(`workflow-customs-${index + 1}`), {
      title: step.title,
      detail: step.detail,
      branch: step.branch,
      required: step.required,
      completed: false,
      completed_at: null,
      completed_by: null,
      created_at: createdAt,
      created_by: actor.email || "workflow@kcpl.internal",
      workflow_seeded: true,
    }, { merge: true });
  });
  for (const requirement of documentPlan.requirements) {
    batch.set(shipmentRef.collection("document_requirements").doc(requirement.documentType), {
      document_type: requirement.documentType,
      required: requirement.required,
      reason: requirement.reason,
      source: requirement.source,
      advisory: requirement.advisory === true,
      created_at: createdAt,
      updated_at: createdAt,
    }, { merge: true });
  }

  const activityTitle = kind === "consolidation_master"
    ? "Consolidated master booking confirmed"
    : kind === "consolidation_house"
      ? "Consolidated house booking confirmed"
      : "TMS booking confirmed";
  batch.set(shipmentRef.collection("job_activity").doc("booking-confirmed"), {
    type: kind === "standard" ? "tms_booking_confirmed" : kind === "consolidation_master" ? "consolidation_master_booking" : "consolidation_house_booking",
    title: activityTitle,
    detail: `${carrier} · ${carrierReference}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: createdAt,
  }, { merge: true });

  const customerId = text(shipment.get("customer_id")).toUpperCase();
  if (customerId) {
    const customerRef = db.collection("customers").doc(customerId);
    batch.set(customerRef.collection("activity").doc(`shipment-${reference}`), {
      type: "shipment_created",
      title: kind === "consolidation_house" ? `Consolidated shipment opened: ${reference}` : `Shipment opened from TMS booking: ${reference}`,
      detail: `${origin} → ${destination} · ${carrier}`,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: createdAt,
    }, { merge: true });
  }

  batch.update(shipmentRef, { booking_artifacts_seeded_at: new Date().toISOString() });
  await batch.commit();
  return { kind: "seeded" as const };
}
