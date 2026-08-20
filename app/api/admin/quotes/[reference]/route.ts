import { getAdminAccess } from "../../../../admin/admin-auth";
import { addQuoteNote, getQuoteDetail, quoteStatuses, QuoteStatus, updateQuoteAdmin } from "../../../../admin/admin-data";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference } = await context.params;
  const quote = await getQuoteDetail(reference);
  if (quote === undefined) return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (!quote) return json({ ok: false, error: "Quote not found." }, 404);
  return json({ ok: true, quote });
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: { status?: unknown; assignedTo?: unknown };
  try {
    body = await request.json() as { status?: unknown; assignedTo?: unknown };
  } catch {
    return json({ ok: false, error: "The update could not be read." }, 400);
  }

  const status = typeof body.status === "string" ? body.status : "";
  const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
  if (!quoteStatuses.includes(status as QuoteStatus)) return json({ ok: false, error: "Choose a valid quote status." }, 400);
  if (assignedTo.length > 120) return json({ ok: false, error: "Assignee must be 120 characters or fewer." }, 400);

  const result = await updateQuoteAdmin(reference, status as QuoteStatus, assignedTo);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);
  return json({ ok: true, status, assignedTo });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: { note?: unknown };
  try {
    body = await request.json() as { note?: unknown };
  } catch {
    return json({ ok: false, error: "The note could not be read." }, 400);
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return json({ ok: false, error: "Write a note before saving." }, 400);
  if (note.length > 3000) return json({ ok: false, error: "Notes must be 3000 characters or fewer." }, 400);

  const result = await addQuoteNote(reference, note, auth.user.displayName, auth.user.email);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);
  return json({ ok: true, note: result.note }, 201);
}
