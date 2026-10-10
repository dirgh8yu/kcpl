import { recordOpsContainerMovement } from "../../../../../../../../admin/ops-containers.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../../../admin/ops-mobile-api.server";

/** A container date from the field (out of the port, delivered, empty back), with a photo of the gate receipt. */
export async function POST(request: Request, context: { params: Promise<{ reference: string; number: string }> }) {
  return withStaffSession(request, async (session) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The update could not be read." }, 400);
    }
    const { reference, number } = await context.params;
    try {
      const result = await recordOpsContainerMovement(reference, decodeURIComponent(number), form, session);
      if (result.kind === "refused") return opsJson({ ok: false, code: result.code, error: result.error }, result.status);
      return opsJson({ ok: true, container: result.container });
    } catch (error) {
      console.error("KCPL ops container update failed", error);
      return opsUnavailable();
    }
  });
}
