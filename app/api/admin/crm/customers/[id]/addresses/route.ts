import { addCrmAddress } from "../../../../../../admin/crm/crm-data.server";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, requireCrmCapability, requireCrmCustomerAccess } from "../../../crm-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const blocked = protectCrmWrite(request);
  if (blocked) return blocked;
  const capabilityError = requireCrmCapability(auth.permissions, "canEditCustomer");
  if (capabilityError) return capabilityError;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The address could not be read." }, 400);
  }

  const label = cleanCrmText(body.label, 80) || "Address";
  const line1 = cleanCrmText(body.line1, 220);
  const line2 = cleanCrmText(body.line2, 220);
  const city = cleanCrmText(body.city, 120);
  const stateRegion = cleanCrmText(body.stateRegion, 120);
  const postalCode = cleanCrmText(body.postalCode, 40);
  const country = cleanCrmText(body.country, 100);
  const isPrimary = body.isPrimary === true;

  if (!line1) return crmJson({ ok: false, error: "Enter the street/address line." }, 400);
  if (!city) return crmJson({ ok: false, error: "Enter the city." }, 400);
  if (!country) return crmJson({ ok: false, error: "Enter the country." }, 400);

  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await addCrmAddress(id, { label, line1, line2, city, stateRegion, postalCode, country, isPrimary }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, address: result.address }, 201);
  } catch (error) {
    console.error("Failed to add KCPL CRM address", id, error);
    return crmJson({ ok: false, error: "The address could not be saved." }, 500);
  }
}
