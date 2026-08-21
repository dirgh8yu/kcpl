import { getAdminAccess } from "../../../admin/admin-auth";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { canAccessBranchSet, canAccessBranchValue, canAccessQuoteLinkedRecords, strictBranchArray, strictBranchValue } from "../../../admin/branch-access-policy";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../../shipment-types";

type SearchResult = {
  kind: "shipment" | "customer" | "enquiry";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  searchText: string;
  currentLocation?: string | null;
  exception?: boolean;
};

type IndexedDoc = { id: string; data: Record<string, unknown> };
type SearchDocuments = {
  expiresAt: number;
  shipments: IndexedDoc[];
  quotes: IndexedDoc[];
  customers: IndexedDoc[];
};

let cachedDocuments: SearchDocuments | null = null;
let pendingDocuments: Promise<SearchDocuments> | null = null;
const indexTtlMs = 20_000;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function shortReference(value: string) {
  const parts = value.split("-");
  return parts.length > 2 ? parts.slice(-1)[0] : value;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

async function loadSearchDocuments() {
  const now = Date.now();
  if (cachedDocuments && cachedDocuments.expiresAt > now) return cachedDocuments;
  if (pendingDocuments) return pendingDocuments;

  pendingDocuments = (async () => {
    const db = firebaseAdminDb();
    const [shipmentsSnapshot, quotesSnapshot, customersSnapshot] = await Promise.all([
      db.collection("shipments").orderBy("updated_at", "desc").limit(350).get(),
      db.collection("quotes").orderBy("created_at", "desc").limit(300).get(),
      db.collection("customers").orderBy("updated_at", "desc").limit(350).get(),
    ]);
    const next: SearchDocuments = {
      expiresAt: Date.now() + indexTtlMs,
      shipments: shipmentsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> })),
      quotes: quotesSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> })),
      customers: customersSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> })),
    };
    cachedDocuments = next;
    return next;
  })().finally(() => {
    pendingDocuments = null;
  });

  return pendingDocuments;
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Firebase search is unavailable." }, 503);

  const staff = await getStaffContext(access.user);
  const documents = await loadSearchDocuments();
  const shipments = new Map(documents.shipments.map((doc) => [doc.id, doc.data]));
  const quotes = new Map(documents.quotes.map((doc) => [doc.id, doc.data]));
  const customers = new Map(documents.customers.map((doc) => [doc.id, doc.data]));
  const results: SearchResult[] = [];

  for (const doc of documents.shipments) {
    const data = doc.data;
    const quoteReference = text(data.quote_reference);
    const quote = quotes.get(quoteReference) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const primary = strictBranchValue(data.primary_branch) ?? strictBranchValue(customer?.primary_branch);
    const handling = strictBranchArray(data.handling_branches);
    if (!canAccessBranchSet(staff, primary, handling)) continue;

    const customerName = customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Unlinked customer"));
    const origin = text(quote.origin, "Origin");
    const destination = text(quote.destination, "Destination");
    const status = statusValue(data.status);
    const carrier = nullable(data.carrier);
    const carrierReference = nullable(data.carrier_reference);
    const currentLocation = nullable(data.current_location);
    const branchLabel = primary ?? handling[0] ?? "Branch data incomplete";

    results.push({
      kind: "shipment",
      id: doc.id,
      title: `${origin} → ${destination}`,
      subtitle: `${customerName} · ${doc.id}`,
      meta: [shipmentStatusLabels[status], currentLocation || branchLabel, carrierReference].filter(Boolean).join(" · "),
      href: `/admin/jobs/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, shortReference(doc.id), quoteReference, customerName, customerId ?? "", origin, destination, branchLabel, ...handling, carrier ?? "", carrierReference ?? "", currentLocation ?? "", text(data.internal_job_reference)].join(" "),
      currentLocation,
      exception: status === "exception",
    });
  }

  for (const doc of documents.customers) {
    const data = doc.data;
    if (data.archived === true) continue;
    if (!canAccessBranchValue(staff, data.primary_branch)) continue;

    const displayName = text(data.display_name, doc.id);
    const branch = strictBranchValue(data.primary_branch);
    const branchLabel = branch ?? "Branch data incomplete";
    const email = nullable(data.primary_email);
    const phone = nullable(data.primary_phone);
    const country = text(data.country, "Nepal");
    const tags = Array.isArray(data.tags) ? data.tags.filter((item): item is string => typeof item === "string") : [];

    results.push({
      kind: "customer",
      id: doc.id,
      title: displayName,
      subtitle: `${country} · ${branchLabel}${email ? ` · ${email}` : phone ? ` · ${phone}` : ""}`,
      meta: `Customer · ${doc.id}`,
      href: `/admin/crm/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, shortReference(doc.id), displayName, text(data.legal_name), text(data.trading_name), email ?? "", phone ?? "", country, branchLabel, text(data.account_manager_name), ...tags].join(" "),
    });
  }

  for (const doc of documents.quotes) {
    const data = doc.data;
    const shipmentReference = nullable(data.shipment_reference);
    const shipment = shipmentReference ? shipments.get(shipmentReference) : undefined;
    const quoteCustomerId = nullable(data.customer_id);
    const effectiveCustomerId = shipment ? nullable(shipment.customer_id) ?? quoteCustomerId : quoteCustomerId;
    const customer = effectiveCustomerId ? customers.get(effectiveCustomerId) : undefined;
    const visible = canAccessQuoteLinkedRecords(staff, {
      shipment_reference: shipmentReference,
      customer_id: quoteCustomerId,
      shipment_exists: Boolean(shipment),
      shipment_primary_branch: strictBranchValue(shipment?.primary_branch) ?? customer?.primary_branch,
      shipment_handling_branches: shipment?.handling_branches,
      customer_exists: Boolean(customer),
      customer_branch: customer?.primary_branch,
    });
    if (!visible) continue;

    const company = nullable(data.company_name);
    const contact = text(data.contact_name, "Customer");
    const origin = text(data.origin, "Origin");
    const destination = text(data.destination, "Destination");
    const mode = text(data.mode);
    const cargo = nullable(data.cargo_type);
    const status = text(data.status, "new");

    results.push({
      kind: "enquiry",
      id: doc.id,
      title: `${origin} → ${destination}`,
      subtitle: `${company || contact}${mode ? ` · ${mode.replaceAll("_", " ")}` : ""}${cargo ? ` · ${cargo}` : ""}`,
      meta: `Enquiry · ${status.replaceAll("_", " ")} · ${doc.id}`,
      href: `/admin?enquiry=${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, shortReference(doc.id), company ?? "", contact, text(data.contact_email), text(data.phone), origin, destination, mode, cargo ?? "", status].join(" "),
    });
  }

  return json({
    ok: true,
    permissions: {
      canManageFinance: staff.permissions.canManageFinance,
      canManageStaff: staff.permissions.canManageStaff,
      isManagement: staff.permissions.role === "management",
    },
    results,
  });
}
