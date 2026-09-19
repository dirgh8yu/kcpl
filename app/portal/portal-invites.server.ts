import { firebaseAdminAuth } from "../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../integrations/sendgrid-email.server";
import { normalizePortalEmail } from "./portal-access-policy";

/*
 * Portal invitations.
 *
 * Provisioning a portal account (the Firestore record) and creating the
 * Firebase identity are separate steps on purpose: the account record is what
 * grants scope, and it is useless without a verified Firebase identity that
 * proves control of the address.
 *
 * The invite is a Firebase password-reset link rather than a password KCPL
 * chooses. Completing a password reset both sets the customer's own password
 * and marks the address verified in Firebase, which is exactly the state the
 * portal's sign-in gate requires -- so a single link finishes onboarding
 * without KCPL ever handling the customer's credentials.
 */

export type PortalInviteResult =
  | { kind: "sent"; email: string }
  | { kind: "link"; email: string; link: string }
  | { kind: "invalid" }
  | { kind: "unavailable" };

function randomPassword() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "").slice(0, 40);
}

export async function createPortalInvite(rawEmail: string, customerName: string): Promise<PortalInviteResult> {
  const email = normalizePortalEmail(rawEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: "invalid" };

  const auth = firebaseAdminAuth();
  try {
    try {
      await auth.getUserByEmail(email);
    } catch {
      // No identity yet: create one the customer cannot sign in with until they
      // complete the reset link below.
      await auth.createUser({ email, emailVerified: false, password: randomPassword() });
    }

    const link = await auth.generatePasswordResetLink(email);
    if (!transactionalEmailConfigured()) return { kind: "link", email, link };

    await sendTransactionalEmail({
      to: email,
      subject: "Your KCPL customer portal access",
      category: "portal_invite",
      text: [
        `Kapileshwor Cargo Pvt. Ltd. has enabled customer portal access for ${customerName}.`,
        "",
        "Set your password and confirm your email address using the secure link below:",
        link,
        "",
        "After that, sign in at the KCPL customer portal to track shipments, download released documents and review your account.",
        "",
        "If you were not expecting this message, you can ignore it.",
      ].join("\n"),
      html: [
        `<p>Kapileshwor Cargo Pvt. Ltd. has enabled customer portal access for <strong>${escapeHtml(customerName)}</strong>.</p>`,
        `<p>Set your password and confirm your email address using the secure link below:</p>`,
        `<p><a href="${escapeHtml(link)}">Set your KCPL portal password</a></p>`,
        `<p>After that, sign in at the KCPL customer portal to track shipments, download released documents and review your account.</p>`,
        `<p>If you were not expecting this message, you can ignore it.</p>`,
      ].join(""),
    });
    return { kind: "sent", email };
  } catch (error) {
    console.error("KCPL portal invite failed", error);
    return { kind: "unavailable" };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
