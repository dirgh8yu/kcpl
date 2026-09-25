import { lookupOpsJobs } from "../../../../../admin/ops-field.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** Which job a scanned container number, barcode or typed reference means,
 * within the caller's branches only. */
export async function GET(request: Request) {
  return withStaffSession(request, async ({ staff }) => {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    try {
      const result = await lookupOpsJobs(query, staff);
      if (result.kind === "refused") return opsJson({ ok: false, code: result.code, error: result.error }, result.status);
      return opsJson({ ok: true, matches: result.value });
    } catch (error) {
      console.error("KCPL ops lookup failed", error);
      return opsUnavailable();
    }
  });
}
