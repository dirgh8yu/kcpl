// Attestation for the public quote form — the second half of #65's abuse
// controls, after the durable rate limit.
//
// Rate limiting bounds how *much* one client can send; it cannot tell a script
// from a customer. A challenge token can, and Cloudflare Turnstile is the right
// shape for this endpoint: it verifies server-side with one POST, and it renders
// invisibly, so the enquiry form's layout does not change.
//
// The challenge is opt-in. Without `CLOUDFLARE_TURNSTILE_SECRET_KEY` this module
// reports `not_configured` and the route keeps working exactly as before, which
// keeps the feature shippable before the keys exist and keeps local development
// free of third-party calls.
//
// Dependency-free apart from `fetch`, so `tests/quote-challenge.test.mjs` can
// drive every branch through an injected transport.

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type ChallengeReason =
  | "not_configured"
  | "verified"
  | "missing_token"
  | "rejected"
  | "transport_error";

export type ChallengeVerdict = {
  ok: boolean;
  reason: ChallengeReason;
  /** Provider error codes, for logs only — never returned to the caller. */
  detail?: string;
};

export function configuredChallengeSecret(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const secret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  return secret ? secret : null;
}

export function quoteChallengeRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return configuredChallengeSecret(env) !== null;
}

export async function evaluateQuoteChallenge({
  token,
  secret = configuredChallengeSecret(),
  remoteAddress = null,
  fetchImpl = fetch,
}: {
  token: string;
  secret?: string | null;
  remoteAddress?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<ChallengeVerdict> {
  if (!secret) return { ok: true, reason: "not_configured" };
  if (!token.trim()) return { ok: false, reason: "missing_token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteAddress) body.set("remoteip", remoteAddress);

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      // An HTTP-level failure is the provider telling us nothing about the
      // token, which is an availability problem rather than a verdict, so it is
      // treated like a transport error below.
      console.error("Quote challenge verification returned a non-OK status", response.status);
      return { ok: true, reason: "transport_error" };
    }

    const result = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (result.success) return { ok: true, reason: "verified" };

    return {
      ok: false,
      reason: "rejected",
      detail: (result["error-codes"] ?? []).join(",") || "unspecified",
    };
  } catch (error) {
    // Deliberately fail open, and only here. An explicit rejection always
    // refuses the submission, but a failure to *reach* Cloudflare must not take
    // the enquiry form offline — Turnstile being unreachable is not evidence
    // that the sender is a bot. The route logs the degradation, and the rate
    // limiter remains the durable control either way.
    console.error("Quote challenge could not be verified; allowing the submission", error);
    return { ok: true, reason: "transport_error" };
  }
}
