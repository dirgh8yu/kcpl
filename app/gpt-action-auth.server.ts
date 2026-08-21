import { timingSafeEqual } from "node:crypto";

const minimumSecretLength = 32;

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

export type GptActionAuthorization =
  | { ok: true }
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

  return { ok: true };
}

export function gptActionJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function requireGptAction(request: Request) {
  const authorization = authorizeGptAction(request);
  if (authorization.ok) return null;
  return gptActionJson({ ok: false, error: authorization.error }, authorization.status);
}
