import { firebaseAdminDb } from "../../firebase-admin.server";
import { quoteEconomicEditDecision } from "./quote-commercial-policy";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function assertQuoteEconomicEditAllowed(reference: string) {
  const id = reference.trim().toUpperCase();
  if (!id) return { kind: "missing" as const };
  const snapshot = await firebaseAdminDb().collection("quotes").doc(id).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const decision = quoteEconomicEditDecision(snapshot.data() as Record<string, unknown>);
  if (decision === "locked_versioned") {
    return {
      kind: "locked" as const,
      commercialVersionId: text(snapshot.get("commercial_version_id")) || null,
      commercialFingerprint: text(snapshot.get("commercial_fingerprint")) || null,
    };
  }
  return { kind: "allowed" as const };
}
