type RuntimeEnv = Record<string, string | undefined>;

export const QA_AUTH_BYPASS_UID = "kcpl-qa-preview";

export function qaAuthBypassEnabled(env: RuntimeEnv = process.env) {
  if (env.KCPL_QA_AUTH_BYPASS !== "true") return false;

  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "preview" || vercelEnv === "development";

  // v0 VM previews commonly run as a development server rather than as a
  // published Vercel deployment. Never allow the bypass in a production runtime.
  return env.NODE_ENV === "development";
}

export function qaAuthBypassIdentity(env: RuntimeEnv = process.env) {
  const email = env.KCPL_QA_EMAIL?.trim().toLowerCase() || "qa@kcpl.local";
  return {
    uid: QA_AUTH_BYPASS_UID,
    email,
    displayName: "KCPL QA",
  };
}

export function isQaAuthBypassUser(user: { uid: string }, env: RuntimeEnv = process.env) {
  return qaAuthBypassEnabled(env) && user.uid === QA_AUTH_BYPASS_UID;
}
