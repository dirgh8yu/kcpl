/*
 * What the customer write paths share, kept free of server imports.
 *
 * Each customer write (a document, a remittance, a delivery confirmation, a
 * team change) is decided once, in its own `*.server.ts` module, and reached
 * through two doors: the web portal's cookie route and the KCPL app's bearer
 * route. The module returns a status and a body; each door only adds its own
 * credential check and its own response headers. The cookie door also checks
 * the request is same-origin, because a browser attaches cookies to
 * cross-site requests. A bearer header is never attached automatically, so the
 * app's door has nothing of the kind to defend.
 */

export type PortalWriteResult = {
  status: number;
  body: { ok: boolean; code?: PortalWriteCode; error?: string; message?: string } & Record<string, unknown>;
  /** Seconds, for a 429's retry-after header. */
  retryAfter?: number;
};

export type PortalWriteCode =
  | "invalid"
  | "forbidden"
  | "missing"
  | "conflict"
  | "rate_limited"
  | "too_large"
  | "unsupported"
  | "unavailable"
  | "failed";

export function portalWriteRefused(status: number, code: PortalWriteCode, error: string, extra: Record<string, unknown> = {}): PortalWriteResult {
  return { status, body: { ok: false, code, error, ...extra } };
}

/**
 * Narrower than the staff vault on purpose: a customer sends invoices, permits,
 * receipts and photographs of paperwork, not spreadsheets or Word documents.
 */
export const portalIntakeExtensions: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function portalIntakeExtension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

/** A write's result as a response. Each door passes its own cache header. */
export function portalWriteResponse(result: PortalWriteResult, cacheControl = "no-store") {
  const headers: Record<string, string> = { "cache-control": cacheControl };
  if (result.retryAfter !== undefined) headers["retry-after"] = String(result.retryAfter);
  return Response.json(result.body, { status: result.status, headers });
}
