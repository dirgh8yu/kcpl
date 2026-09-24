/*
 * The Authorization header the KCPL mobile apps send: `Bearer <Firebase ID
 * token>`. Parsing only. What the token proves is decided by whichever
 * resolver verifies it (the customer portal's or the staff one).
 */

/** Firebase ID tokens are compact JWS: three base64url segments. */
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/** Generous for a Firebase ID token (about 1 KB with custom claims) while
 * refusing to hand an arbitrarily large string to the verifier. */
const MAX_BEARER_LENGTH = 4096;

export function bearerToken(header: string | null | undefined): string | null {
  if (typeof header !== "string" || header.length > MAX_BEARER_LENGTH) return null;
  const match = BEARER_PATTERN.exec(header.trim());
  return match ? match[1] : null;
}
