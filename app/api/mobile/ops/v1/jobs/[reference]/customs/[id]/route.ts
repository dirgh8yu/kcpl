import { toggleJobChild } from "../../../../../../../../admin/job-file-actions.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../../../admin/ops-mobile-api.server";

/** Marks a customs step done or not done, through the same guarded function the web
 * Job File uses. */
export async function POST(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  return withStaffSession(request, async ({ user, staff }) => {
    const { reference, id } = await context.params;
    let completed: unknown;
    try {
      completed = ((await request.json()) as { completed?: unknown }).completed;
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The update could not be read." }, 400);
    }
    if (typeof completed !== "boolean") return opsJson({ ok: false, code: "invalid", error: "Say whether it is done." }, 400);

    const result = await toggleJobChild(reference, "customs_steps", id.slice(0, 180), completed, { name: user.displayName, email: user.email }, staff);
    if (result.kind === "updated") return opsJson({ ok: true });
    if (result.kind === "unavailable") return opsUnavailable();
    if (result.kind === "missing" || result.kind === "missing_child") return opsJson({ ok: false, code: "missing", error: "That item was not found." }, 404);
    return opsJson({ ok: false, code: "forbidden", error: "That item is outside your branch access." }, 403);
  });
}
