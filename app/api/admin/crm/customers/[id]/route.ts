import { getCrmCustomer } from "../../../../../admin/crm/crm-data.server";
import { authorizeCrm, crmJson } from "../../crm-api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  try {
    const customer = await getCrmCustomer(id);
    if (customer === undefined) return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (!customer || customer.archived) return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, customer });
  } catch (error) {
    console.error("Failed to load KCPL CRM customer", id, error);
    return crmJson({ ok: false, error: "The customer record could not be loaded." }, 500);
  }
}
