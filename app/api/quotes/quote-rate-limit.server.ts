import { firebaseAdminDb } from "../../firebase-admin.server";
import type { RateLimitStore } from "./quote-rate-limit-policy";

// The durable half of the quote abuse control. The decision logic — windows,
// limits, hashed subject keys — is in `quote-rate-limit-policy.ts` and stays
// free of I/O so it can be tested directly.

export const QUOTE_RATE_LIMIT_COLLECTION = "quote_rate_limits";

export function firestoreQuoteRateLimitStore(): RateLimitStore {
  // `firebaseAdminDb()` is resolved per call. Building the store must not throw
  // on a runtime where Firebase is not configured, or the limiter would take the
  // endpoint down instead of degrading.
  return {
    async read(key) {
      const snapshot = await firebaseAdminDb()
        .collection(QUOTE_RATE_LIMIT_COLLECTION)
        .doc(key)
        .get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() ?? {};
      const count = typeof data.count === "number" ? data.count : 0;
      const windowStartedAtMs = typeof data.window_started_at_ms === "number" ? data.window_started_at_ms : 0;
      const windowMs = typeof data.window_ms === "number" ? data.window_ms : 0;
      return { count, windowStartedAtMs, windowMs };
    },
    async write(key, record) {
      await firebaseAdminDb()
        .collection(QUOTE_RATE_LIMIT_COLLECTION)
        .doc(key)
        .set({
          count: record.count,
          window_started_at_ms: record.windowStartedAtMs,
          window_ms: record.windowMs,
          // Firestore TTL field. Give `quote_rate_limits.expires_at` a TTL policy
          // so counters expire without a scheduled job of our own.
          expires_at: new Date(record.windowStartedAtMs + record.windowMs),
        });
    },
  };
}
