import type { AdminUser } from "./admin-auth";
import { checkShipmentBranchAccess } from "./shipment-access.server";
import type { KcplStaffContext } from "./staff-directory.server";
import { OPS_FIELD_PHOTO_MAX_BYTES, opsFieldPhotoExtensions } from "./ops-field";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import { uploadShipmentDocument } from "../shipment-documents.server";
import { recordContainerMovement } from "../shipment-containers.server";

/*
 * Container dates from the KCPL Ops app: out of the port, delivered, empty
 * back at the depot, with a photo of the gate receipt. Branch access first,
 * as for a field note; the photo is an ordinary staff upload to the job's
 * documents, and only the one date moves on the container.
 */

type Refused = { kind: "refused"; status: number; code: string; error: string };
const refused = (status: number, code: string, error: string): Refused => ({ kind: "refused", status, code, error });

function extension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export async function recordOpsContainerMovement(reference: string, number: string, form: FormData, { user, staff }: { user: AdminUser; staff: KcplStaffContext }) {
  const normalized = reference.trim().toUpperCase();
  if (!staff.permissions.canManageJobFile) return refused(403, "forbidden", "Job File editing is not available for this account.");
  const access = await checkShipmentBranchAccess(normalized, staff);
  if (access.kind === "unavailable") return refused(503, "unavailable", "Job storage is unavailable.");
  if (access.kind === "missing") return refused(404, "missing", "Shipment not found.");
  if (access.kind === "forbidden") return refused(403, "forbidden", "This shipment is outside your branch access.");

  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  let documentId: number | null = null;
  if (photo) {
    const ext = extension(photo.name);
    const contentType = opsFieldPhotoExtensions[ext];
    if (!contentType) return refused(415, "unsupported", "Send a photo (JPEG, PNG or WEBP) or a PDF.");
    if (photo.size > OPS_FIELD_PHOTO_MAX_BYTES) return refused(413, "too_large", "Photos must be 15 MB or smaller.");
    const data = await photo.arrayBuffer();
    const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
    if (signatureError) return refused(415, "unsupported", signatureError);
    const upload = await uploadShipmentDocument(normalized, {
      filename: `Gate receipt ${number.toUpperCase()} - ${photo.name.trim()}`.slice(0, 240), contentType, sizeBytes: photo.size, documentType: "other",
      uploadedBy: user.displayName, uploadedByEmail: user.email, data,
    });
    if (upload.kind === "unavailable") return refused(503, "unavailable", "Document storage is unavailable.");
    if (upload.kind === "created" || upload.kind === "duplicate") documentId = typeof upload.document?.id === "number" ? upload.document.id : null;
  }

  const result = await recordContainerMovement(normalized, number, { movement: form.get("movement"), on: form.get("on"), documentId }, { name: user.displayName, email: user.email });
  if (result.kind === "missing") return refused(404, "missing", "That container isn’t on this shipment.");
  if (result.kind === "invalid") {
    if (result.error === "movement") return refused(400, "invalid", "Choose what happened to the container.");
    if (result.error === "date") return refused(400, "invalid", "Choose today or an earlier day.");
    return refused(409, "conflict", "That date is out of order: out of the port, then delivered, then the empty back.");
  }
  return { kind: "ok" as const, container: result.container };
}
