import { timingSafeEqual } from "node:crypto";

export type MachineAuthorizationResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function bearer(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function safeEqual(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function authorizeBearer(request: Request, configured: string, errors: { unconfigured: string; required: string; failed: string }): MachineAuthorizationResult {
  const expected = configured.trim();
  if (!expected) return { ok: false, status: 503, error: errors.unconfigured };
  const supplied = bearer(request);
  if (!supplied) return { ok: false, status: 401, error: errors.required };
  if (!safeEqual(expected, supplied)) return { ok: false, status: 401, error: errors.failed };
  return { ok: true };
}

export function trackingMachineAuthorized(request: Request): MachineAuthorizationResult {
  return authorizeBearer(request, process.env.KCPL_TRACKING_INGEST_SECRET ?? "", {
    unconfigured: "Tracking ingestion is not configured.",
    required: "Bearer authentication is required.",
    failed: "Tracking authentication failed.",
  });
}

export function pickupMachineAuthorized(request: Request): MachineAuthorizationResult {
  return authorizeBearer(request, process.env.KCPL_PICKUP_INTEGRATION_SECRET ?? "", {
    unconfigured: "Pickup integration is not configured.",
    required: "Bearer authentication is required.",
    failed: "Pickup integration authentication failed.",
  });
}

export function maerskMachineAuthorized(request: Request): MachineAuthorizationResult {
  return authorizeBearer(request, process.env.MAERSK_WEBHOOK_SECRET ?? "", {
    unconfigured: "Maersk webhook ingestion is not configured.",
    required: "Bearer authentication is required.",
    failed: "Maersk webhook authentication failed.",
  });
}

export function automationMachineAuthorized(request: Request): MachineAuthorizationResult {
  return authorizeBearer(request, process.env.KCPL_AUTOMATION_SECRET ?? "", {
    unconfigured: "Automation scheduler authentication is not configured.",
    required: "Automation authentication failed.",
    failed: "Automation authentication failed.",
  });
}

export function ediMachineAuthorized(request: Request): MachineAuthorizationResult {
  const expected = process.env.KCPL_EDI_SECRET?.trim() ?? "";
  if (!expected) return { ok: false, status: 503, error: "KCPL EDI transport is not configured." };
  const supplied = bearer(request) || request.headers.get("x-edi-key")?.trim() || "";
  if (!supplied) return { ok: false, status: 401, error: "EDI authentication is required." };
  if (!safeEqual(expected, supplied)) return { ok: false, status: 401, error: "EDI authentication failed." };
  return { ok: true };
}
