import { staffRoleEnvironmentVariables } from "./staff-permissions";

type RuntimeEnv = Record<string, string | undefined>;

export type AdminSecurityConfigIssue = {
  severity: "error" | "warning";
  key: string;
  message: string;
};

const EMAIL_VARIABLES = [
  "KCPL_ADMIN_EMAILS",
  ...staffRoleEnvironmentVariables.map(([, variable]) => variable),
] as const;

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizedEmailSet(value: string | undefined) {
  return new Set(list(value).map((item) => item.toLowerCase()));
}

function validHttpsOrigin(value: string, allowLocalhost: boolean) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return url.origin === value.replace(/\/$/, "") && (url.protocol === "https:" || (allowLocalhost && local));
  } catch {
    return false;
  }
}

export function adminSecurityConfigIssues(env: RuntimeEnv = process.env): AdminSecurityConfigIssue[] {
  const issues: AdminSecurityConfigIssue[] = [];
  const production = env.NODE_ENV === "production";

  for (const variable of EMAIL_VARIABLES) {
    const invalid = list(env[variable]).filter((email) => !validEmail(email));
    if (invalid.length) {
      issues.push({
        severity: "error",
        key: variable,
        message: `${variable} contains ${invalid.length} invalid email entr${invalid.length === 1 ? "y" : "ies"}.`,
      });
    }
  }

  const memberships = new Map<string, string[]>();
  for (const [, variable] of staffRoleEnvironmentVariables) {
    for (const email of normalizedEmailSet(env[variable])) {
      const variables = memberships.get(email) ?? [];
      variables.push(variable);
      memberships.set(email, variables);
    }
  }
  const conflicts = [...memberships.values()].filter((variables) => variables.length > 1);
  if (conflicts.length) {
    issues.push({
      severity: "error",
      key: "KCPL_*_EMAILS",
      message: `${conflicts.length} staff email assignment${conflicts.length === 1 ? " is" : "s are"} present in multiple role lists. Role assignment must be unique.`,
    });
  }

  const adminEmails = normalizedEmailSet(env.KCPL_ADMIN_EMAILS);
  const configuredRoleEmails = new Set(memberships.keys());
  const ineffectiveRoleAssignments = [...configuredRoleEmails].filter((email) => !adminEmails.has(email));
  if (ineffectiveRoleAssignments.length) {
    issues.push({
      severity: "warning",
      key: "KCPL_ADMIN_EMAILS",
      message: `${ineffectiveRoleAssignments.length} environment role assignment${ineffectiveRoleAssignments.length === 1 ? " is" : "s are"} not in KCPL_ADMIN_EMAILS. These assignments only act as no-profile fallback after the account is otherwise authorised.`,
    });
  }

  if (adminEmails.size > 0 && configuredRoleEmails.size === 0) {
    issues.push({
      severity: "warning",
      key: "KCPL_ADMIN_EMAILS",
      message: "No environment role fallbacks are configured. Existing Firestore staff profiles remain authoritative; unprofiled allowlisted users receive no branch access after bootstrap.",
    });
  }

  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl && !validHttpsOrigin(siteUrl, !production)) {
    issues.push({
      severity: "error",
      key: "NEXT_PUBLIC_SITE_URL",
      message: "NEXT_PUBLIC_SITE_URL must be a valid origin without a path and must use HTTPS in production.",
    });
  }

  for (const origin of list(env.KCPL_ALLOWED_ORIGINS)) {
    if (!validHttpsOrigin(origin.replace(/\/$/, ""), !production)) {
      issues.push({
        severity: "error",
        key: "KCPL_ALLOWED_ORIGINS",
        message: "KCPL_ALLOWED_ORIGINS contains an invalid origin or a non-HTTPS production origin.",
      });
      break;
    }
  }

  const automationSecret = env.KCPL_AUTOMATION_SECRET?.trim() ?? "";
  if (automationSecret && automationSecret.length < 32) {
    issues.push({
      severity: "warning",
      key: "KCPL_AUTOMATION_SECRET",
      message: "KCPL_AUTOMATION_SECRET should be at least 32 characters of high-entropy secret material.",
    });
  }

  return issues;
}

let loggedFingerprint = "";

export function adminSecurityConfigurationValid(env: RuntimeEnv = process.env) {
  const issues = adminSecurityConfigIssues(env);
  const fingerprint = issues.map((issue) => `${issue.severity}:${issue.key}:${issue.message}`).join("|");
  if (fingerprint && fingerprint !== loggedFingerprint) {
    loggedFingerprint = fingerprint;
    for (const issue of issues) {
      const prefix = `[KCPL config ${issue.severity}] ${issue.key}: ${issue.message}`;
      if (issue.severity === "error") console.error(prefix);
      else console.warn(prefix);
    }
  }
  return !issues.some((issue) => issue.severity === "error");
}
