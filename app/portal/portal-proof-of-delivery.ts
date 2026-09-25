/*
 * What a customer may see of a delivery's proof. Pure: no Firebase here, so
 * the rules are tested directly.
 */

export type PortalPodItem = {
  id: string;
  kind: "signature" | "photo" | "document";
  content_type: string;
  captured_at: string | null;
};

export type PortalProofOfDelivery = {
  delivered_at: string | null;
  recipient_name: string | null;
  recipient_relation: string | null;
  verified_at: string | null;
  items: PortalPodItem[];
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Proof is pictures and PDFs. Anything else is served as a download, never
 * rendered on KCPL's origin. */
const podContentTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "application/pdf"]);

export function portalPodContentType(value: unknown) {
  const type = typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
  return podContentTypes.has(type) ? type : "application/octet-stream";
}

/** Verified by KCPL, and marked safe to share when it was verified. */
export function portalPodEvidenceVisible(evidence: Record<string, unknown>) {
  return evidence.review_status === "verified" && evidence.customer_safe === true && !evidence.deleted_at;
}

/**
 * The customer's view of a verified delivery: who received it and when, and
 * the signature and photos KCPL chose to share. Never the recipient's phone
 * number, the driver's details, the location, or anything the desk
 * rejected or has not yet checked.
 */
export function portalProofOfDeliveryView(input: {
  shipment: Record<string, unknown>;
  evidence: Array<Record<string, unknown> & { id: string }>;
  attempts: Array<Record<string, unknown> & { id: string }>;
}): PortalProofOfDelivery | null {
  if (input.shipment.delivery_pod_status !== "verified") return null;
  const visible = input.evidence.filter(portalPodEvidenceVisible);
  // The attempt the shared proof belongs to, else the delivered one.
  const attemptIds = new Set(visible.map((item) => text(item.attempt_id)).filter(Boolean));
  const delivered = input.attempts
    .filter((attempt) => attempt.status === "delivered")
    .sort((a, b) => String(b.event_time ?? b.updated_at ?? "").localeCompare(String(a.event_time ?? a.updated_at ?? "")));
  const attempt = delivered.find((row) => attemptIds.has(row.id)) ?? delivered[0];
  const order = { signature: 0, photo: 1, document: 2 } as const;
  const items = visible
    .map((item): PortalPodItem => ({
      id: item.id,
      kind: item.kind === "signature" || item.kind === "photo" ? item.kind : "document",
      content_type: portalPodContentType(item.content_type),
      captured_at: text(item.captured_at) ?? text(item.uploaded_at),
    }))
    .sort((a, b) => order[a.kind] - order[b.kind] || String(a.captured_at ?? "").localeCompare(String(b.captured_at ?? "")));
  return {
    delivered_at: text(attempt?.event_time) ?? text(input.shipment.delivered_at) ?? text(input.shipment.delivery_completed_at),
    recipient_name: text(attempt?.recipient_name) ?? text(input.shipment.delivery_recipient_name),
    recipient_relation: text(attempt?.recipient_relation),
    verified_at: text(input.shipment.delivery_pod_verified_at),
    items,
  };
}
