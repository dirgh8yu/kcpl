import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";

type IndexedDoc = { id: string; data: Record<string, unknown> };
type ResultKind = "shipment" | "customer" | "quote";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function limitValue(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.min(40, Math.max(1, Math.trunc(parsed)));
}

function matchesQuery(searchText: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = searchText.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function kindValue(value: string | null): ResultKind | "all" {
  return value === "shipment" || value === "customer" || value === "quote" ? value : "all";
}

async function recent(collection: string, orderField: string, limit: number): Promise<IndexedDoc[]> {
  const snapshot = await firebaseAdminDb().collection(collection).orderBy(orderField, "desc").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
}

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 180);
  const kind = kindValue(url.searchParams.get("kind"));
  const statusFilter = (url.searchParams.get("status") ?? "").trim().toLowerCase().slice(0, 80);
  const limit = limitValue(url.searchParams.get("limit"));

  try {
    const [shipments, quotes, customers] = await Promise.all([
      recent("shipments", "updated_at", 350),
      recent("quotes", "created_at", 300),
      recent("customers", "updated_at", 350),
    ]);

    const quoteMap = new Map(quotes.map((doc) => [doc.id, doc.data]));
    const customerMap = new Map(customers.map((doc) => [doc.id, doc.data]));
    const results: Array<Record<string, unknown> & { kind: ResultKind; searchText: string }> = [];

    if (kind === "all" || kind === "shipment") {
      for (const doc of shipments) {
        const data = doc.data;
        const quoteReference = text(data.quote_reference);
        const customerId = text(data.customer_id);
        const quote = quoteMap.get(quoteReference) ?? {};
        const customer = customerMap.get(customerId) ?? {};
        const status = text(data.status, "booking_confirmed");
        if (statusFilter && status.toLowerCase() !== statusFilter) continue;

        const customerName = text(customer.display_name) || text(quote.company_name) || text(quote.contact_name, "Unlinked customer");
        const origin = text(quote.origin) || text(data.origin, "Origin not recorded");
        const destination = text(quote.destination) || text(data.destination, "Destination not recorded");
        const handlingBranches = stringList(data.handling_branches);
        const searchText = [
          doc.id,
          quoteReference,
          customerId,
          customerName,
          origin,
          destination,
          status,
          text(data.primary_branch),
          ...handlingBranches,
          text(data.current_location),
          text(data.carrier),
          text(data.carrier_reference),
          text(data.internal_job_reference),
          text(data.job_assigned_to_name),
        ].join(" ");
        if (query && !matchesQuery(searchText, query)) continue;

        results.push({
          kind: "shipment",
          id: doc.id,
          reference: doc.id,
          quoteReference: quoteReference || null,
          customerId: customerId || null,
          customerName,
          origin,
          destination,
          status,
          eta: nullable(data.eta),
          currentLocation: nullable(data.current_location),
          carrier: nullable(data.carrier),
          carrierReference: nullable(data.carrier_reference),
          primaryBranch: nullable(data.primary_branch),
          handlingBranches,
          priority: nullable(data.job_priority),
          assignedTo: nullable(data.job_assigned_to_name),
          updatedAt: nullable(data.updated_at),
          searchText,
        });
      }
    }

    if (kind === "all" || kind === "customer") {
      for (const doc of customers) {
        const data = doc.data;
        if (data.archived === true) continue;
        const displayName = text(data.display_name, doc.id);
        const tags = stringList(data.tags);
        const searchText = [
          doc.id,
          displayName,
          text(data.legal_name),
          text(data.trading_name),
          text(data.primary_email),
          text(data.primary_phone),
          text(data.country),
          text(data.primary_branch),
          text(data.account_manager_name),
          text(data.account_status),
          ...tags,
        ].join(" ");
        if (query && !matchesQuery(searchText, query)) continue;

        results.push({
          kind: "customer",
          id: doc.id,
          displayName,
          legalName: nullable(data.legal_name),
          tradingName: nullable(data.trading_name),
          primaryEmail: nullable(data.primary_email),
          primaryPhone: nullable(data.primary_phone),
          country: nullable(data.country),
          primaryBranch: nullable(data.primary_branch),
          accountManager: nullable(data.account_manager_name),
          accountStatus: nullable(data.account_status),
          tags,
          updatedAt: nullable(data.updated_at),
          searchText,
        });
      }
    }

    if (kind === "all" || kind === "quote") {
      for (const doc of quotes) {
        const data = doc.data;
        if (data.migration_hidden === true) continue;
        const status = text(data.status, "new");
        if (statusFilter && status.toLowerCase() !== statusFilter) continue;
        const searchText = [
          doc.id,
          text(data.company_name),
          text(data.contact_name),
          text(data.contact_email),
          text(data.phone),
          text(data.origin),
          text(data.destination),
          text(data.mode),
          text(data.cargo_type),
          status,
          text(data.shipment_reference),
          text(data.customer_id),
        ].join(" ");
        if (query && !matchesQuery(searchText, query)) continue;

        results.push({
          kind: "quote",
          id: doc.id,
          reference: doc.id,
          companyName: nullable(data.company_name),
          contactName: nullable(data.contact_name),
          contactEmail: nullable(data.contact_email),
          phone: nullable(data.phone),
          origin: nullable(data.origin),
          destination: nullable(data.destination),
          mode: nullable(data.mode),
          cargoType: nullable(data.cargo_type),
          status,
          shipmentReference: nullable(data.shipment_reference),
          customerId: nullable(data.customer_id),
          createdAt: nullable(data.created_at),
          searchText,
        });
      }
    }

    const trimmed = results.slice(0, limit).map(({ searchText: _searchText, ...result }) => result);
    return gptActionJson({
      ok: true,
      query: query || null,
      kind,
      status: statusFilter || null,
      count: trimmed.length,
      results: trimmed,
    });
  } catch (error) {
    console.error("KCPL Custom GPT search failed", error);
    return gptActionJson({ ok: false, error: "KCPL operations search is temporarily unavailable." }, 503);
  }
}
