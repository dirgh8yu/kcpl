import { sendStatement, staffStatementPdf } from "../../../../../../portal/portal-statement.server";
import { authorizeCrm, crmJson, protectCrmWrite, requireCrmCapability, requireCrmCustomerAccess } from "../../../crm-api";

/** Accounts look at a customer's statement before sending it. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageFinance");
  if (capabilityError) return capabilityError;
  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  const file = await staffStatementPdf(id);
  if (file.kind !== "ready") return crmJson({ ok: false, error: "The statement is not available just now." }, 503);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${file.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

/** Accounts email the statement to the customer's portal owners. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = protectCrmWrite(request);
  if (originError) return originError;
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageFinance");
  if (capabilityError) return capabilityError;
  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await sendStatement(id, { name: auth.user.displayName || auth.user.email, email: auth.user.email });
    if (result.kind === "sent") return crmJson({ ok: true, recipients: result.recipients });
    if (result.kind === "no_recipients") return crmJson({ ok: false, error: "This customer has no portal owner to send it to. Invite one from Portal access first." }, 409);
    if (result.kind === "email_unconfigured") return crmJson({ ok: false, error: "Email is not configured for KCPL." }, 503);
    return crmJson({ ok: false, error: "The statement could not be sent just now." }, 503);
  } catch (error) {
    console.error("KCPL statement send failed", id, error);
    return crmJson({ ok: false, error: "The statement could not be sent just now." }, 500);
  }
}
