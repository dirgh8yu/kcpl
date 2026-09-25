import { getPortalAccess } from "../../../portal/portal-auth";
import { portalStatementPdf } from "../../../portal/portal-statement.server";

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The signed-in customer's statement of account, as a PDF. */
export async function GET() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  const file = await portalStatementPdf(access.session);
  if (file.kind === "forbidden") return json({ ok: false, error: "This login does not see invoices." }, 403);
  if (file.kind === "unavailable") return json({ ok: false, error: "The statement is not available just now." }, 503);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(file.bytes.length),
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
