import { getAdminAccess } from "../../../admin/admin-auth";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";
import { getStaffContext, staffCanAccessBranch } from "../../../admin/staff-directory.server";
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

function branchValue(value: unknown): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : "Kathmandu";
}

function branchArray(value: unknown, primary: KcplBranch): KcplBranch[] {
  const branches = Array.isArray(value)
    ? value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch))
    : [];
  if (!branches.includes(primary)) branches.unshift(primary);
  return branches;
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
  const quotes = new Map(documents.quotes.map((doc) => [doc.id, doc.data]));
  const customers = new Map(documents.customers.map((doc) => [doc.id, doc.data]));
  const results: SearchResult[] = [];

  for (const doc of documents.shipments) {
    const data = doc.data;
    const primary = branchValue(data.primary_branch);
    const handling = branchArray(data.handling_branches, primary);
    if (!staffCanAccessBranch(staff, primary) && !handling.some((branch) => staffCanAccessBranch(staff, branch))) continue;

    const quoteReference = text(data.quote_reference);
    const quote = quotes.get(quoteReference) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const customerName = customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Unlinked customer"));
    const origin = text(quote.origin, "Origin");
    const destination = text(quote.destination, "Destination");
    const status = statusValue(data.status);
    const carrier = nullable(data.carrier);
    const carrierReference = nullable(data.carrier_reference);
    const currentLocation = nullable(data.current_location);

    results.push({
      kind: "shipment",
      id: doc.id,
      title: `${origin} → ${destination}`,
      subtitle: `${customerName} · ${doc.id}`,
      meta: [shipmentStatusLabels[status], currentLocation || primary, carrierReference].filter(Boolean).join(" · "),
      href: `/admin/jobs/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, shortReference(doc.id), quoteReference, customerName, customerId ?? "", origin, destination, primary, ...handling, carrier ?? "", carrierReference ?? "", currentLocation ?? "", text(data.internal_job_reference)].join(" "),
      currentLocation,
      exception: status === "exception",
    });
  }

  for (const doc of documents.customers) {
    const data = doc.data;
    if (data.archived === true) continue;

    const displayName = text(data.display_name, doc.id);
    const branch = branchValue(data.primary_branch);
    const email = nullable(data.primary_email);
    const phone = nullable(data.primary_phone);
    const country = text(data.country, "Nepal");
    const tags = Array.isArray(data.tags) ? data.tags.filter((item): item is string => typeof item === "string") : [];

    results.push({
      kind: "customer",
      id: doc.id,
      title: displayName,
      subtitle: `${country} · ${branch}${email ? ` · ${email}` : phone ? ` · ${phone}` : ""}`,
      meta: `Customer · ${doc.id}`,
      href: `/admin/crm/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, shortReference(doc.id), displayName, text(data.legal_name), text(data.trading_name), email ?? "", phone ?? "", country, branch, text(data.account_manager_name), ...tags].join(" "),
    });
  }

  for (const doc of documents.quotes) {
    const data = doc.data;
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
