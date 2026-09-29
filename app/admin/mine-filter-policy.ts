export type CurrentStaff = { uid: string | null; email: string | null };

/** True when the row's owner is the signed-in person, by uid or email. */
export function ownedBy(me: CurrentStaff, owner: { uid?: string | null; email?: string | null }) {
  if (me.uid && owner.uid && owner.uid === me.uid) return true;
  const email = me.email?.trim().toLowerCase();
  return Boolean(email && owner.email && owner.email.trim().toLowerCase() === email);
}
