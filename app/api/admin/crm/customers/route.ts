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
  type CrmCustomerSummary,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type CrmRelationshipType,
  type KcplBranch,
} from "../../../../admin/crm/crm-data";
import { staffCanUseCrmBranch } from "../../../../admin/crm/crm-access.server";
import { createCrmCustomer, findCrmDuplicates, listCrmCustomers } from "../../../../admin/crm/crm-data.server";
import { hasCustomerRelationship } from "../../../../admin/crm/crm-policy";
import { authorizeCrm, crmJson, protectCrmWrite, requireCrmCapability } from "../crm-api";

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
  if (!Number.isFinite(parsed) || parsed < 0) return { error: `${label} must be zero or greater.` };
  if (options.integer && !Number.isInteger(parsed)) return { error: `${label} must be a whole number.` };
  if (options.max !== undefined && parsed > options.max) return { error: `${label} is above the allowed maximum.` };
  return { value: String(parsed) };
}

function redactSummary(customer: CrmCustomerSummary, canViewCommercial: boolean): CrmCustomerSummary {
  return canViewCommercial ? customer : { ...customer, revenue_total: 0, cost_total: 0, profit_total: 0 };
}

export async function GET() {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  try {
    const customers = await listCrmCustomers(auth.staff);
    if (customers === null) return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    return crmJson({ ok: true, customers: customers.map((customer) => redactSummary(customer, auth.permissions.canViewCommercial)) });
  } catch (error) {
    console.error("Failed to list KCPL CRM customers", error);
    return crmJson({ ok: false, error: "Customer records could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canEditCustomer");
  if (capabilityError) return capabilityError;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The customer record could not be read." }, 400);
  }

  const displayName = clean(body.displayName);
  if (displayName.length < 2 || displayName.length > 180) return crmJson({ ok: false, error: "Enter a customer or organisation name between 2 and 180 characters." }, 400);

  const entityKind = clean(body.entityKind);
  if (!crmEntityKinds.includes(entityKind as CrmEntityKind)) return crmJson({ ok: false, error: "Choose a valid customer type." }, 400);

  const relationships = relationshipArray(body.relationshipTypes);
  if (!hasCustomerRelationship(relationships)) return crmJson({ ok: false, error: "Customer records must keep the Customer relationship. Suppliers, carriers, agents and vendors belong in Partners." }, 400);

  const accountStatus = clean(body.accountStatus);
  if (!crmAccountStatuses.includes(accountStatus as CrmAccountStatus)) return crmJson({ ok: false, error: "Choose a valid account status." }, 400);
  if (accountStatus === "blacklisted" && auth.permissions.role !== "management") return crmJson({ ok: false, error: "Only KCPL Management can create a blacklisted customer." }, 403);
  if (accountStatus === "on_hold" && !auth.permissions.canManageCredit) return crmJson({ ok: false, error: "Accounts or Management approval is required to create a customer on credit hold." }, 403);

  const leadStage = clean(body.leadStage);
  if (!crmLeadStages.includes(leadStage as CrmLeadStage)) return crmJson({ ok: false, error: "Choose a valid lead stage." }, 400);

  const leadSource = clean(body.leadSource);
  if (leadSource && !crmLeadSources.includes(leadSource as CrmLeadSource)) return crmJson({ ok: false, error: "Choose a valid lead source." }, 400);

  const primaryBranch = clean(body.primaryBranch);
  if (!kcplBranches.includes(primaryBranch as KcplBranch)) return crmJson({ ok: false, error: "Choose a valid KCPL branch." }, 400);
  if (!staffCanUseCrmBranch(auth.staff, primaryBranch)) return crmJson({ ok: false, error: "You cannot create a customer in a branch outside your KCPL access." }, 403);

  const primaryEmail = clean(body.primaryEmail).toLowerCase();
  const accountManagerEmail = clean(body.accountManagerEmail).toLowerCase();
  const billingEmail = clean(body.billingEmail).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const [label, value] of [["Primary email", primaryEmail], ["Account manager email", accountManagerEmail], ["Billing email", billingEmail]] as const) {
    if (value && !emailPattern.test(value)) return crmJson({ ok: false, error: `${label} is not a valid email address.` }, 400);
  }

  if (clean(body.outstandingBalance)) return crmJson({ ok: false, error: "Outstanding balance is calculated from Receivables and cannot be entered manually." }, 400);

  const preferredCurrencyInput = clean(body.preferredCurrency).toUpperCase() || "NPR";
  if (auth.permissions.canEditCommercial && !crmCurrencies.includes(preferredCurrencyInput as CrmCurrency)) return crmJson({ ok: false, error: "Choose a supported account currency." }, 400);
  const paymentTerms = auth.permissions.canManageCredit ? optionalNumberText(body.paymentTermsDays, "Payment terms", { integer: true, max: 3650 }) : { value: "" };
  if ("error" in paymentTerms && paymentTerms.error) return crmJson({ ok: false, error: paymentTerms.error }, 400);
  const creditLimit = auth.permissions.canManageCredit ? optionalNumberText(body.creditLimit, "Credit limit") : { value: "" };
  if ("error" in creditLimit && creditLimit.error) return crmJson({ ok: false, error: creditLimit.error }, 400);
  const markupPercent = auth.permissions.canEditCommercial ? optionalNumberText(body.markupPercent, "Markup percentage", { max: 10000 }) : { value: "" };
  if ("error" in markupPercent && markupPercent.error) return crmJson({ ok: false, error: markupPercent.error }, 400);

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
    accountManagerPhone: clean(body.accountManagerPhone).slice(0, 80),
    billingEmail,
    preferredCurrency: (auth.permissions.canEditCommercial ? preferredCurrencyInput : "NPR") as CrmCurrency,
    paymentTermsDays: paymentTerms.value ?? "",
    creditLimit: creditLimit.value ?? "",
    outstandingBalance: "",
    pricingNotes: auth.permissions.canEditCommercial ? clean(body.pricingNotes).slice(0, 5000) : "",
    markupPercent: markupPercent.value ?? "",
    preferredCarriers: auth.permissions.canEditCommercial ? cleanStringArray(body.preferredCarriers) : [],
    transportPreferences: cleanStringArray(body.transportPreferences),
    tags: cleanStringArray(body.tags, 50),
    internalSummary: clean(body.internalSummary).slice(0, 5000),
  };

  try {
    const duplicates = await findCrmDuplicates(input);
    if (duplicates.length && body.allowDuplicate !== true) {
      return crmJson({ ok: false, code: "possible_duplicate", error: "A similar CRM record already exists.", duplicates }, 409);
    }

    const result = await createCrmCustomer(input, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    return crmJson({ ok: true, customer: redactSummary(result.customer, auth.permissions.canViewCommercial) }, 201);
  } catch (error) {
    console.error("Failed to create KCPL CRM customer", error);
    return crmJson({ ok: false, error: "The customer record could not be created." }, 500);
  }
}
