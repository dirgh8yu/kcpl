import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchSet } from "../branch-access-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import { getPartnerRecord } from "../partners/partners.server";
import { customsClearanceStatusValue, customsClearanceValidationError } from "./customs-policy";
import type { CustomsClearanceInput, CustomsClearanceRecord } from "./customs-clearance";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function activityId() {
  return `customs-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export function customsClearanceFromShipment(snapshot: FirebaseFirestore.DocumentSnapshot): CustomsClearanceRecord {
  return {
    status: customsClearanceStatusValue(snapshot.get("customs_clearance_status")),
    entry_point: nullable(snapshot.get("customs_entry_point")),
    declaration_reference: nullable(snapshot.get("customs_declaration_reference")),
    agent_partner_id: nullable(snapshot.get("customs_agent_partner_id")),
    agent_name: nullable(snapshot.get("customs_agent_name")),
    hold_reason: nullable(snapshot.get("customs_hold_reason")),
    release_evidence: nullable(snapshot.get("customs_release_evidence")),
    released_at: nullable(snapshot.get("customs_released_at")),
    updated_at: nullable(snapshot.get("customs_clearance_updated_at")),
    updated_by_name: nullable(snapshot.get("customs_clearance_updated_by_name")),
    updated_by_email: nullable(snapshot.get("customs_clearance_updated_by_email")),
  };
}

export async function updateCustomsClearance(
  reference: string,
  input: CustomsClearanceInput,
  actor: Actor,
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageJobFile) return { kind: "forbidden" as const };

  const shipment = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();
  if (!shipment.exists) return { kind: "missing" as const };
  if (!canAccessBranchSet(context, shipment.get("primary_branch"), shipment.get("handling_branches"))) return { kind: "forbidden" as const };

  const validationError = customsClearanceValidationError(input);
  if (validationError) return { kind: "invalid" as const, error: validationError };

  let agentName: string | null = null;
  const agentPartnerId = input.agentPartnerId.trim().toUpperCase();
  if (agentPartnerId) {
    const partner = await getPartnerRecord(agentPartnerId, context);
    if (partner.kind === "unavailable") return { kind: "unavailable" as const };
    if (partner.kind === "missing") return { kind: "agent_missing" as const };
    if (partner.kind === "forbidden") return { kind: "forbidden" as const };
    const types = partner.partner.types;
    if (!types.includes("customs_agent") && !types.includes("clearing_partner")) return { kind: "agent_type" as const };
    agentName = partner.partner.display_name;
  }

  const previous = customsClearanceFromShipment(shipment);
  const now = new Date().toISOString();
  const releasedAt = input.status === "released"
    ? previous.status === "released" && previous.released_at ? previous.released_at : now
    : previous.released_at;
  const update = {
    customs_clearance_status: input.status,
    customs_entry_point: input.entryPoint.trim() || null,
    customs_declaration_reference: input.declarationReference.trim() || null,
    customs_agent_partner_id: agentPartnerId || null,
    customs_agent_name: agentName,
    customs_hold_reason: input.status === "held" ? input.holdReason.trim() : null,
    customs_release_evidence: input.releaseEvidence.trim() || null,
    customs_released_at: releasedAt,
    customs_clearance_updated_at: now,
    customs_clearance_updated_by_name: actor.name,
    customs_clearance_updated_by_email: actor.email,
    updated_at: now,
  };
  await shipment.ref.update(update);

  const detailParts = [`Status ${previous.status.replaceAll("_", " ")} → ${input.status.replaceAll("_", " ")}.`];
  if (input.entryPoint.trim()) detailParts.push(`Point: ${input.entryPoint.trim()}.`);
  if (input.declarationReference.trim()) detailParts.push(`Reference: ${input.declarationReference.trim()}.`);
  if (agentName) detailParts.push(`Agent: ${agentName}.`);
  if (input.status === "held" && input.holdReason.trim()) detailParts.push(`Hold: ${input.holdReason.trim()}`);
  if (input.status === "released" && input.releaseEvidence.trim()) detailParts.push(`Evidence: ${input.releaseEvidence.trim()}`);
  await shipment.ref.collection("job_activity").doc(activityId()).create({
    type: "customs_clearance",
    title: input.status === "released" ? "Customs release recorded" : input.status === "held" ? "Customs hold recorded" : "Customs clearance updated",
    detail: detailParts.join(" "),
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });

  const saved = await shipment.ref.get();
  return { kind: "updated" as const, clearance: customsClearanceFromShipment(saved) };
}
