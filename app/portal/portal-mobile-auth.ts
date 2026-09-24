/*
 * Request parsing and response shaping for the mobile app's API, kept free of
 * server imports so the rules can be tested directly.
 *
 * The mobile app cannot hold the portal's HttpOnly session cookie, so it
 * presents a Firebase ID token as a bearer credential instead. Only how the
 * credential arrives differs. The token is verified with revocation checked,
 * and the result goes through the same `authorizePortalIdentity` the cookie
 * path uses. The same Firestore-derived customer scope and the same redacting
 * readers apply, so a phone can never see more than the browser portal.
 *
 * A bearer header is not sent automatically by a browser, so these routes are
 * not exposed to cross-site request forgery the way cookie routes are, and
 * they need no same-origin check.
 */

/** Firebase ID tokens are compact JWS: three base64url segments. */
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/** Generous for a Firebase ID token (about 1 KB with custom claims) while
 * refusing to hand an arbitrarily large string to the verifier. */
const MAX_BEARER_LENGTH = 4096;

export const PORTAL_MOBILE_CUSTOMER_HEADER = "x-kcpl-customer";

export function portalBearerToken(header: string | null | undefined): string | null {
  if (typeof header !== "string" || header.length > MAX_BEARER_LENGTH) return null;
  const match = BEARER_PATTERN.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * The customer an agent asked to look at. As with the portal's customer
 * cookie, this is a preference and grants nothing. `decidePortalCustomerScope`
 * intersects it with the allowed set, and anything outside that set resolves to
 * the account's primary customer. It is only trimmed and bounded here.
 */
export function portalRequestedCustomer(header: string | null | undefined): string | null {
  if (typeof header !== "string") return null;
  const value = header.trim();
  if (!value || value.length > 128) return null;
  return value;
}

type FreeTimeDetail = {
  freeTime: {
    location: string | null;
    days: number | null;
    started_on: string | null;
    daily_charge: number | null;
    charge_currency: string | null;
  };
  status: unknown;
};

/**
 * The free-time block of a shipment detail, reduced to what the portal shows a
 * customer. The web page renders the reader's result on the server, so fields
 * it never displays never leave KCPL. A JSON API would put every field on the
 * wire, including who at KCPL last edited the allowance and whether the cost
 * has been agreed. So this is an allowlist, not a deletion: a field added to
 * the record later stays private until someone decides otherwise.
 */
export function portalMobileFreeTime(value: { freeTime: Record<string, unknown>; status: unknown } | null): FreeTimeDetail | null {
  if (!value) return null;
  const record = value.freeTime;
  const textOrNull = (field: unknown) => (typeof field === "string" && field.trim() ? field : null);
  const numberOrNull = (field: unknown) => (typeof field === "number" && Number.isFinite(field) ? field : null);
  return {
    freeTime: {
      location: textOrNull(record.location),
      days: numberOrNull(record.days),
      started_on: textOrNull(record.started_on),
      daily_charge: numberOrNull(record.daily_charge),
      charge_currency: textOrNull(record.charge_currency),
    },
    status: value.status,
  };
}
