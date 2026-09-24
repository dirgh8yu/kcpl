import { adminSecurityConfigIssues } from "./admin/admin-security-config.ts";

type RuntimeEnv = Record<string, string | undefined>;

export type ProductionReadinessStatus = "ready" | "warning" | "blocked";

export type ProductionReadinessCheck = {
  id: string;
  label: string;
  status: ProductionReadinessStatus;
  detail: string;
};

export type ProductionRuntimeReadiness = {
  overall: ProductionReadinessStatus;
  checks: ProductionReadinessCheck[];
  summary: {
    ready: number;
    warnings: number;
    blocked: number;
  };
};

function text(env: RuntimeEnv, key: string) {
  return env[key]?.trim() ?? "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validHttpsOrigin(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/$/, "");
  } catch {
    return false;
  }
}

function firebaseConfig(env: RuntimeEnv) {
  const raw = text(env, "FIREBASE_CONFIG");
  if (!raw) return {} as { projectId?: string; storageBucket?: string };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      projectId: typeof parsed.projectId === "string" ? parsed.projectId.trim() : undefined,
      storageBucket: typeof parsed.storageBucket === "string" ? parsed.storageBucket.trim() : undefined,
    };
  } catch {
    return {} as { projectId?: string; storageBucket?: string };
  }
}

function check(id: string, label: string, status: ProductionReadinessStatus, detail: string): ProductionReadinessCheck {
  return { id, label, status, detail };
}


/* A NEXT_PUBLIC_* value is inlined into the bundle at build time. Reading it
 * through a dynamic lookup returns the *runtime* environment instead, which the
 * variable need not be present in, so the literal member access below is what
 * captures what the build actually baked in. The dynamic lookup still wins when
 * present, which is what lets a test supply one. */
const BUILD_TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "";

/** A capability that needs several variables together. Partial configuration is
 * reported separately from absence: absent means a feature is off, partial
 * usually means it is broken. */
function capability(
  checks: ProductionReadinessCheck[],
  id: string,
  label: string,
  parts: Array<{ key: string; value: string }>,
  offDetail: string,
) {
  const present = parts.filter((part) => part.value);
  if (present.length === parts.length) {
    checks.push(check(id, label, "ready", `${label} is configured.`));
    return;
  }
  const missing = parts.filter((part) => !part.value).map((part) => part.key);
  checks.push(present.length === 0
    ? check(id, label, "warning", offDetail)
    : check(id, label, "warning", `${label} is partially configured. Missing: ${missing.join(", ")}. A half-configured integration usually fails at the first call rather than staying off.`));
}

export function productionRuntimeReadiness(env: RuntimeEnv = process.env): ProductionRuntimeReadiness {
  const checks: ProductionReadinessCheck[] = [];
  const firebase = firebaseConfig(env);
  const firebaseRuntime = Boolean(
    firebase.projectId
    || text(env, "GOOGLE_CLOUD_PROJECT")
    || text(env, "GCLOUD_PROJECT")
    || text(env, "FIREBASE_PROJECT_ID"),
  );
  const storageBucket = firebase.storageBucket || text(env, "FIREBASE_STORAGE_BUCKET");

  checks.push(firebaseRuntime
    ? check("firebase-runtime", "Firebase runtime", "ready", "Firebase Admin runtime configuration is present.")
    : check("firebase-runtime", "Firebase runtime", "blocked", "Firebase Admin runtime configuration is missing."));

  checks.push(storageBucket
    ? check("firebase-storage", "Firebase Storage", "ready", "A default Storage bucket is configured for document workflows.")
    : check("firebase-storage", "Firebase Storage", "blocked", "No default Storage bucket is configured for Document Vault and archive files."));

  const siteUrl = text(env, "NEXT_PUBLIC_SITE_URL");
  checks.push(validHttpsOrigin(siteUrl)
    ? check("site-origin", "Canonical site origin", "ready", "NEXT_PUBLIC_SITE_URL is a valid HTTPS origin.")
    : check("site-origin", "Canonical site origin", "blocked", "NEXT_PUBLIC_SITE_URL must be set to the canonical HTTPS production origin without a path."));

  const automationSecret = text(env, "KCPL_AUTOMATION_SECRET");
  checks.push(automationSecret.length >= 32
    ? check("automation-secret", "Automation scheduler", "ready", "The scheduler bearer secret meets the minimum production length.")
    : check("automation-secret", "Automation scheduler", "blocked", "KCPL_AUTOMATION_SECRET must be configured with at least 32 characters."));

  const adminEmails = text(env, "KCPL_ADMIN_EMAILS");
  checks.push(adminEmails
    ? check("admin-bootstrap", "Admin bootstrap allowlist", "ready", "A bootstrap/recovery admin allowlist is configured.")
    : check("admin-bootstrap", "Admin bootstrap allowlist", "warning", "KCPL_ADMIN_EMAILS is empty. Existing active staff profiles can still authenticate, but bootstrap/recovery access is unavailable."));

  const places = text(env, "GOOGLE_MAPS_PLACES_API_KEY");
  checks.push(places
    ? check("google-places", "Google Places", "ready", "Places autocomplete is configured.")
    : check("google-places", "Google Places", "warning", "GOOGLE_MAPS_PLACES_API_KEY is missing; location autocomplete will be unavailable."));

  const routes = text(env, "GOOGLE_MAPS_ROUTES_API_KEY");
  checks.push(routes
    ? check("google-routes", "Google Routes", "ready", "Road route estimation is configured.")
    : check("google-routes", "Google Routes", "warning", "GOOGLE_MAPS_ROUTES_API_KEY is missing; road route estimates will be unavailable."));

  const sendgridKey = text(env, "SENDGRID_API_KEY");
  const emailFrom = text(env, "KCPL_EMAIL_FROM");
  const emailReady = Boolean(sendgridKey && validEmail(emailFrom));
  checks.push(emailReady
    ? check("transactional-email", "Transactional email", "ready", "SendGrid and a valid sender address are configured.")
    : check("transactional-email", "Transactional email", "warning", "SENDGRID_API_KEY and a valid KCPL_EMAIL_FROM are required for quote and notification email delivery."));

  /* Machine callers all fail closed: with no secret the endpoint answers 503
   * rather than accepting an unauthenticated write. So an unset secret is a
   * silently unavailable integration, which is precisely what this probe is
   * for -- nothing here is a security hole, and all of it is invisible
   * otherwise. */
  capability(checks, "edi-transport", "EDI transport", [
    { key: "KCPL_EDI_SECRET", value: text(env, "KCPL_EDI_SECRET") },
  ], "KCPL_EDI_SECRET is missing; every EDI endpoint answers 503 and no 204, 990 or 214 can be exchanged.");

  capability(checks, "tracking-ingest", "Carrier tracking ingestion", [
    { key: "KCPL_TRACKING_INGEST_SECRET", value: text(env, "KCPL_TRACKING_INGEST_SECRET") },
  ], "KCPL_TRACKING_INGEST_SECRET is missing; machine tracking updates answer 503 and shipment visibility depends entirely on staff entry.");

  capability(checks, "pickup-integration", "Pickup integration", [
    { key: "KCPL_PICKUP_INTEGRATION_SECRET", value: text(env, "KCPL_PICKUP_INTEGRATION_SECRET") },
  ], "KCPL_PICKUP_INTEGRATION_SECRET is missing; machine pickup callbacks answer 503.");

  capability(checks, "gpt-actions", "GPT actions", [
    { key: "KCPL_GPT_ACTION_SECRET", value: text(env, "KCPL_GPT_ACTION_SECRET") },
  ], "KCPL_GPT_ACTION_SECRET is missing; the GPT action surface answers 503.");

  capability(checks, "web-push", "Portal web push", [
    { key: "KCPL_VAPID_PUBLIC_KEY", value: text(env, "KCPL_VAPID_PUBLIC_KEY") },
    { key: "KCPL_VAPID_PRIVATE_KEY", value: text(env, "KCPL_VAPID_PRIVATE_KEY") },
    { key: "KCPL_VAPID_SUBJECT", value: text(env, "KCPL_VAPID_SUBJECT") },
  ], "No VAPID keys are configured; the portal never offers push and the notification sweep skips the transport entirely.");

  capability(checks, "maersk", "Maersk integration", [
    { key: "MAERSK_CONSUMER_KEY", value: text(env, "MAERSK_CONSUMER_KEY") },
    { key: "MAERSK_WEBHOOK_SECRET", value: text(env, "MAERSK_WEBHOOK_SECRET") },
  ], "Maersk credentials are missing; schedule lookups and webhook ingestion are unavailable.");

  capability(checks, "dhl-express", "DHL Express integration", [
    { key: "DHL_EXPRESS_API_USER", value: text(env, "DHL_EXPRESS_API_USER") },
    { key: "DHL_EXPRESS_API_PASSWORD", value: text(env, "DHL_EXPRESS_API_PASSWORD") },
  ], "DHL Express credentials are missing; express tracking lookups are unavailable.");

  capability(checks, "searates", "SeaRates market estimate", [
    { key: "SEARATES_FREIGHT_INDEX_API_KEY", value: text(env, "SEARATES_FREIGHT_INDEX_API_KEY") },
  ], "SEARATES_FREIGHT_INDEX_API_KEY is missing; market rate estimates are unavailable.");

  const rateLimitSalt = text(env, "KCPL_RATE_LIMIT_SALT");
  checks.push(rateLimitSalt
    ? check("rate-limit-salt", "Quote rate-limit salt", "ready", "Rate-limit subjects are hashed with a private salt.")
    : check("rate-limit-salt", "Quote rate-limit salt", "warning", "KCPL_RATE_LIMIT_SALT is missing. Counters still work and are still hashed, but with a fixed label, so anyone hashing a known address could confirm a guess."));

  /* Half a challenge is worse than none. With a secret and no site key the form
   * sends no token, the server still demands one, and every public enquiry is
   * refused with a 403 -- the whole funnel, from one unset variable. */
  const challengeSecret = text(env, "CLOUDFLARE_TURNSTILE_SECRET_KEY");
  const challengeSiteKey = text(env, "NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY") || BUILD_TURNSTILE_SITE_KEY;
  if (challengeSecret && !challengeSiteKey) {
    checks.push(check("quote-challenge", "Quote attestation", "blocked", "CLOUDFLARE_TURNSTILE_SECRET_KEY is set without NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY. The form sends no token, the server requires one, and every quote submission is rejected with 403. Set both or neither."));
  } else if (!challengeSecret && challengeSiteKey) {
    checks.push(check("quote-challenge", "Quote attestation", "warning", "A Turnstile site key is built in but CLOUDFLARE_TURNSTILE_SECRET_KEY is missing, so the widget loads and nothing verifies it. Quotes still submit; the attestation is decorative until the secret is set."));
  } else if (challengeSecret) {
    checks.push(check("quote-challenge", "Quote attestation", "ready", "Turnstile attestation is configured on both sides."));
  } else {
    checks.push(check("quote-challenge", "Quote attestation", "warning", "Turnstile is not configured. The quote form is protected by validation, a honeypot and the durable rate limit only."));
  }

  for (const issue of adminSecurityConfigIssues(env)) {
    const id = `security-${issue.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (checks.some((item) => item.id === id)) continue;
    checks.push(check(
      id,
      `Security configuration: ${issue.key}`,
      issue.severity === "error" ? "blocked" : "warning",
      issue.message,
    ));
  }

  const summary = {
    ready: checks.filter((item) => item.status === "ready").length,
    warnings: checks.filter((item) => item.status === "warning").length,
    blocked: checks.filter((item) => item.status === "blocked").length,
  };
  const overall: ProductionReadinessStatus = summary.blocked ? "blocked" : summary.warnings ? "warning" : "ready";

  return { overall, checks, summary };
}
