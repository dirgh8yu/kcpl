import { getAdminAccess } from "../../../../admin/admin-auth";
import {
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStages,
  crmRelationshipTypes,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCreateCustomerInput,
  type CrmCurrency,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type CrmRelationshipType,
  type KcplBranch,
} from "../../../../admin/crm/crm-data";
import { createCrmCustomer, findCrmDuplicates, listCrmCustomers } from "../../../../admin/crm/crm-data.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown, maxItems = 30) {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const item of value) {
    const text = clean(item);
    if (text) deduped.add(text.slice(0, 120));
    if (deduped.size >= maxItems) break;
  }
  return [...deduped];
}

function relationshipArray(value: unknown) {
  return cleanStringArray(value, crmRelationshipTypes.length)
    .filter((item): item is CrmRelationshipType => crmRelationshipTypes.includes(item as CrmRelationshipType));
}

function optionalNumberText(value: unknown, label: string, options: { integer?: boolean; max?: number } = {}) {
  const text = clean(value);
  if (!text) return { value: "" };
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: `${label} must be a positive number.` };
  if (options.integer && !Number.isInteger(parsed)) return { error: `${label} must be a whole number.` };
  if (options.max !== undefined && parsed > options.max) return { error: `${label} is above the allowed maximum.` };
  return { value: String(parsed) };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    const customers = await listCrmCustomers();
    if (customers === null) return json({ ok: false, error: "CRM storage is unavailable." }, 503);
    return json({ ok: true, customers });
  } catch (error) {
    console.error("Failed to list KCPL CRM customers", error);
    return json({ ok: false, error: "Customer records could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin customer creation is not accepted." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The customer record could not be read." }, 400);
  }

  const displayName = clean(body.displayName);
  if (displayName.length < 2 || displayName.length > 180) return json({ ok: false, error: "Enter a customer or organisation name between 2 and 180 characters." }, 400);

  const entityKind = clean(body.entityKind);
  if (!crmEntityKinds.includes(entityKind as CrmEntityKind)) return json({ ok: false, error: "Choose a valid customer type." }, 400);

  const relationships = relationshipArray(body.relationshipTypes);
  if (!relationships.length) return json({ ok: false, error: "Choose at least one relationship type." }, 400);

  const accountStatus = clean(body.accountStatus);
  if (!crmAccountStatuses.includes(accountStatus as CrmAccountStatus)) return json({ ok: false, error: "Choose a valid account status." }, 400);

  const leadStage = clean(body.leadStage);
  if (!crmLeadStages.includes(leadStage as CrmLeadStage)) return json({ ok: false, error: "Choose a valid lead stage." }, 400);

  const leadSource = clean(body.leadSource);
  if (leadSource && !crmLeadSources.includes(leadSource as CrmLeadSource)) return json({ ok: false, error: "Choose a valid lead source." }, 400);

  const primaryBranch = clean(body.primaryBranch);
  if (!kcplBranches.includes(primaryBranch as KcplBranch)) return json({ ok: false, error: "Choose a valid KCPL branch." }, 400);

  const preferredCurrency = clean(body.preferredCurrency).toUpperCase();
  if (!crmCurrencies.includes(preferredCurrency as CrmCurrency)) return json({ ok: false, error: "Choose a supported account currency." }, 400);

  const primaryEmail = clean(body.primaryEmail).toLowerCase();
  const accountManagerEmail = clean(body.accountManagerEmail).toLowerCase();
  const billingEmail = clean(body.billingEmail).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const [label, value] of [["Primary email", primaryEmail], ["Account manager email", accountManagerEmail], ["Billing email", billingEmail]] as const) {
    if (value && !emailPattern.test(value)) return json({ ok: false, error: `${label} is not a valid email address.` }, 400);
  }

  const paymentTerms = optionalNumberText(body.paymentTermsDays, "Payment terms", { integer: true, max: 3650 });
  if (paymentTerms.error) return json({ ok: false, error: paymentTerms.error }, 400);
  const creditLimit = optionalNumberText(body.creditLimit, "Credit limit");
  if (creditLimit.error) return json({ ok: false, error: creditLimit.error }, 400);
  const outstandingBalance = optionalNumberText(body.outstandingBalance, "Outstanding balance");
  if (outstandingBalance.error) return json({ ok: false, error: outstandingBalance.error }, 400);
  const markupPercent = optionalNumberText(body.markupPercent, "Markup percentage", { max: 10000 });
  if (markupPercent.error) return json({ ok: false, error: markupPercent.error }, 400);

  const input: CrmCreateCustomerInput = {
    entityKind: entityKind as CrmEntityKind,
    displayName,
    legalName: clean(body.legalName).slice(0, 180),
    tradingName: clean(body.tradingName).slice(0, 180),
    relationshipTypes: relationships,
    accountStatus: accountStatus as CrmAccountStatus,
    leadStage: leadStage as CrmLeadStage,
    leadSource: leadSource as CrmLeadSource | "",
    primaryEmail,
    primaryPhone: clean(body.primaryPhone).slice(0, 60),
    website: clean(body.website).slice(0, 240),
    industry: clean(body.industry).slice(0, 120),
    taxId: clean(body.taxId).slice(0, 100),
    country: clean(body.country).slice(0, 100) || "Nepal",
    primaryBranch: primaryBranch as KcplBranch,
    accountManagerName: clean(body.accountManagerName).slice(0, 120),
    accountManagerEmail,
    billingEmail,
    preferredCurrency: preferredCurrency as CrmCurrency,
    paymentTermsDays: paymentTerms.value ?? "",
    creditLimit: creditLimit.value ?? "",
    outstandingBalance: outstandingBalance.value ?? "",
    pricingNotes: clean(body.pricingNotes).slice(0, 5000),
    markupPercent: markupPercent.value ?? "",
    preferredCarriers: cleanStringArray(body.preferredCarriers),
    transportPreferences: cleanStringArray(body.transportPreferences),
    tags: cleanStringArray(body.tags, 50),
    internalSummary: clean(body.internalSummary).slice(0, 5000),
  };

  try {
    const duplicates = await findCrmDuplicates(input);
    if (duplicates.length && body.allowDuplicate !== true) {
      return json({ ok: false, code: "possible_duplicate", error: "A similar CRM record already exists.", duplicates }, 409);
    }

    const result = await createCrmCustomer(input, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "CRM storage is unavailable." }, 503);
    return json({ ok: true, customer: result.customer }, 201);
  } catch (error) {
    console.error("Failed to create KCPL CRM customer", error);
    return json({ ok: false, error: "The customer record could not be created." }, 500);
  }
}
