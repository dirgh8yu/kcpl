import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";

type Actor = { name: string; email: string };

export type CrmQuoteLinkItem = {
  reference: string;
  created_at: string;
  status: string;
  origin: string;
  destination: string;
  contact_name: string;
  contact_email: string;
  company_name: string | null;
  phone: string | null;
  customer_id: string | null;
  match_reason: string | null;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quoteFromDoc(id: string, data: Record<string, unknown>, customerId: string): CrmQuoteLinkItem {
  const matches = Array.isArray(data.crm_matches) ? data.crm_matches : [];
  const match = matches.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as Record<string, unknown>).id === customerId;
  }) as Record<string, unknown> | undefined;

  return {
    reference: id,
    created_at: text(data.created_at),
    status: text(data.status, "new"),
    origin: text(data.origin),
    destination: text(data.destination),
    contact_name: text(data.contact_name),
    contact_email: text(data.contact_email),
    company_name: nullable(data.company_name),
    phone: nullable(data.phone),
    customer_id: nullable(data.customer_id),
    match_reason: match ? nullable(match.reason) : null,
  };
}

export async function listCrmQuoteLinks(customerId: string) {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const [linkedSnapshot, suggestedSnapshot] = await Promise.all([
    db.collection("quotes").where("customer_id", "==", id).limit(250).get(),
    db.collection("quotes").where("crm_match_ids", "array-contains", id).limit(100).get(),
  ]);

  const linked = linkedSnapshot.docs
    .map((doc) => quoteFromDoc(doc.id, doc.data() as Record<string, unknown>, id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const linkedIds = new Set(linked.map((item) => item.reference));
  const suggested = suggestedSnapshot.docs
    .filter((doc) => !linkedIds.has(doc.id) && !nullable(doc.get("customer_id")))
    .map((doc) => quoteFromDoc(doc.id, doc.data() as Record<string, unknown>, id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return { linked, suggested };
}

export async function linkQuoteToCrmCustomer(customerId: string, quoteReference: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const quoteId = quoteReference.trim().toUpperCase();
  const targetRef = db.collection("customers").doc(id);
  const quoteRef = db.collection("quotes").doc(quoteId);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [targetSnapshot, quoteSnapshot] = await Promise.all([
      transaction.get(targetRef),
      transaction.get(quoteRef),
    ]);
    if (!targetSnapshot.exists) return { kind: "missing_customer" as const };
    if (!quoteSnapshot.exists) return { kind: "missing_quote" as const };

    const currentCustomerId = nullable(quoteSnapshot.get("customer_id"));
    if (currentCustomerId === id) return { kind: "linked" as const };

    let previousRef = null as ReturnType<typeof db.collection> extends never ? never : FirebaseFirestore.DocumentReference | null;
    let previousSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
    if (currentCustomerId) {
      previousRef = db.collection("customers").doc(currentCustomerId);
      previousSnapshot = await transaction.get(previousRef);
    }

    transaction.update(quoteRef, {
      customer_id: id,
      crm_match_state: "confirmed",
      crm_linked_at: now,
      crm_linked_by_name: actor.name,
      crm_linked_by_email: actor.email,
      updated_at: now,
    });
    transaction.update(targetRef, {
      quote_count: numberValue(targetSnapshot.get("quote_count")) + 1,
      updated_at: now,
    });
    transaction.create(targetRef.collection("activity").doc(`activity-${Date.now()}-${quoteId}`), {
      type: "quote_linked",
      title: `Quote linked: ${quoteId}`,
      detail: `${text(quoteSnapshot.get("origin"))} → ${text(quoteSnapshot.get("destination"))}`,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });

    if (previousRef && previousSnapshot?.exists) {
      transaction.update(previousRef, {
        quote_count: Math.max(0, numberValue(previousSnapshot.get("quote_count")) - 1),
        updated_at: now,
      });
      transaction.create(previousRef.collection("activity").doc(`activity-${Date.now()}-${quoteId}-moved`), {
        type: "quote_unlinked",
        title: `Quote moved: ${quoteId}`,
        detail: `Quote reassigned to ${id}.`,
        actor_name: actor.name,
        actor_email: actor.email,
        created_at: now,
      });
    }

    return { kind: "linked" as const };
  });
}
