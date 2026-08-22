import { timingSafeEqual } from "node:crypto";

const minimumSecretLength = 32;

/**
 * KCPL Custom GPT trust decision (Policy A): KCPL_GPT_ACTION_SECRET represents one
 * privileged, organization-wide, Management-level READ-ONLY intelligence principal.
 * It does not represent the human staff member asking a question and must never be
 * treated as branch-scoped staff identity. The key is for KCPL's private internal GPT
 * only and must not be reused by customers, vendors, public clients or another KCPL
 * subsystem. GPT routes may return curated operational intelligence, but may never
 * write KCPL state or expose machine credentials, raw EDI payloads, signed/private
 * storage URLs, access tokens or other secret material.
 */
export const gptTrustPolicy = Object.freeze({
  principal: "kcpl-internal-management-intelligence",
  scope: "organization-wide" as const,
  roleEquivalent: "management-read-only" as const,
  readOnly: true as const,
});

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function bearerToken(request: Request) {
  const authorization = clean(request.headers.get("authorization"));
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function presentedSecret(request: Request) {
  return clean(request.headers.get("x-api-key")) || bearerToken(request);
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function forbiddenGptField(key: string) {
  return /(?:secret|password|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|raw[_-]?(?:payload|x12|edi)|signed[_-]?url|download[_-]?url|storage[_-]?(?:path|url)|private[_-]?url)/i.test(key);
}

function looksLikePrivateSignedUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  return /(?:[?&](?:token|sig|signature|x-goog-signature|x-goog-credential|x-amz-signature)=)|(?:storage\.googleapis\.com\/.*[?&]x-goog-)/i.test(value);
}

/** Defense in depth for every /api/gpt response, including future endpoints. */
export function sanitizeGptResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeGptResponse);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && looksLikePrivateSignedUrl(value) ? "[redacted private URL]" : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbiddenGptField(key))
      .map(([key, item]) => [key, sanitizeGptResponse(item)]),
  );
}

export type GptActionAuthorization =
  | { ok: true; principal: typeof gptTrustPolicy.principal }
  | { ok: false; status: 401 | 503; error: string };

export function authorizeGptAction(request: Request): GptActionAuthorization {
  const configuredSecret = clean(process.env.KCPL_GPT_ACTION_SECRET);
  if (configuredSecret.length < minimumSecretLength) {
    return {
      ok: false,
      status: 503,
      error: "KCPL Custom GPT access is not configured.",
    };
  }

  const suppliedSecret = presentedSecret(request);
  if (!suppliedSecret || !safeEqual(suppliedSecret, configuredSecret)) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  return { ok: true, principal: gptTrustPolicy.principal };
}

export function gptActionJson(body: unknown, status = 200) {
  return Response.json(sanitizeGptResponse(body), {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-kcpl-machine-scope": "management-read-only",
    },
  });
}

export function requireGptAction(request: Request) {
  const authorization = authorizeGptAction(request);
  if (authorization.ok) return null;
  return gptActionJson({ ok: false, error: authorization.error }, authorization.status);
}
