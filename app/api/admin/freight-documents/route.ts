import { getAdminAccess } from "../../../admin/admin-auth";
import { generateFreightDocument, generatedFreightDocumentDownload, listFreightDocumentWorkspace } from "../../../admin/freight-documents/freight-documents.server";
import { generatedFreightDocumentKinds, type FreightDocumentInput, type GeneratedFreightDocumentKind } from "../../../admin/freight-documents/freight-documents";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 5000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Freight document access is not available for this account." }, 403) };
  return { user: access.user, staff };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const reference = clean(url.searchParams.get("reference"), 180).toUpperCase();
  const documentId = clean(url.searchParams.get("document"), 180);
  if (reference && documentId) {
    const result = await generatedFreightDocumentDownload(reference, documentId, auth.staff);
    if (result.kind === "ready") return json({ ok: true, url: result.url, filename: result.filename });
    if (result.kind === "missing" || result.kind === "missing_document") return json({ ok: false, error: "Generated freight document not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
    return json({ ok: false, error: "Generated document storage is unavailable." }, 503);
  }
  const result = await listFreightDocumentWorkspace(auth.staff);
  if (result.kind === "ready") return json({ ok: true, rows: result.rows, summary: result.summary, generated_at: result.generated_at });
  return json({ ok: false, error: "Freight document storage is unavailable." }, 503);
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin freight document generation is not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The freight document request could not be read." }, 400); }
  const reference = clean(body.reference, 180).toUpperCase();
  const kind = clean(body.kind, 60) as GeneratedFreightDocumentKind;
  if (!reference) return json({ ok: false, error: "Shipment reference is required." }, 400);
  if (!generatedFreightDocumentKinds.includes(kind)) return json({ ok: false, error: "Choose a supported freight document type." }, 400);
  const input: FreightDocumentInput = {
    kind,
    shipper: clean(body.shipper, 2000),
    consignee: clean(body.consignee, 2000),
    notifyParty: clean(body.notifyParty, 2000),
    cargoDescription: clean(body.cargoDescription, 4000),
    marksAndNumbers: clean(body.marksAndNumbers, 2000),
    packageType: clean(body.packageType, 500),
    freightTerms: clean(body.freightTerms, 500),
    placeOfReceipt: clean(body.placeOfReceipt, 1000),
    placeOfDelivery: clean(body.placeOfDelivery, 1000),
    masterReference: clean(body.masterReference, 500),
    houseReference: clean(body.houseReference, 500),
    incoterm: clean(body.incoterm, 200),
    specialInstructions: clean(body.specialInstructions, 5000),
    customerSafe: body.customerSafe === true,
  };
  const result = await generateFreightDocument(reference, input, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind === "created") return json({ ok: true, document: result.document, source: result.source }, 201);
  if (result.kind === "invalid") return json({ ok: false, error: result.issues.join(" "), issues: result.issues }, 400);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (result.kind === "storage_unavailable" || result.kind === "unavailable") return json({ ok: false, error: "Freight document generation storage is unavailable." }, 503);
  return json({ ok: false, error: "Freight document generation could not be completed." }, 409);
}
