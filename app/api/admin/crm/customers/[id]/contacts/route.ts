import { crmCommunicationPreferences, type CrmCommunicationPreference } from "../../../../../../admin/crm/crm-data";
import { addCrmContact } from "../../../../../../admin/crm/crm-data.server";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, requireCrmCapability, requireCrmCustomerAccess, validEmail } from "../../../crm-api";

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
    return crmJson({ ok: false, error: "The contact could not be read." }, 400);
  }

  const name = cleanCrmText(body.name, 160);
  const jobTitle = cleanCrmText(body.jobTitle, 120);
  const email = cleanCrmText(body.email, 240).toLowerCase();
  const phone = cleanCrmText(body.phone, 60);
  const communicationPreference = cleanCrmText(body.communicationPreference, 30);
  const notes = cleanCrmText(body.notes, 2000);
  const isPrimary = body.isPrimary === true;

  if (name.length < 2) return crmJson({ ok: false, error: "Enter the contact's name." }, 400);
  if (!email && !phone) return crmJson({ ok: false, error: "Add at least an email or phone number for the contact." }, 400);
  if (!validEmail(email)) return crmJson({ ok: false, error: "Enter a valid contact email." }, 400);
  if (communicationPreference && !crmCommunicationPreferences.includes(communicationPreference as CrmCommunicationPreference)) {
    return crmJson({ ok: false, error: "Choose a valid communication preference." }, 400);
  }

  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await addCrmContact(id, {
      name,
      jobTitle,
      email,
      phone,
      communicationPreference: communicationPreference as CrmCommunicationPreference | "",
      isPrimary,
      notes,
    }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, contact: result.contact }, 201);
  } catch (error) {
    console.error("Failed to add KCPL CRM contact", id, error);
    return crmJson({ ok: false, error: "The contact could not be saved." }, 500);
  }
}
