import { getAdminAccess } from "../../../../admin/admin-auth";
import { deleteVaultDocument } from "../../../../admin/documents/document-vault.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin document changes are not accepted." }, 403);

  const staff = await getStaffContext(access.user);
  const { id } = await params;
  const result = await deleteVaultDocument(id, {
    name: access.user.displayName,
    email: access.user.email,
  }, staff);

  if (result.kind === "deleted") return json({ ok: true });
  if (result.kind === "forbidden") return json({ ok: false, error: "You do not have permission to delete this document." }, 403);
  if (result.kind === "unavailable") return json({ ok: false, error: "Firebase is unavailable." }, 503);
  if (result.kind === "storage_error") return json({ ok: false, error: "The stored file could not be deleted." }, 502);
  return json({ ok: false, error: "The document could not be found." }, 404);
}
