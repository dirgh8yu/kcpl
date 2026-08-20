import { headers } from "next/headers";

const SESSION_COOKIE = "kcpl_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminUser = {
  displayName: string;
  email: string;
};

export type AdminAccess =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "authorized"; user: AdminUser };

type AdminConfig = {
  password: string;
  sessionSecret: string;
  name: string;
  email: string;
};

async function getConfig(): Promise<AdminConfig> {
  try {
    const { env } = await import("cloudflare:workers");
    const runtimeEnv = env as unknown as Partial<CloudflareEnv>;
    return {
      password: runtimeEnv.KCPL_ADMIN_PASSWORD ?? "",
      sessionSecret: runtimeEnv.KCPL_ADMIN_SESSION_SECRET ?? "",
      name: runtimeEnv.KCPL_ADMIN_NAME?.trim() || "KCPL Admin",
      email: runtimeEnv.KCPL_ADMIN_EMAIL?.trim() || "admin@kcpl.internal",
    };
  } catch {
    const localEnv: Record<string, string | undefined> =
      typeof process !== "undefined" ? process.env : {};
    return {
      password: localEnv.KCPL_ADMIN_PASSWORD ?? "",
      sessionSecret: localEnv.KCPL_ADMIN_SESSION_SECRET ?? "",
      name: localEnv.KCPL_ADMIN_NAME?.trim() || "KCPL Admin",
      email: localEnv.KCPL_ADMIN_EMAIL?.trim() || "admin@kcpl.internal",
    };
  }
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const config = await getConfig();
  if (!config.password || !config.sessionSecret) return { kind: "unconfigured" };

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token || !(await verifySessionToken(token, config.sessionSecret))) {
    return { kind: "signed-out" };
  }

  return {
    kind: "authorized",
    user: { displayName: config.name, email: config.email },
  };
}

export async function verifyAdminPassword(password: string) {
  const config = await getConfig();
  if (!config.password || !config.sessionSecret) {
    return { kind: "unconfigured" as const };
  }

  const valid = await constantTimeEqual(password, config.password);
  return valid
    ? { kind: "valid" as const, sessionSecret: config.sessionSecret }
    : { kind: "invalid" as const };
}

export async function createAdminSessionToken(sessionSecret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const signature = await sign(payload, sessionSecret);
  return `${payload}.${signature}`;
}

export function adminSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function verifySessionToken(token: string, secret: string) {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return false;

  const expiresAt = Number(payload);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

async function constantTimeEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  for (const chunk of cookieHeader.split(";")) {
    const trimmed = chunk.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return "";
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
