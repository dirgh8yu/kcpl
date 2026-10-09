import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Two-step sign-in for the roles that move money (Management and Accounts):
 * a six-digit code from an authenticator app (RFC 6238, the codes Google
 * Authenticator, Microsoft Authenticator and 1Password make), or a one-time
 * recovery code. The rules only; the server keeps the secrets and counters.
 */

export const TWO_STEP_ISSUER = "KCPL Operations";
const STEP_SECONDS = 30;
const DIGITS = 6;
/** One step either side, so a phone clock a few seconds out still works. */
const WINDOW = 1;
export const TWO_STEP_MAX_FAILURES = 5;
export const TWO_STEP_LOCK_MS = 15 * 60 * 1000;
export const TWO_STEP_TRUST_MS = 30 * 24 * 60 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function twoStepRequiredForRole(role: string | null | undefined) {
  return role === "management" || role === "accounts";
}

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** A new 160-bit secret, as the base32 text authenticator apps take. */
export function newTwoStepSecret() {
  return base32Encode(randomBytes(20));
}

export function twoStepCounter(nowMs: number) {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** The code for one 30-second step (RFC 4226 dynamic truncation over HMAC-SHA1). */
export function totpCode(secret: Uint8Array, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** What was typed, without the spaces and dashes people add. */
export function normalizeTwoStepInput(input: unknown) {
  return typeof input === "string" ? input.replace(/[\s-]/g, "").toUpperCase() : "";
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Check an authenticator code. A code is good for its step and one either
 * side, and each step works once: a code someone saw over a shoulder can't be
 * used again after it was used to sign in.
 */
export function verifyTotp(secretBase32: string, input: unknown, nowMs: number, lastUsedCounter: number | null):
  | { ok: true; counter: number }
  | { ok: false; reason: "format" | "wrong" | "reused" } {
  const code = normalizeTwoStepInput(input);
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "format" };
  const secret = base32Decode(secretBase32);
  if (!secret || secret.length < 10) return { ok: false, reason: "wrong" };
  const now = twoStepCounter(nowMs);
  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const counter = now + offset;
    if (!sameText(totpCode(secret, counter), code)) continue;
    if (lastUsedCounter !== null && counter <= lastUsedCounter) return { ok: false, reason: "reused" };
    return { ok: true, counter };
  }
  return { ok: false, reason: "wrong" };
}

/** The link an authenticator app reads from the QR code. */
export function otpauthUri(secretBase32: string, account: string) {
  const label = encodeURIComponent(`${TWO_STEP_ISSUER}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer: TWO_STEP_ISSUER, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten one-time codes, as XXXX-XXXX from letters and digits that can't be misread. */
export function newRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/** Recovery codes are kept only as hashes, salted with the person they belong to. */
export function hashRecoveryCode(uid: string, input: unknown) {
  const code = normalizeTwoStepInput(input);
  return createHash("sha256").update(`${uid}|${code}`).digest("hex");
}

export function looksLikeRecoveryCode(input: unknown) {
  return /^[A-Z2-9]{8}$/.test(normalizeTwoStepInput(input));
}

/** Locked after five wrong codes, for fifteen minutes from the last one. */
export function twoStepLockedUntil(failures: number, lastFailureMs: number | null) {
  if (failures < TWO_STEP_MAX_FAILURES || lastFailureMs === null) return null;
  return lastFailureMs + TWO_STEP_LOCK_MS;
}

/** A browser session or trusted device is looked up by the hash of its token, never the token. */
export function twoStepTokenKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newTwoStepToken() {
  return randomBytes(32).toString("base64url");
}
