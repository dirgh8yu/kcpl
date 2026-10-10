import { createCargoClaim, type ClaimPhoto } from "../../../../../cargo-claims.server";
import { CLAIM_MAX_PHOTOS, claimReportFromInput } from "../../../../../cargo-claims";
import { nepalOperationalDate } from "../../../../../invoice-effective-status";
import { validateShipmentDocumentBytes } from "../../../../../shipment-document-policy";
import { portalIntakeExtension } from "../../../../../portal/portal-intake";
import { getAdminAccess } from "../../../../../admin/admin-auth";
import { checkShipmentBranchAccess } from "../../../../../admin/shipment-access.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { json } from "../../job-route-auth";

const PHOTO_TYPES: Readonly<Record<string, string>> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const MAX_BYTES = 15 * 1024 * 1024;
const errors: Record<string, string> = {
  kind: "Choose what happened.",
  description: "Describe what happened in a sentence or two.",
  date: "Enter the day the problem was found, not a future date.",
  amount: "Enter the value as a number, or leave it blank.",
};

/** Staff open a claim for the customer (reported by phone, email or at delivery), with photos if they have them. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return json({ ok: false, error: "Job File editing is not available for this account." }, 403);
  const { reference } = await context.params;
  const normalized = reference.trim().toUpperCase();
  const branch = await checkShipmentBranchAccess(normalized, staff);
  if (branch.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (branch.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (branch.kind === "unavailable") return json({ ok: false, error: "Shipment records aren’t responding. Try again in a minute." }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ ok: false, error: "The claim could not be read." }, 400); }
  const field = (key: string) => typeof form.get(key) === "string" ? form.get(key) as string : "";
  const checked = claimReportFromInput({ kind: field("kind"), description: field("description"), noticedOn: field("noticedOn"), claimedAmount: field("claimedAmount"), currency: field("currency") }, nepalOperationalDate());
  if (!checked.ok) return json({ ok: false, error: errors[checked.error] }, 400);
  const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > CLAIM_MAX_PHOTOS) return json({ ok: false, error: `Attach up to ${CLAIM_MAX_PHOTOS} photos; add more under Documents.` }, 400);
  const photos: ClaimPhoto[] = [];
  for (const file of files) {
    const ext = portalIntakeExtension(file.name);
    const contentType = PHOTO_TYPES[ext];
    if (!contentType || file.size > MAX_BYTES) return json({ ok: false, error: "Photos must be JPEG, PNG, WEBP or PDF, up to 15 MB each." }, 400);
    const data = await file.arrayBuffer();
    const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
    if (signatureError) return json({ ok: false, error: signatureError }, 400);
    photos.push({ filename: file.name, contentType, data });
  }
  try {
    const result = await createCargoClaim(normalized, checked.value, photos, { name: access.user.displayName, email: access.user.email, source: "staff" });
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    return json({ ok: true, id: result.id, number: result.number });
  } catch (error) {
    console.error("KCPL claim create failed", error);
    return json({ ok: false, error: "The claim couldn’t be saved. Try again." }, 500);
  }
}
