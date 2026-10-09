/*
 * Overseas agents and partners: who sees what. A partner login belongs to
 * one partner record, and sees only the shipments KCPL staff have put that
 * partner on, in the role they were given. The rules only.
 */

export const partnerShipmentRoles = ["origin_agent", "destination_agent", "carrier", "trucker", "customs_agent", "other"] as const;
export type PartnerShipmentRole = (typeof partnerShipmentRoles)[number];

export const partnerShipmentRoleLabels: Record<PartnerShipmentRole, string> = {
  origin_agent: "Origin agent",
  destination_agent: "Destination agent",
  carrier: "Carrier",
  trucker: "Trucker",
  customs_agent: "Customs agent",
  other: "Partner",
};

/** The milestones partners post most; anything else is written in. */
export const partnerMilestonePresets = [
  "Cargo received at origin",
  "Loaded",
  "Departed",
  "Arrived",
  "Customs cleared",
  "Out for delivery",
  "Handed over",
] as const;

export type PartnerShipmentAccess = { partner_id: string; partner_name: string; role: PartnerShipmentRole; added_at: string; added_by: string };

export function normalizePartnerEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function partnerEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function partnerShipmentAccessFromRecord(value: unknown): PartnerShipmentAccess[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const id = typeof row.partner_id === "string" ? row.partner_id.trim() : "";
    if (!id) return [];
    return [{
      partner_id: id,
      partner_name: typeof row.partner_name === "string" ? row.partner_name : "Partner",
      role: partnerShipmentRoles.includes(row.role as PartnerShipmentRole) ? row.role as PartnerShipmentRole : "other",
      added_at: typeof row.added_at === "string" ? row.added_at : "",
      added_by: typeof row.added_by === "string" ? row.added_by : "",
    }];
  });
}

/** Whether a partner may open a shipment: only when staff put them on it. */
export function partnerCanSeeShipment(shipment: Record<string, unknown>, partnerId: string) {
  const ids = Array.isArray(shipment.partner_access_ids) ? shipment.partner_access_ids : [];
  return Boolean(partnerId) && ids.includes(partnerId) && partnerShipmentAccessFromRecord(shipment.partner_access).some((item) => item.partner_id === partnerId);
}

export type PartnerAccountDecision =
  | { kind: "allowed"; partnerId: string; partnerName: string; bindUid: boolean }
  | { kind: "denied"; reason: "no_account" | "inactive" | "unverified" | "other_identity" | "partner_inactive" };

/**
 * Whether this sign-in may use the partner portal. The address must be
 * verified (the invite link does that), the account and the partner active,
 * and the account not already bound to a different sign-in.
 */
export function decidePartnerAccount(
  identity: { uid: string; email: string; emailVerified: boolean },
  account: { exists: boolean; active?: unknown; uid?: unknown; partner_id?: unknown; partner_name?: unknown },
  partner: { exists: boolean; status?: unknown },
): PartnerAccountDecision {
  if (!account.exists || typeof account.partner_id !== "string" || !account.partner_id) return { kind: "denied", reason: "no_account" };
  if (account.active !== true) return { kind: "denied", reason: "inactive" };
  if (!identity.emailVerified) return { kind: "denied", reason: "unverified" };
  if (typeof account.uid === "string" && account.uid && account.uid !== identity.uid) return { kind: "denied", reason: "other_identity" };
  if (!partner.exists || partner.status === "inactive") return { kind: "denied", reason: "partner_inactive" };
  return { kind: "allowed", partnerId: account.partner_id, partnerName: typeof account.partner_name === "string" ? account.partner_name : "Partner", bindUid: !(typeof account.uid === "string" && account.uid) };
}
