import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { canAccessBranchSet, canAccessBranchValue, canAccessQuoteLinkedRecords } from "../../../admin/branch-access-policy";
import { getAdminAccess } from "../../../admin/admin-auth";
import { canAccessPartnerOwner } from "../../../admin/partners/partner-policy";
import { getStaffContext, staffCanAccessBranch } from "../../../admin/staff-directory.server";

type IndexedDoc = { id: string; data: Record<string, unknown> };
type SearchResult = {
  kind: "shipment" | "customer" | "quote" | "order" | "tender" | "partner" | "payable";
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  href: string;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function matches(searchText: string, query: string) { const terms = query.toLowerCase().split(/\s+/).filter(Boolean); const haystack = searchText.toLowerCase(); return terms.every((term) => haystack.includes(term)); }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }

async function recent(collection: string, orderField: string, limit: number): Promise<IndexedDoc[]> {
  const snapshot = await firebaseAdminDb().collection(collection).orderBy(orderField, "desc").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Firebase search is unavailable." }, 503);

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 180);
  if (!query) return json({ ok: true, query: null, results: [] });

  try {
    const staff = await getStaffContext(access.user);
    const [shipments, customers, quotes, partners, orders, tenders, payables] = await Promise.all([
      staff.permissions.canManageJobFile ? recent("shipments", "updated_at", 450) : Promise.resolve([]),
      recent("customers", "updated_at", 400),
      staff.permissions.canViewCommercial ? recent("quotes", "created_at", 350) : Promise.resolve([]),
      recent("partners", "updated_at", 350),
      staff.permissions.canViewCommercial ? recent("transport_orders", "updated_at", 400) : Promise.resolve([]),
      staff.permissions.canViewCommercial ? recent("transport_tenders", "updated_at", 350) : Promise.resolve([]),
      staff.permissions.canManageFinance ? recent("payables", "updated_at", 350) : Promise.resolve([]),
    ]);

    const shipmentMap = new Map(shipments.map((doc) => [doc.id, doc.data]));
    const customerMap = new Map(customers.map((doc) => [doc.id, doc.data]));
    const results: SearchResult[] = [];

    for (const doc of shipments) {
      const data = doc.data;
      if (!canAccessBranchSet(staff, data.primary_branch, data.handling_branches)) continue;
      const customer = customerMap.get(text(data.customer_id)) ?? {};
      const customerName = text(customer.display_name, "Customer");
      const searchText = [doc.id, customerName, text(data.origin), text(data.destination), text(data.status), text(data.current_location), text(data.carrier), text(data.carrier_reference), text(data.internal_job_reference), text(data.job_assigned_to_name), text(data.primary_branch), ...stringList(data.handling_branches)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "shipment", id: doc.id, title: doc.id, subtitle: `${customerName} · ${text(data.origin, "Origin")} → ${text(data.destination, "Destination")}`, meta: text(data.status) || null, href: `/admin/jobs/${encodeURIComponent(doc.id)}` });
    }

    for (const doc of customers) {
      const data = doc.data;
      if (data.archived === true || !canAccessBranchValue(staff, data.primary_branch)) continue;
      const displayName = text(data.display_name, doc.id);
      const searchText = [doc.id, displayName, text(data.legal_name), text(data.trading_name), text(data.primary_email), text(data.primary_phone), text(data.country), text(data.primary_branch), text(data.account_manager_name), text(data.account_status), ...stringList(data.tags)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "customer", id: doc.id, title: displayName, subtitle: `${doc.id}${text(data.country) ? ` · ${text(data.country)}` : ""}`, meta: text(data.account_status) || null, href: `/admin/crm/${encodeURIComponent(doc.id)}` });
    }

    for (const doc of quotes) {
      const data = doc.data;
      if (data.migration_hidden === true) continue;
      const shipmentReference = nullable(data.shipment_reference);
      const customerId = nullable(data.customer_id);
      const shipment = shipmentReference ? shipmentMap.get(shipmentReference) : undefined;
      const customer = customerId ? customerMap.get(customerId) : undefined;
      if (!canAccessQuoteLinkedRecords(staff, {
        shipment_reference: shipmentReference,
        customer_id: customerId,
        shipment_exists: Boolean(shipment),
        shipment_primary_branch: shipment?.primary_branch,
        shipment_handling_branches: shipment?.handling_branches,
        customer_exists: Boolean(customer),
        customer_branch: customer?.primary_branch,
      })) continue;
      const company = text(data.company_name) || text(data.contact_name, "Enquiry");
      const searchText = [doc.id, company, text(data.contact_name), text(data.contact_email), text(data.phone), text(data.origin), text(data.destination), text(data.mode), text(data.cargo_type), text(data.status), shipmentReference, customerId].filter(Boolean).join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "quote", id: doc.id, title: doc.id, subtitle: `${company} · ${text(data.origin, "Origin")} → ${text(data.destination, "Destination")}`, meta: text(data.status) || null, href: `/admin?enquiry=${encodeURIComponent(doc.id)}` });
    }

    for (const doc of orders) {
      const data = doc.data;
      if (!staffCanAccessBranch(staff, data.branch)) continue;
      const searchText = [doc.id, text(data.customer_name), text(data.customer_id), text(data.origin), text(data.destination), text(data.mode), text(data.status), text(data.booking_reference), text(data.shipment_reference), text(data.consolidation_reference)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "order", id: doc.id, title: doc.id, subtitle: `${text(data.customer_name, "Transport order")} · ${text(data.origin, "Origin")} → ${text(data.destination, "Destination")}`, meta: text(data.status) || null, href: `/admin/rating?order=${encodeURIComponent(doc.id)}` });
    }

    for (const doc of tenders) {
      const data = doc.data;
      if (!staffCanAccessBranch(staff, data.branch)) continue;
      const searchText = [doc.id, text(data.tender_reference), text(data.order_id), text(data.partner_name), text(data.partner_id), text(data.origin), text(data.destination), text(data.status), text(data.booking_reference), text(data.shipment_reference)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "tender", id: doc.id, title: text(data.tender_reference, doc.id), subtitle: `${text(data.partner_name, "Partner")} · ${text(data.origin, "Origin")} → ${text(data.destination, "Destination")}`, meta: text(data.status) || null, href: `/admin/tenders?tender=${encodeURIComponent(doc.id)}` });
    }

    for (const doc of partners) {
      const data = doc.data;
      if (!canAccessPartnerOwner(staff, data.owner_branch)) continue;
      const displayName = text(data.display_name, doc.id);
      const searchText = [doc.id, displayName, text(data.legal_name), text(data.partner_type), text(data.country), text(data.city), text(data.primary_email), text(data.primary_phone), text(data.owner_branch), text(data.status), ...stringList(data.modes), ...stringList(data.tags)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "partner", id: doc.id, title: displayName, subtitle: `${doc.id}${text(data.country) ? ` · ${text(data.country)}` : ""}`, meta: text(data.status) || null, href: `/admin/partners/${encodeURIComponent(doc.id)}` });
    }

    for (const doc of payables) {
      const data = doc.data;
      if (!canAccessBranchValue(staff, data.branch) || text(data.status) === "void") continue;
      const searchText = [doc.id, text(data.supplier_name), text(data.supplier_bill_reference), text(data.shipment_reference), text(data.customer_name), text(data.branch), text(data.status), text(data.description)].join(" ");
      if (!matches(searchText, query)) continue;
      results.push({ kind: "payable", id: doc.id, title: doc.id, subtitle: `${text(data.supplier_name, "Supplier")} · ${text(data.supplier_bill_reference, "No invoice reference")}`, meta: text(data.status) || null, href: `/admin/payables/bills/${encodeURIComponent(doc.id)}` });
    }

    const rank: Record<SearchResult["kind"], number> = { shipment: 0, order: 1, tender: 2, customer: 3, quote: 4, partner: 5, payable: 6 };
    results.sort((a, b) => rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title));
    return json({ ok: true, query, results: results.slice(0, 40) });
  } catch (error) {
    console.error("KCPL operations search failed", error);
    return json({ ok: false, error: "KCPL operations search is temporarily unavailable." }, 503);
  }
}
