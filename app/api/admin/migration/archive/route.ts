import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { kcplBranches, type KcplBranch } from "../../../../admin/crm/crm-data";
import {
  createPaperArchiveRecord,
  listPaperArchive,
  PAPER_ARCHIVE_MAX_FILE_BYTES,
  paperArchiveAllowedExtensions,
} from "../../../../admin/migration/archive/archive.server";
import {
  archiveCategories,
  archiveEntityTypes,
  type ArchiveCategory,
  type ArchiveEntityType,
} from "../../../../admin/migration/archive/archive-data";
import { isTrustedSameOriginRequest } from "../../../../request-security";

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

function extension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export async function GET() {
  const auth = await authorizeArchive();
  if ("response" in auth) return auth.response;
  try {
    const dashboard = await listPaperArchive();
    if (!dashboard) return json({ ok: false, error: "Firebase archive metadata storage is unavailable." }, 503);
    return json({ ok: true, dashboard });
  } catch (error) {
    console.error("Failed to load KCPL paper archive", error);
    return json({ ok: false, error: "Paper archive could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeArchive();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin archive uploads are not accepted." }, 403);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ ok: false, error: "The archive upload could not be read." }, 400); }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a scanned document or archive file." }, 400);
  if (!file.name.trim() || file.name.length > 240) return json({ ok: false, error: "The file name is invalid." }, 400);
  if (file.size <= 0) return json({ ok: false, error: "The selected file is empty." }, 400);
  if (file.size > PAPER_ARCHIVE_MAX_FILE_BYTES) return json({ ok: false, error: "Archive files must be 20 MB or smaller." }, 413);

  const ext = extension(file.name);
  const contentType = paperArchiveAllowedExtensions[ext];
  if (!contentType) return json({ ok: false, error: "Use PDF, JPG, PNG, WEBP, Word, Excel, CSV or TXT files." }, 415);

  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() as ArchiveCategory;
  const branch = String(form.get("branch") ?? "").trim() as KcplBranch;
  const documentDate = String(form.get("documentDate") ?? "").trim() || null;
  const physicalReference = String(form.get("physicalReference") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const entityType = String(form.get("entityType") ?? "general").trim() as ArchiveEntityType;
  const entityReference = String(form.get("entityReference") ?? "").trim() || null;

  if (!archiveCategories.includes(category)) return json({ ok: false, error: "Choose a valid archive category." }, 400);
  if (!archiveEntityTypes.includes(entityType)) return json({ ok: false, error: "Choose a valid linked-record type." }, 400);
  if (!kcplBranches.includes(branch)) return json({ ok: false, error: "Choose a valid KCPL branch." }, 400);

  try {
    const result = await createPaperArchiveRecord({
      title,
      category,
      documentDate,
      branch,
      physicalReference,
      notes,
      entityType,
      entityReference,
      filename: file.name.trim(),
      contentType,
      sizeBytes: file.size,
      data: await file.arrayBuffer(),
    }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase Storage is not configured for the paper archive." }, 503);
    if (result.kind === "invalid") return json({ ok: false, error: result.error }, 400);
    return json({ ok: true, record: result.record }, 201);
  } catch (error) {
    console.error("KCPL Stage 4B paper archive upload failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Paper archive upload failed." }, 500);
  }
}
