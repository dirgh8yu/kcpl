import { getAdminAccess } from "../../../../../admin/admin-auth";
import { downloadVaultDocument } from "../../../../../admin/documents/document-vault.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);

  const staff = await getStaffContext(access.user);
  const { id } = await params;
  const result = await downloadVaultDocument(id, staff);
  if (result.kind === "forbidden") return json({ ok: false, error: "You do not have access to this document." }, 403);
  if (result.kind === "storage_unconfigured") return json({ ok: false, error: "Firebase Storage is not configured." }, 503);
  if (result.kind === "unavailable") return json({ ok: false, error: "Firebase is unavailable." }, 503);
  if (result.kind !== "ready") return json({ ok: false, error: "The document file could not be found." }, 404);

  const encodedName = encodeURIComponent(result.document.file_name);
  return new Response(result.bytes, {
    status: 200,
    headers: {
      "content-type": result.document.content_type || "application/octet-stream",
      "content-length": String(result.bytes.byteLength),
      "content-disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
