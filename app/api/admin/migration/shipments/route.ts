import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { importShipmentCsv, prepareShipmentImport, shipmentCsvTemplate, shipmentImportLimits } from "../../../../admin/migration/shipment-import.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorizeManagement() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return { response: json({ ok: false, error: "Migration Hub access is restricted to KCPL Management." }, 403) };
  return { user: access.user, staff };
}

export async function GET() {
  const auth = await authorizeManagement();
  if ("response" in auth) return auth.response;
  return new Response(shipmentCsvTemplate(), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="kcpl-shipment-import-template.csv"',
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeManagement();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin migration requests are not accepted." }, 403);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ ok: false, error: "The migration upload could not be read." }, 400); }

  const file = form.get("file");
  const action = String(form.get("action") ?? "preview").trim();
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a shipment CSV file." }, 400);
  if (action !== "preview" && action !== "import") return json({ ok: false, error: "Choose a valid migration action." }, 400);

  const limits = shipmentImportLimits();
  if (!file.name.toLowerCase().endsWith(".csv")) return json({ ok: false, error: "Stage 2 accepts CSV files only." }, 415);
  if (file.size <= 0) return json({ ok: false, error: "The selected CSV is empty." }, 400);
  if (file.size > limits.maxFileBytes) return json({ ok: false, error: "Stage 2 shipment CSV files must be 2 MB or smaller." }, 413);

  let csv: string;
  try { csv = await file.text(); }
  catch { return json({ ok: false, error: "The CSV could not be decoded as text." }, 400); }

  try {
    if (action === "preview") {
      const result = await prepareShipmentImport(file.name, csv);
      if (result.kind === "unavailable") return json({ ok: false, error: "Firebase shipment storage is unavailable." }, 503);
      if (result.kind === "invalid_file") return json({ ok: false, error: result.error }, 400);
      return json({ ok: true, preview: result.preview, limits });
    }

    const result = await importShipmentCsv(file.name, csv, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase shipment storage is unavailable." }, 503);
    if (result.kind === "invalid_file") return json({ ok: false, error: result.error }, 400);
    return json({ ok: true, result: result.result });
  } catch (error) {
    console.error("KCPL shipment migration failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Shipment migration failed." }, 500);
  }
}
