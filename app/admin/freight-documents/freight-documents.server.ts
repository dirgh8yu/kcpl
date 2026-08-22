import { createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminBucket, firebaseAdminDb, firebaseRuntimeConfigured, firebaseStorageBucketName } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { renderFreightDocumentPdf } from "./freight-document-pdf";
import {
  generatedDocumentTypeMap,
  generatedFreightDocumentKinds,
  generatedFreightDocumentLabels,
  generatedReference,
  primaryCarriageDocumentKind,
  recommendedGeneratedDocumentKinds,
  validateFreightDocumentInput,
  type FreightDocumentInput,
  type FreightDocumentQueueRow,
  type FreightDocumentSource,
  type GeneratedFreightDocumentKind,
  type GeneratedFreightDocumentRow,
} from "./freight-documents";

type Actor = { name: string; email: string };
function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const result = text(value); return result || null; }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function numericId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }
function generationId() { return `FD-${Date.now()}-${randomBytes(5).toString("hex").toUpperCase()}`; }

async function getAll(collection: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 200) {
    const snapshots = await db.getAll(...unique.slice(index, index + 200).map((id) => db.collection(collection).doc(id)));
    for (const snapshot of snapshots) if (snapshot.exists) result.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return result;
}

async function shipmentSource(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const shipmentRef = db.collection("shipments").doc(id);
  const shipment = await shipmentRef.get();
  if (!shipment.exists) return { kind: "missing" as const };
  const data = shipment.data() as Record<string, unknown>;
  const branch = branchValue(data.primary_branch) ?? branchValue(Array.isArray(data.handling_branches) ? data.handling_branches[0] : null);
  if (!branch) return { kind: "invalid_branch" as const };
  if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
  const [quote, customer, order, tender] = await Promise.all([
    nullable(data.quote_reference) ? db.collection("quotes").doc(nullable(data.quote_reference)!).get() : null,
    nullable(data.customer_id) ? db.collection("customers").doc(nullable(data.customer_id)!).get() : null,
    nullable(data.transport_order_id) ? db.collection("transport_orders").doc(nullable(data.transport_order_id)!).get() : null,
    nullable(data.tender_id) ? db.collection("transport_tenders").doc(nullable(data.tender_id)!).get() : null,
  ]);
  const q = quote?.exists ? quote.data() as Record<string, unknown> : {};
  const c = customer?.exists ? customer.data() as Record<string, unknown> : {};
  const o = order?.exists ? order.data() as Record<string, unknown> : {};
  const t = tender?.exists ? tender.data() as Record<string, unknown> : {};
  const source: FreightDocumentSource = {
    reference: id,
    branch,
    customer_id: nullable(data.customer_id),
    customer_name: text(c.display_name, text(q.company_name, text(q.contact_name, "Customer"))),
    origin: text(o.origin, text(q.origin, text(data.origin))),
    destination: text(o.destination, text(q.destination, text(data.destination))),
    mode: text(o.mode, text(q.mode, text(data.mode))),
    booking_reference: nullable(data.booking_reference) ?? nullable(t.booking_reference),
    carrier_name: nullable(t.partner_name) ?? nullable(data.carrier),
    transport_order_id: nullable(data.transport_order_id),
    pieces: num(o.pieces),
    weight_kg: num(o.weight_kg),
    volume_cbm: num(o.volume_cbm),
    container_count: num(o.container_count),
    equipment: nullable(o.equipment),
    pickup_date: nullable(o.pickup_date),
    delivery_date: nullable(o.delivery_date),
    cargo_description: text(q.cargo_type, text(o.notes, "General cargo")),
    updated_at: text(data.updated_at),
  };
  return { kind: "ready" as const, source, shipmentRef, shipment, shipmentData: data };
}

function generatedRow(reference: string, doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): GeneratedFreightDocumentRow | null {
  const kind = text(doc.get("generated_document_kind")) as GeneratedFreightDocumentKind;
  if (!generatedFreightDocumentKinds.includes(kind)) return null;
  return {
    document_id: doc.id,
    shipment_reference: reference,
    kind,
    label: generatedFreightDocumentLabels[kind],
    filename: text(doc.get("filename"), "Generated freight document.pdf"),
    document_type: generatedDocumentTypeMap[kind],
    revision: Math.max(1, num(doc.get("generated_revision")) || 1),
    review_status: text(doc.get("review_status"), "received"),
    customer_safe: doc.get("customer_safe") === true,
    sha256: text(doc.get("sha256")),
    generated_at: text(doc.get("generated_at"), text(doc.get("uploaded_at"))),
    generated_by_name: nullable(doc.get("generated_by_name")),
    superseded: text(doc.get("review_status")) === "superseded" || Boolean(doc.get("superseded_by_document_id")),
  };
}

export async function listFreightDocumentWorkspace(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const shipments = await db.collection("shipments").orderBy("updated_at", "desc").limit(1500).get();
  const eligible = shipments.docs.filter((doc) => {
    const status = text(doc.get("status"));
    const branch = branchValue(doc.get("primary_branch")) ?? branchValue(Array.isArray(doc.get("handling_branches")) ? (doc.get("handling_branches") as unknown[])[0] : null);
    return Boolean(branch && staffCanAccessBranch(staff, branch) && status !== "cancelled");
  });
  const quoteIds = eligible.map((doc) => nullable(doc.get("quote_reference"))).filter((v): v is string => Boolean(v));
  const customerIds = eligible.map((doc) => nullable(doc.get("customer_id"))).filter((v): v is string => Boolean(v));
  const orderIds = eligible.map((doc) => nullable(doc.get("transport_order_id"))).filter((v): v is string => Boolean(v));
  const tenderIds = eligible.map((doc) => nullable(doc.get("tender_id"))).filter((v): v is string => Boolean(v));
  const [quotes, customers, orders, tenders, generatedSnapshot] = await Promise.all([
    getAll("quotes", quoteIds), getAll("customers", customerIds), getAll("transport_orders", orderIds), getAll("transport_tenders", tenderIds), db.collectionGroup("documents").where("generated_by_engine", "==", true).limit(5000).get(),
  ]);
  const generated = new Map<string, GeneratedFreightDocumentRow[]>();
  for (const doc of generatedSnapshot.docs) {
    const reference = doc.ref.parent.parent?.id ?? "";
    if (!reference) continue;
    const row = generatedRow(reference, doc);
    if (!row) continue;
    generated.set(reference, [...(generated.get(reference) ?? []), row]);
  }

  const rows: FreightDocumentQueueRow[] = eligible.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const branch = branchValue(data.primary_branch) ?? branchValue(Array.isArray(data.handling_branches) ? data.handling_branches[0] : null);
    if (!branch) return [];
    const quote = quotes.get(text(data.quote_reference)) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) ?? {} : {};
    const order = orders.get(text(data.transport_order_id)) ?? {};
    const tender = tenders.get(text(data.tender_id)) ?? {};
    const source: FreightDocumentSource = {
      reference: doc.id, branch, customer_id: customerId,
      customer_name: text(customer.display_name, text(quote.company_name, text(quote.contact_name, "Customer"))),
      origin: text(order.origin, text(quote.origin, text(data.origin))), destination: text(order.destination, text(quote.destination, text(data.destination))),
      mode: text(order.mode, text(quote.mode, text(data.mode))), booking_reference: nullable(data.booking_reference) ?? nullable(tender.booking_reference),
      carrier_name: nullable(tender.partner_name) ?? nullable(data.carrier), transport_order_id: nullable(data.transport_order_id), pieces: num(order.pieces), weight_kg: num(order.weight_kg), volume_cbm: num(order.volume_cbm), container_count: num(order.container_count), equipment: nullable(order.equipment), pickup_date: nullable(order.pickup_date), delivery_date: nullable(order.delivery_date), cargo_description: text(quote.cargo_type, text(order.notes, "General cargo")), updated_at: text(data.updated_at),
    };
    const docs = (generated.get(doc.id) ?? []).sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    const primary = primaryCarriageDocumentKind(source.mode);
    return [{ ...source, recommended_kinds: recommendedGeneratedDocumentKinds(source.mode), generated_documents: docs, current_generated_count: docs.filter((item) => !item.superseded).length, missing_primary_carriage_document: Boolean(primary && !docs.some((item) => item.kind === primary && !item.superseded)) }];
  });
  const summary = {
    eligible: rows.length,
    missing_primary: rows.filter((row) => row.missing_primary_carriage_document).length,
    generated_current: rows.reduce((sum, row) => sum + row.current_generated_count, 0),
    review_pending: rows.reduce((sum, row) => sum + row.generated_documents.filter((doc) => !doc.superseded && ["received", "under_review"].includes(doc.review_status)).length, 0),
  };
  return { kind: "ready" as const, rows, summary, generated_at: new Date().toISOString() };
}

export async function generateFreightDocument(reference: string, input: FreightDocumentInput, actor: Actor, staff: KcplStaffContext) {
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  if (!firebaseStorageBucketName()) return { kind: "storage_unavailable" as const };
  const scope = await shipmentSource(reference, staff);
  if (scope.kind !== "ready") return scope;
  const issues = validateFreightDocumentInput(input, scope.source);
  if (issues.length) return { kind: "invalid" as const, issues };
  const documentsSnapshot = await scope.shipmentRef.collection("documents").limit(500).get();
  const prior = documentsSnapshot.docs
    .filter((doc) => doc.get("generated_by_engine") === true && text(doc.get("generated_document_kind")) === input.kind && text(doc.get("review_status")) !== "deleted")
    .sort((a, b) => num(b.get("generated_revision")) - num(a.get("generated_revision")) || text(b.get("uploaded_at")).localeCompare(text(a.get("uploaded_at"))));
  const revision = Math.max(0, ...prior.map((doc) => num(doc.get("generated_revision")))) + 1;
  const now = new Date().toISOString();
  const normalizedInput: FreightDocumentInput = {
    ...input,
    houseReference: input.houseReference.trim() || generatedReference(input.kind, scope.source.reference),
    placeOfReceipt: input.placeOfReceipt.trim() || scope.source.origin,
    placeOfDelivery: input.placeOfDelivery.trim() || scope.source.destination,
    cargoDescription: input.cargoDescription.trim() || scope.source.cargo_description,
  };
  const pdf = renderFreightDocumentPdf(scope.source, normalizedInput, now, revision);
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const generation = generationId();
  const filename = `${generatedReference(input.kind, scope.source.reference)}-R${revision}.pdf`;
  const storagePath = `shipments/${scope.source.reference}/generated-documents/${input.kind}/${generation}/${filename}`;
  const file = firebaseAdminBucket().file(storagePath);
  await file.save(pdf, { resumable: false, contentType: "application/pdf", metadata: { cacheControl: "private, max-age=0, no-store", metadata: { shipmentReference: scope.source.reference, generatedDocumentKind: input.kind, revision: String(revision), sha256 } } });

  const documentId = numericId();
  const documentRef = scope.shipmentRef.collection("documents").doc(String(documentId));
  const previousCurrent = prior.find((doc) => text(doc.get("review_status")) !== "superseded") ?? null;
  const documentData = {
    id: documentId, shipment_reference: scope.source.reference, filename, content_type: "application/pdf", size_bytes: pdf.length,
    document_type: generatedDocumentTypeMap[input.kind], storage_path: storagePath, uploaded_at: now, uploaded_by: "KCPL Freight Document Engine", uploaded_by_email: actor.email || null,
    review_status: "received", customer_safe: input.customerSafe, review_note: null, reviewed_at: null, reviewed_by: null, reviewed_by_email: null, verified_at: null, verified_by: null, verified_by_email: null,
    expires_on: null, supersedes_document_id: previousCurrent ? Number(previousCurrent.id) : null, superseded_by_document_id: null, deleted_at: null, deleted_by: null, deleted_by_email: null, sha256,
    generated_by_engine: true, generated_document_kind: input.kind, generated_document_label: generatedFreightDocumentLabels[input.kind], generated_revision: revision, generated_at: now, generated_by_name: actor.name || null, generated_by_email: actor.email || null,
    source_snapshot_at: scope.source.updated_at || now, source_transport_order_id: scope.source.transport_order_id, source_booking_reference: scope.source.booking_reference,
    generated_input: normalizedInput,
    controlled_draft: true,
  };
  try {
    const batch = firebaseAdminDb().batch();
    if (previousCurrent) batch.update(previousCurrent.ref, { review_status: "superseded", superseded_by_document_id: documentId, updated_at: now });
    batch.create(documentRef, documentData);
    batch.update(scope.shipmentRef, { generated_freight_document_count: FieldValue.increment(1), latest_generated_document_at: now, updated_at: now });
    batch.create(scope.shipmentRef.collection("job_activity").doc(), { type: "freight_document_generated", title: `${generatedFreightDocumentLabels[input.kind]} generated`, detail: `${filename} · revision ${revision} · SHA-256 ${sha256.slice(0, 12)}…`, branch: scope.source.branch, actor_name: actor.name, actor_email: actor.email, created_at: now, document_id: documentId, generated_document_kind: input.kind });
    await batch.commit();
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
  return { kind: "created" as const, document: generatedRow(scope.source.reference, await documentRef.get())!, source: scope.source };
}

export async function generatedFreightDocumentDownload(reference: string, documentId: string, staff: KcplStaffContext) {
  const scope = await shipmentSource(reference, staff);
  if (scope.kind !== "ready") return scope;
  const doc = await scope.shipmentRef.collection("documents").doc(documentId.trim()).get();
  if (!doc.exists || doc.get("generated_by_engine") !== true) return { kind: "missing_document" as const };
  const storagePath = nullable(doc.get("storage_path"));
  if (!storagePath || !firebaseStorageBucketName()) return { kind: "storage_unavailable" as const };
  const [url] = await firebaseAdminBucket().file(storagePath).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000 });
  return { kind: "ready" as const, url, filename: text(doc.get("filename"), "KCPL-freight-document.pdf") };
}
