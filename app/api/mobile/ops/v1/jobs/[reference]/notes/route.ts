import { addOpsFieldNote } from "../../../../../../../admin/ops-field.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../../admin/ops-mobile-api.server";

/** A note from the field, with or without a photo. Branch access is checked
 * before anything is read; the photo is an ordinary staff upload to the job's
 * Document Vault and the note is Job File activity. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async (session) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The note could not be read." }, 400);
    }
    const { reference } = await context.params;
    try {
      const result = await addOpsFieldNote(reference, form, session);
      if (result.kind === "refused") return opsJson({ ok: false, code: result.code, error: result.error }, result.status);
      return opsJson({ ok: true, note: result.value }, 201);
    } catch (error) {
      console.error("KCPL ops field note failed", error);
      return opsUnavailable();
    }
  });
}
