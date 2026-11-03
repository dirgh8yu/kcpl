import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { crmCurrencies, type CrmCurrency } from "../admin/crm/crm-data";
import { respondToTmsTenderFromPartner } from "../admin/tenders/tms-tendering.server";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../api/quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../api/quotes/quote-rate-limit.server";
import type { PartnerSession } from "./partner-auth";
import { partnerCounterIsSane, partnerTenderView, type PartnerTenderAction, type PartnerTenderView } from "./partner-tenders";

/*
 * The partner tender desk's data layer.
 *
 * A partner sees only tenders addressed to its own partner record. Every read
 * starts from that id rather than filtering after the fact, so a forgotten
 * condition cannot turn a valid partner session into a directory of other
 * carriers' offers.
 */

export async function listPartnerTenders(session: PartnerSession): Promise<
  { kind: "unavailable" } | { kind: "ready"; tenders: PartnerTenderView[] }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const now = new Date().toISOString();
    const snapshot = await firebaseAdminDb().collection("transport_tenders")
      .where("partner_id", "==", session.partnerId.trim().toUpperCase())
      .limit(500)
      .get();
    const tenders = snapshot.docs
      .map((doc) => partnerTenderView(doc.id, doc.data() as Record<string, unknown>, now))
      .filter((view): view is PartnerTenderView => Boolean(view))
      .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""));
    return { kind: "ready", tenders };
  } catch (error) {
    console.error("KCPL partner tender listing failed", error);
    return { kind: "unavailable" };
  }
}

export async function getPartnerTender(session: PartnerSession, tenderId: string): Promise<PartnerTenderView | null> {
  if (!firebaseRuntimeConfigured()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection("transport_tenders").doc(tenderId.trim().toUpperCase()).get();
    if (!snapshot.exists) return null;
    if (String(snapshot.get("partner_id") ?? "").trim().toUpperCase() !== session.partnerId.trim().toUpperCase()) return null;
    return partnerTenderView(snapshot.id, snapshot.data() as Record<string, unknown>, new Date().toISOString());
  } catch (error) {
    console.error("KCPL partner tender read failed", error);
    return null;
  }
}

export function partnerTenderResponseError(kind: string) {
  return {
    missing: "This tender is no longer available to your account.",
    forbidden: "This tender was not sent to your partner account.",
    invalid_transition: "This tender has already been answered or has expired.",
    invalid_counter: "Enter a counter-offer amount greater than zero and a supported currency.",
    rate_limited: "Too many tender responses from this account just now. Try again shortly.",
    expired: "The response deadline has passed. Ask your KCPL contact to re-send it.",
    stale_tender: "KCPL has already moved this tender on. Refresh the page before replying.",
    stale_commercial_state: "KCPL's commercial record changed while you were replying. Refresh the page and try again.",
    commercial_review_required: "This tender needs a KCPL commercial review before a response can be recorded.",
    state_conflict: "The tender changed while you were submitting. Refresh and check its status.",
    unavailable: "The tender desk is temporarily unavailable. Try again in a minute.",
  }[kind] ?? "The response could not be recorded. Try again in a minute.";
}

export async function respondToPartnerTender(
  session: PartnerSession,
  tenderId: string,
  action: PartnerTenderAction,
  values: { amount?: unknown; currency?: unknown; note?: unknown } = {},
) {
  const view = await getPartnerTender(session, tenderId);
  if (!view) return { kind: "missing" as const };
  if (!view.can_respond) return { kind: view.expired ? "expired" as const : "invalid_transition" as const };

  const limit = await checkQuoteRateLimit({
    subjects: [{ policy: quoteRateLimitPolicies.partner, value: session.email }],
    store: firestoreQuoteRateLimitStore(),
  });
  if (!limit.allowed) return { kind: "rate_limited" as const, retryAfterSeconds: limit.retryAfterSeconds };

  const note = typeof values.note === "string" ? values.note.trim().slice(0, 1000) : "";
  if (action === "counter") {
    const currency = crmCurrencies.includes(values.currency as CrmCurrency) ? values.currency as CrmCurrency : null;
    if (!currency || !partnerCounterIsSane(values.amount, currency, view.offered_cost)) return { kind: "invalid_counter" as const };
  }

  const result = await respondToTmsTenderFromPartner(
    view.id,
    action === "counter"
      ? {
        status: "countered",
        note,
        counterCost: Number(values.amount),
        counterCurrency: crmCurrencies.includes(values.currency as CrmCurrency) ? values.currency as CrmCurrency : null,
      }
      : { status: action === "accept" ? "accepted" : "rejected", note, counterCost: null, counterCurrency: null },
    {
      partnerId: session.partnerId,
      partnerName: session.partnerName,
      displayName: session.displayName,
      email: session.email,
    },
  );
  return result;
}
