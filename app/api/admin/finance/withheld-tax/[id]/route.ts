import { setTdsCertificate } from "../../../../../admin/finance/tax-books.server";
import { creditError, financeWriteRequest, json } from "../../credit-route-auth";

/** The certificate number for TDS a customer withheld. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = await setTdsCertificate(decodeURIComponent(id), typeof auth.body.certificateNumber === "string" ? auth.body.certificateNumber : "", auth.actor, auth.staff);
  if (result.kind === "updated") return json({ ok: true });
  if (result.kind === "certificate_required") return json({ ok: false, error: "Enter the certificate number." }, 400);
  return creditError(result.kind);
}
