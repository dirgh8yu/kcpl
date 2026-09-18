import { createHash } from "node:crypto";

// Abuse control for the one endpoint the public internet can write to.
//
// `POST /api/quotes` validates its fields and has a honeypot, but neither is a
// control against a scripted client: `isTrustedSameOriginRequest()` deliberately
// accepts non-browser clients that send no `Origin`, so anything can post here
// and make KCPL do Firestore and CRM work. This is the decision half; the store
// that makes it durable lives in `quote-rate-limit.server.ts`.
//
// Two subjects are limited independently, because they fail differently: one
// address can send a handful of genuine enquiries (a forwarder, a shared office
// connection), while one email address submitting repeatedly is a script. A
// request has to satisfy both.
//
// This module is deliberately dependency-free — no imports beyond `node:crypto`
// — so `tests/quote-rate-limit.test.mjs` can drive it through a fake store and
// exercise the window accounting for real instead of asserting on source text.

export type RateLimitRecord = {
  count: number;
  windowStartedAtMs: number;
  windowMs: number;
};

export type RateLimitStore = {
  read(key: string): Promise<RateLimitRecord | null>;
  write(key: string, record: RateLimitRecord): Promise<void>;
};

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitSubject = {
  policy: RateLimitPolicy;
  value: string | null;
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  blockedBy: string | null;
  /** True when the store could not be used, so the submission was let through. */
  degraded: boolean;
};

const MINUTE = 60_000;

export const quoteRateLimitPolicies = {
  address: { name: "address", limit: 6, windowMs: 10 * MINUTE },
  contact: { name: "contact", limit: 3, windowMs: 30 * MINUTE },
} satisfies Record<string, RateLimitPolicy>;

/**
 * A stable, non-reversible key. Subjects are stored hashed so the collection
 * holds no raw IP addresses or email addresses: an abuse control must not become
 * a second copy of personal data. The salt is optional, and a deployment that
 * sets `KCPL_RATE_LIMIT_SALT` makes the stored keys useless to anyone who could
 * otherwise confirm a guess by hashing a known address.
 */
export function rateLimitSubjectKey(policyName: string, value: string, salt = ""): string {
  return createHash("sha256")
    .update(`${salt}\u0000${policyName}\u0000${value}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * The client address, or null when the runtime does not expose one. Null means
 * "cannot be limited by address", and the subject is skipped rather than pooled
 * under a shared bucket — pooling would let one client exhaust everyone's budget.
 */
export function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeAddress(first);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return normalizeAddress(real);
  return null;
}

function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  // The same client arrives as `1.2.3.4` or `::ffff:1.2.3.4` depending on the
  // proxy, and those must not become two independent budgets.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return (mapped ? mapped[1] : trimmed).toLowerCase();
}

export async function checkQuoteRateLimit({
  subjects,
  store,
  now = Date.now(),
  salt = process.env.KCPL_RATE_LIMIT_SALT ?? "",
}: {
  subjects: RateLimitSubject[];
  store: RateLimitStore;
  now?: number;
  salt?: string;
}): Promise<RateLimitDecision> {
  const increments: Array<{ key: string; record: RateLimitRecord }> = [];
  let blockedBy: string | null = null;
  let retryAfterSeconds = 0;

  try {
    for (const subject of subjects) {
      if (!subject.value) continue;
      const key = rateLimitSubjectKey(subject.policy.name, subject.value, salt);
      const existing = await store.read(key);
      const windowElapsed = !existing || now - existing.windowStartedAtMs >= subject.policy.windowMs;

      if (windowElapsed) {
        increments.push({
          key,
          record: { count: 1, windowStartedAtMs: now, windowMs: subject.policy.windowMs },
        });
        continue;
      }

      if (existing.count >= subject.policy.limit) {
        blockedBy = subject.policy.name;
        const remainingMs = subject.policy.windowMs - (now - existing.windowStartedAtMs);
        retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(remainingMs / 1000));
        continue;
      }

      increments.push({
        key,
        record: {
          count: existing.count + 1,
          windowStartedAtMs: existing.windowStartedAtMs,
          windowMs: subject.policy.windowMs,
        },
      });
    }
  } catch (error) {
    // Deliberately fail open. The limiter shares Firestore with the write this
    // guards, so an unreachable store already means the enquiry cannot be saved —
    // refusing it would turn a backend outage into a broken sales funnel for no
    // security benefit. The caller is told, so it can log the degradation.
    console.error("Quote rate limit store unavailable; allowing the submission", error);
    return { allowed: true, retryAfterSeconds: 0, blockedBy: null, degraded: true };
  }

  // A refused request must not consume allowance or roll the window forward.
  if (blockedBy) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      blockedBy,
      degraded: false,
    };
  }

  for (const increment of increments) {
    try {
      await store.write(increment.key, increment.record);
    } catch (error) {
      console.error("Quote rate limit counter could not be written", error);
      return { allowed: true, retryAfterSeconds: 0, blockedBy: null, degraded: true };
    }
  }

  return { allowed: true, retryAfterSeconds: 0, blockedBy: null, degraded: false };
}
