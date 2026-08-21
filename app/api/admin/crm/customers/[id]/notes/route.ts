import { addCrmNote } from "../../../../../../admin/crm/crm-data.server";
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
    return crmJson({ ok: false, error: "The note could not be read." }, 400);
  }

  const note = cleanCrmText(body.note, 5000);
  if (!note) return crmJson({ ok: false, error: "Write a note before saving." }, 400);

  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await addCrmNote(id, note, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, note: result.note }, 201);
  } catch (error) {
    console.error("Failed to add KCPL CRM note", id, error);
    return crmJson({ ok: false, error: "The note could not be saved." }, 500);
  }
}
