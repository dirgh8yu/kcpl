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

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Firebase search is unavailable." }, 503);

  const staff = await getStaffContext(access.user);
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, quotesSnapshot, customersSnapshot] = await Promise.all([
    db.collection("shipments").orderBy("updated_at", "desc").limit(350).get(),
    db.collection("quotes").orderBy("created_at", "desc").limit(300).get(),
    db.collection("customers").orderBy("updated_at", "desc").limit(350).get(),
  ]);

  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const results: SearchResult[] = [];

  for (const doc of shipmentsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
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
    const currentLocation = nullable(data.current_location);

    results.push({
      kind: "shipment",
      id: doc.id,
      title: doc.id,
      subtitle: `${customerName} · ${origin} → ${destination}`,
      meta: `${shipmentStatusLabels[status]} · ${currentLocation || primary}`,
      href: `/admin/jobs/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, quoteReference, customerName, origin, destination, primary, ...handling, carrier ?? "", currentLocation ?? ""].join(" "),
      currentLocation,
      exception: status === "exception",
    });
  }

  for (const doc of customersSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
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
      subtitle: email || phone || `${country} · ${branch}`,
      meta: `Customer · ${branch}`,
      href: `/admin/crm/${encodeURIComponent(doc.id)}`,
      searchText: [doc.id, displayName, text(data.legal_name), email ?? "", phone ?? "", country, branch, text(data.account_manager_name), ...tags].join(" "),
    });
  }

  for (const doc of quotesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const company = nullable(data.company_name);
    const contact = text(data.contact_name, "Customer");
    const origin = text(data.origin, "Origin");
    const destination = text(data.destination, "Destination");
    const status = text(data.status, "new");

    results.push({
      kind: "enquiry",
      id: doc.id,
      title: doc.id,
      subtitle: `${company || contact} · ${origin} → ${destination}`,
      meta: `Enquiry · ${status.replaceAll("_", " ")}`,
      href: "/admin",
      searchText: [doc.id, company ?? "", contact, text(data.contact_email), origin, destination, text(data.mode), status].join(" "),
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
