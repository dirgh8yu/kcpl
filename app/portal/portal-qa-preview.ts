import { qaAuthBypassEnabled } from "../admin/qa-auth-bypass.ts";
import { portalCapabilitiesForRole } from "./portal-access-policy.ts";
import type { PortalSession } from "./portal-auth.ts";

/*
 * A preview identity for the customer portal, so its signed-in screens can be
 * rendered and reviewed without a real Firebase project and a real customer.
 *
 * This extends an auth bypass to a customer data surface, which the portal
 * documentation calls out as needing a deliberate decision, so it is fenced
 * twice over:
 *
 *   1. `qaAuthBypassEnabled` must already be true. That helper refuses unless
 *      the runtime is a Vercel preview or a development server, so neither
 *      flag can do anything on a production host.
 *   2. `KCPL_QA_PORTAL` must be set on top of it, so turning the staff preview
 *      on never silently opens a customer surface as a side effect.
 *
 * The session below is invented. It names a customer id no real record uses,
 * so the ordinary Firestore readers scope their queries to nothing and return
 * their empty states rather than another company's shipments.
 */

export const PORTAL_QA_PREVIEW_UID = "kcpl-qa-portal-preview";
export const PORTAL_QA_PREVIEW_CUSTOMER_ID = "KCPL-QA-PREVIEW-CUSTOMER";

type RuntimeEnv = Record<string, string | undefined>;

export function portalQaPreviewEnabled(env: RuntimeEnv = process.env) {
  if (env.KCPL_QA_PORTAL !== "true") return false;
  return qaAuthBypassEnabled(env);
}

/** The preview customer. `owner` so every screen is reachable: a member role
 * hides finance, and a preview that cannot open the invoice pages would not
 * show whether they render. */
export function portalQaPreviewSession(env: RuntimeEnv = process.env): PortalSession {
  const email = env.KCPL_QA_EMAIL?.trim().toLowerCase() || "qa@kcpl.local";
  return {
    uid: PORTAL_QA_PREVIEW_UID,
    email,
    displayName: "KCPL QA",
    customerId: PORTAL_QA_PREVIEW_CUSTOMER_ID,
    customerName: "KCPL QA Preview Customer",
    customers: [{ id: PORTAL_QA_PREVIEW_CUSTOMER_ID, name: "KCPL QA Preview Customer" }],
    role: "owner",
    capabilities: portalCapabilitiesForRole("owner"),
    locale: env.KCPL_QA_PORTAL_LOCALE === "ne" ? "ne" : "en",
  };
}

export function isPortalQaPreviewSession(session: { uid: string }, env: RuntimeEnv = process.env) {
  return portalQaPreviewEnabled(env) && session.uid === PORTAL_QA_PREVIEW_UID;
}
