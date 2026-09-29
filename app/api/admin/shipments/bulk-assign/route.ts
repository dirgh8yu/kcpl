import { getAdminAccess } from "../../../../admin/admin-auth";
import { reassignJob } from "../../../../admin/job-file-requests.server";
import { checkShipmentBranchAccess } from "../../../../admin/shipment-access.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

export const runtime = "nodejs";

const MAX_REFERENCES = 50;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Give several shipments the same owner. Each one goes through the same
 * branch check and reassignment the Job File and KCPL Ops use, so a bulk
 * change can never do what a single one could not. */
export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return json({ ok: false, error: "Your role can’t change shipment owners." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request couldn’t be read." }, 400); }
  const references = Array.isArray(body.references)
    ? [...new Set(body.references.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).filter(Boolean))]
    : [];
  if (!references.length) return json({ ok: false, error: "Choose at least one shipment." }, 400);
  if (references.length > MAX_REFERENCES) return json({ ok: false, error: `Choose ${MAX_REFERENCES} shipments or fewer at a time.` }, 400);

  const assigned: string[] = [];
  const failed: { reference: string; error: string }[] = [];
  for (const reference of references) {
    const scope = await checkShipmentBranchAccess(reference, staff);
    if (scope.kind !== "allowed") {
      failed.push({ reference, error: scope.kind === "forbidden" ? "Outside your branches." : scope.kind === "missing" ? "Not found." : "Couldn’t be reached." });
      continue;
    }
    const result = await reassignJob(reference, { assignedToUid: body.assignedToUid }, access.user, staff);
    if (result.status === 200) assigned.push(reference);
    else failed.push({ reference, error: String((result.body as { error?: string }).error ?? "Couldn’t be assigned.") });
  }
  return json({ ok: failed.length === 0, assigned, failed }, failed.length && !assigned.length ? 400 : 200);
}
