import { adminSecurityConfigIssues } from "./admin/admin-security-config";

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
