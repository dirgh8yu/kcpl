import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { getPaperArchiveFile } from "../../../../../../admin/migration/archive/archive.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorizeArchive() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return { response: json({ ok: false, error: "Paper archive access is restricted to KCPL Management." }, 403) };
  return { user: access.user };
}

function downloadName(filename: string) {
  return filename.replace(/["\\\r\n]/g, "-").slice(0, 180) || "kcpl-archive-document";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeArchive();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  try {
    const result = await getPaperArchiveFile(id);
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase Storage is not configured for the paper archive." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Archive record not found." }, 404);
    if (result.kind === "object-missing") return json({ ok: false, error: "Archive metadata exists but the stored file is missing." }, 410);
    return new Response(result.bytes, {
      status: 200,
      headers: {
        "content-type": result.record.content_type,
        "content-length": String(result.bytes.byteLength),
        "content-disposition": `attachment; filename="${downloadName(result.record.filename)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to download KCPL paper archive file", error);
    return json({ ok: false, error: "Archive file could not be downloaded." }, 500);
  }
}
