import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { buildAttributionReport, type AttributionReport } from "./attribution";

/**
 * The source rollup is deliberately bounded. It is a management view of lead
 * origin, not a second copy of the quote book: 2,000 recent enquiries is more
 * than enough to see which tools and campaigns produce work, and keeps the
 * page within a predictable read budget.
 */
export async function loadAttributionReport(): Promise<AttributionReport | null> {
  if (!firebaseRuntimeConfigured()) return null;
  try {
    const [quoteSnapshot, invoiceSnapshot] = await Promise.all([
      firebaseAdminDb().collection("quotes").orderBy("created_at", "desc").limit(2000).get(),
      firebaseAdminDb().collection("invoices").orderBy("issue_date", "desc").limit(2000).get(),
    ]);
    return buildAttributionReport(
      quoteSnapshot.docs.map((doc) => ({ data: doc.data() as Record<string, unknown> })),
      invoiceSnapshot.docs.map((doc) => ({
        quote_reference: typeof doc.get("quote_reference") === "string" ? doc.get("quote_reference") as string : null,
        currency: typeof doc.get("currency") === "string" ? doc.get("currency") as string : null,
        status: typeof doc.get("status") === "string" ? doc.get("status") as string : null,
        total: Number(doc.get("total")) || 0,
        amount_paid: Number(doc.get("amount_paid")) || 0,
      })),
    );
  } catch (error) {
    console.error("KCPL attribution report failed", error);
    return null;
  }
}
