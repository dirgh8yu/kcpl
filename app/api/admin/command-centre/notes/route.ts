import { getAdminAccess } from "../../../../admin/admin-auth";
import { createOperationalNote } from "../../../../admin/command-centre/operational-notes.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  let body: { message?: unknown; branch?: unknown };
  try {
    body = await request.json() as { message?: unknown; branch?: unknown };
  } catch {
    return json({ ok: false, error: "Operational note request is invalid." }, 400);
  }

  try {
    const staff = await getStaffContext(access.user);
    const result = await createOperationalNote({
      message: typeof body.message === "string" ? body.message : "",
      branch: typeof body.branch === "string" ? body.branch : null,
    }, {
      name: access.user.displayName,
      email: access.user.email,
    }, staff);

    if (result.kind === "created") return json({ ok: true, note: result.note }, 201);
    if (result.kind === "forbidden") return json({ ok: false, error: "You do not have access to post this operational note." }, 403);
    if (result.kind === "branch_required") return json({ ok: false, error: "Choose an accessible branch before posting this note." }, 400);
    if (result.kind === "invalid_branch") return json({ ok: false, error: "Choose a valid KCPL branch." }, 400);
    if (result.kind === "invalid_message") return json({ ok: false, error: "Operational notes must be between 3 and 500 characters." }, 400);
    return json({ ok: false, error: "Operational notes are temporarily unavailable." }, 503);
  } catch (error) {
    console.error("Failed to create KCPL operational note", error);
    return json({ ok: false, error: "Operational note could not be posted." }, 500);
  }
}
