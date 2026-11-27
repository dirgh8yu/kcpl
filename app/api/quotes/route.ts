import { createQuoteEndpoint, type QuoteCrmMatcher, type QuoteRecordStore } from "./quote-endpoint.ts";

/*
 * The Firestore wiring for the public quote endpoint. The request path itself
 * lives in `quote-endpoint.ts`, so it can be driven without Firebase; this file
 * only supplies the three collaborators the endpoint calls. The Firebase and
 * CRM modules are imported inside the callbacks so that wiring stays off the
 * module graph until a submission actually needs it.
 */

export async function POST(request: Request) {
  return post(request);
}

const post = createQuoteEndpoint({
  async firestoreStore(): Promise<QuoteRecordStore> {
    const { firebaseAdminDb } = await import("../../firebase-admin.server");
    return {
      async create(reference, record) {
        await firebaseAdminDb().collection("quotes").doc(reference).create(record);
      },
    };
  },
  async crmMatcher(input) {
    const { findCrmDuplicates } = await import("../../admin/crm/crm-data.server");
    return findCrmDuplicates(input);
  },
  async rateLimitStore() {
    const { firestoreQuoteRateLimitStore } = await import("./quote-rate-limit.server");
    return firestoreQuoteRateLimitStore();
  },
} satisfies Parameters<typeof createQuoteEndpoint>[0] & { crmMatcher: QuoteCrmMatcher });
