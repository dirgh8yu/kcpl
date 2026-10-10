import { firebaseAdminAuth, firebaseAdminDb } from "../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../integrations/sendgrid-email.server";
import { PARTNER_ACCOUNTS } from "./partner-auth";
import { normalizePartnerEmail, partnerEmailValid } from "./partner-access-policy";

/*
 * Partner portal logins, managed by KCPL staff from the partner's page. As
 * with customers, the account record grants the scope and the Firebase
 * identity proves the address: the invite is a set-your-password link, which
 * also verifies the email, so KCPL never handles the partner's password.
 */

type Actor = { name: string; email: string };

export type PartnerLogin = { email: string; name: string | null; active: boolean; created_at: string; last_sign_in_at: string | null };

function randomPassword() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "").slice(0, 40);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function listPartnerLogins(partnerId: string): Promise<PartnerLogin[]> {
  const snapshot = await firebaseAdminDb().collection(PARTNER_ACCOUNTS).where("partner_id", "==", partnerId).limit(50).get();
  return snapshot.docs.map((doc) => ({
    email: doc.id,
    name: typeof doc.get("name") === "string" ? doc.get("name") as string : null,
    active: doc.get("active") === true,
    created_at: typeof doc.get("created_at") === "string" ? doc.get("created_at") as string : "",
    last_sign_in_at: typeof doc.get("last_sign_in_at") === "string" ? doc.get("last_sign_in_at") as string : null,
  })).sort((a, b) => a.email.localeCompare(b.email));
}

/** Give someone at a partner a login, and send them the link to set their password. */
export async function invitePartnerLogin(partnerId: string, input: { email: string; name: string }, actor: Actor) {
  const email = normalizePartnerEmail(input.email);
  if (!partnerEmailValid(email)) return { kind: "invalid_email" as const };
  const db = firebaseAdminDb();
  const [partner, existing, staff, portal] = await Promise.all([
    db.collection("partners").doc(partnerId).get(),
    db.collection(PARTNER_ACCOUNTS).doc(email).get(),
    db.collection("staff_profiles").where("email", "==", email).limit(1).get(),
    db.collection("portal_accounts").doc(email).get(),
  ]);
  if (!partner.exists) return { kind: "missing" as const };
  if (partner.get("status") === "inactive") return { kind: "partner_inactive" as const };
  if (existing.exists && existing.get("partner_id") !== partnerId) return { kind: "other_partner" as const };
  // One address, one kind of access: a staff or customer login stays what it is.
  if (!staff.empty || portal.exists) return { kind: "address_in_use" as const };
  const partnerName = typeof partner.get("display_name") === "string" ? partner.get("display_name") as string : "Partner";
  const now = new Date().toISOString();
  await db.collection(PARTNER_ACCOUNTS).doc(email).set({
    email, partner_id: partnerId, partner_name: partnerName, name: input.name.trim().slice(0, 120) || null, active: true,
    created_at: existing.exists ? existing.get("created_at") ?? now : now, created_by_name: actor.name, created_by_email: actor.email, updated_at: now,
    ...(existing.exists ? {} : { uid: null, last_sign_in_at: null }),
  }, { merge: true });

  const auth = firebaseAdminAuth();
  try { await auth.getUserByEmail(email); }
  catch { await auth.createUser({ email, emailVerified: false, password: randomPassword() }); }
  const link = await auth.generatePasswordResetLink(email);
  if (!transactionalEmailConfigured()) return { kind: "link" as const, email, link };
  // Where to sign in afterwards, as other KCPL emails link back to the site.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
  const signInAt = origin ? `${origin}/partner` : "";
  await sendTransactionalEmail({
    to: email,
    subject: "Your KCPL partner portal access",
    category: "partner_invite",
    text: [
      `Kapileshwor Cargo Pvt. Ltd. has given ${partnerName} access to the KCPL partner portal.`,
      "",
      "Set your password and confirm your email address using the secure link below:",
      link,
      "",
      `Then sign in at ${signInAt || "the KCPL partner portal"} to see the shipments KCPL has shared with you, post their milestones and upload documents.`,
      "",
      "If you were not expecting this message, you can ignore it.",
    ].join("\n"),
    html: [
      `<p>Kapileshwor Cargo Pvt. Ltd. has given <strong>${escapeHtml(partnerName)}</strong> access to the KCPL partner portal.</p>`,
      `<p><a href="${escapeHtml(link)}">Set your password</a> to confirm your email address.</p>`,
      `<p>Then sign in${signInAt ? ` at <a href="${escapeHtml(signInAt)}">${escapeHtml(signInAt)}</a>` : " to the KCPL partner portal"} to see the shipments KCPL has shared with you, post their milestones and upload documents.</p>`,
      `<p>If you were not expecting this message, you can ignore it.</p>`,
    ].join(""),
  });
  return { kind: "sent" as const, email };
}

/** Switch a login off (or back on). Off takes effect on the partner's next request. */
export async function setPartnerLoginActive(partnerId: string, rawEmail: string, active: boolean, actor: Actor) {
  const email = normalizePartnerEmail(rawEmail);
  const ref = firebaseAdminDb().collection(PARTNER_ACCOUNTS).doc(email);
  const doc = await ref.get();
  if (!doc.exists || doc.get("partner_id") !== partnerId) return { kind: "missing" as const };
  await ref.update({ active, updated_at: new Date().toISOString(), updated_by_name: actor.name, updated_by_email: actor.email });
  // Revoking the identity's tokens ends any open session straight away.
  const uid = doc.get("uid");
  if (!active && typeof uid === "string" && uid) await firebaseAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
  return { kind: "updated" as const };
}
