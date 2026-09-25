import { podEvidenceFromForm } from "../../../../../../../../admin/delivery/delivery-requests.server";
import { opsJson, withStaffSession } from "../../../../../../../../admin/ops-mobile-api.server";

/** A signature, photo or document as proof of delivery, on a delivered
 * attempt. It enters as received; verification stays at the desk. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ user, staff }) => {
    const { reference } = await context.params;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The POD upload could not be read." }, 400);
    }
    const result = await podEvidenceFromForm(reference, form, { name: user.displayName, email: user.email }, staff);
    return opsJson(result.body, result.status);
  });
}
