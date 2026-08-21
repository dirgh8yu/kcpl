import { linkQuoteToCrmCustomer, listCrmQuoteLinks } from "../../../../../../admin/crm/crm-quote-links.server";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, requireCrmCapability } from "../../../crm-api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  try {
    const result = await listCrmQuoteLinks(id);
    if (result === null) return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    return crmJson({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to list KCPL CRM quote links", id, error);
    return crmJson({ ok: false, error: "Quote links could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const forbidden = requireCrmCapability(auth.permissions, "canEditCustomer");
  if (forbidden) return forbidden;
  const blocked = protectCrmWrite(request);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The quote link could not be read." }, 400);
  }

  const quoteReference = cleanCrmText(body.quoteReference, 120).toUpperCase();
  if (!quoteReference) return crmJson({ ok: false, error: "Choose a quote to link." }, 400);

  const { id } = await context.params;
  try {
    const result = await linkQuoteToCrmCustomer(id, quoteReference, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing_customer") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    if (result.kind === "missing_quote") return crmJson({ ok: false, error: "Quote not found." }, 404);
    return crmJson({ ok: true, customerId: id.toUpperCase(), quoteReference });
  } catch (error) {
    console.error("Failed to link KCPL quote to CRM customer", id, quoteReference, error);
    return crmJson({ ok: false, error: "The quote could not be linked to this customer." }, 500);
  }
}