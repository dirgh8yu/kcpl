import {
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStages,
  crmRelationshipTypes,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCurrency,
  type CrmCustomerDetail,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type CrmRelationshipType,
  type KcplBranch,
} from "../../../../../admin/crm/crm-data";
import type { StaffCapabilities } from "../../../../../admin/staff-permissions";
import { archiveCrmCustomer, updateCrmCustomer } from "../../../../../admin/crm/crm-customer-management.server";
import { getCrmCustomer } from "../../../../../admin/crm/crm-data.server";
import { checkCrmCustomerAccess, staffCanUseCrmBranch } from "../../../../../admin/crm/crm-access.server";
import { crmAccountStatusChangeError, hasCustomerRelationship } from "../../../../../admin/crm/crm-policy";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, requireCrmCapability, validEmail } from "../../crm-api";

function redactCustomer(customer: CrmCustomerDetail, permissions: StaffCapabilities): CrmCustomerDetail {
  return {
    ...customer,
    ...(permissions.canViewCommercial ? {} : { revenue_total: 0, cost_total: 0, profit_total: 0 }),
    commercial: permissions.canViewCommercial
      ? {
          ...customer.commercial,
          ...(permissions.canManageCredit ? {} : {
            payment_terms_days: null,
            credit_limit: null,
            outstanding_balance: null,
          }),
        }
      : {
          preferred_currency: customer.preferred_currency,
          payment_terms_days: null,
          credit_limit: null,
          outstanding_balance: null,
          pricing_notes: null,
          markup_percent: null,
          preferred_carriers: [],
        },
  };
}

function stringArray(value: unknown, max = 50) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanCrmText(item, 120)).filter(Boolean))].slice(0, max);
}

function optionalNumber(value: unknown, options: { integer?: boolean; max?: number } = {}) {
  if (value === null || value === undefined || value === "") return { value: null as number | null };
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: "Enter a valid positive number." };
  if (options.integer && !Number.isInteger(parsed)) return { error: "Enter a whole number." };
  if (options.max !== undefined && parsed > options.max) return { error: "The value is above the allowed maximum." };
  return { value: parsed };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const access = await checkCrmCustomerAccess(id, auth.staff);
  if (access.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
  if (access.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
  if (access.kind === "forbidden") return crmJson({ ok: false, error: "This customer is outside your KCPL branch access." }, 403);
  try {
    const customer = await getCrmCustomer(id);
    if (customer === undefined) return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (!customer || customer.archived) return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, customer: redactCustomer(customer, auth.permissions), permissions: auth.permissions });
  } catch (error) {
    console.error("Failed to load KCPL CRM customer", id, error);
    return crmJson({ ok: false, error: "The customer record could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canEditCustomer");
  if (capabilityError) return capabilityError;
  const { id } = await context.params;
  const access = await checkCrmCustomerAccess(id, auth.staff);
  if (access.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
  if (access.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
  if (access.kind === "forbidden") return crmJson({ ok: false, error: "This customer is outside your KCPL branch access." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The customer update could not be read." }, 400);
  }

  const displayName = cleanCrmText(body.displayName, 180);
  if (displayName.length < 2) return crmJson({ ok: false, error: "Enter a customer or organisation name." }, 400);

  const entityKind = cleanCrmText(body.entityKind, 30);
  const accountStatus = cleanCrmText(body.accountStatus, 30);
  const leadStage = cleanCrmText(body.leadStage, 40);
  const leadSource = cleanCrmText(body.leadSource, 40);
  const primaryBranch = cleanCrmText(body.primaryBranch, 60);
  const preferredCurrency = cleanCrmText(body.preferredCurrency, 10).toUpperCase();
  const relationshipTypes = stringArray(body.relationshipTypes, crmRelationshipTypes.length)
    .filter((item): item is CrmRelationshipType => crmRelationshipTypes.includes(item as CrmRelationshipType));

  if (!crmEntityKinds.includes(entityKind as CrmEntityKind)) return crmJson({ ok: false, error: "Choose a valid record type." }, 400);
  if (!hasCustomerRelationship(relationshipTypes)) return crmJson({ ok: false, error: "Customer records must keep the Customer relationship. Suppliers, carriers, agents and vendors belong in Partners." }, 400);
  if (!crmAccountStatuses.includes(accountStatus as CrmAccountStatus)) return crmJson({ ok: false, error: "Choose a valid account status." }, 400);
  if (!crmLeadStages.includes(leadStage as CrmLeadStage)) return crmJson({ ok: false, error: "Choose a valid lead stage." }, 400);
  if (leadSource && !crmLeadSources.includes(leadSource as CrmLeadSource)) return crmJson({ ok: false, error: "Choose a valid lead source." }, 400);
  if (!kcplBranches.includes(primaryBranch as KcplBranch)) return crmJson({ ok: false, error: "Choose a valid KCPL branch." }, 400);
  if (!staffCanUseCrmBranch(auth.staff, primaryBranch)) return crmJson({ ok: false, error: "You cannot move this customer to a branch outside your KCPL access." }, 403);
  const currentStatus = crmAccountStatuses.includes(access.snapshot.get("account_status") as CrmAccountStatus) ? access.snapshot.get("account_status") as CrmAccountStatus : "prospect";
  const statusError = crmAccountStatusChangeError(currentStatus, accountStatus as CrmAccountStatus, auth.permissions);
  if (statusError) return crmJson({ ok: false, error: statusError }, 403);

  const primaryEmail = cleanCrmText(body.primaryEmail, 254).toLowerCase();
  const billingEmail = cleanCrmText(body.billingEmail, 254).toLowerCase();
  const accountManagerEmail = cleanCrmText(body.accountManagerEmail, 254).toLowerCase();
  if (![primaryEmail, billingEmail, accountManagerEmail].every(validEmail)) {
    return crmJson({ ok: false, error: "Check the email addresses and try again." }, 400);
  }

  const includesCommercial = ["preferredCurrency", "pricingNotes", "markupPercent", "preferredCarriers"].some((key) => key in body);
  if (cleanCrmText(body.outstandingBalance)) return crmJson({ ok: false, error: "Outstanding balance is calculated from Receivables and cannot be edited in CRM." }, 400);
  const includesCredit = ["paymentTermsDays", "creditLimit"].some((key) => key in body);
  if (includesCommercial && !auth.permissions.canEditCommercial) return crmJson({ ok: false, error: "Your KCPL role cannot edit commercial pricing." }, 403);
  if (includesCredit && !auth.permissions.canManageCredit) return crmJson({ ok: false, error: "Your KCPL role cannot edit customer credit controls." }, 403);

  let paymentTermsDays: number | null | undefined;
  let creditLimit: number | null | undefined;
  let markupPercent: number | null | undefined;

  if (includesCredit) {
    const paymentTerms = optionalNumber(body.paymentTermsDays, { integer: true, max: 3650 });
    const credit = optionalNumber(body.creditLimit);
    if (paymentTerms.error || credit.error) return crmJson({ ok: false, error: paymentTerms.error || credit.error }, 400);
    paymentTermsDays = paymentTerms.value;
    creditLimit = credit.value;
  }

  if (includesCommercial) {
    if (!crmCurrencies.includes(preferredCurrency as CrmCurrency)) return crmJson({ ok: false, error: "Choose a supported account currency." }, 400);
    const markup = optionalNumber(body.markupPercent, { max: 10000 });
    if (markup.error) return crmJson({ ok: false, error: markup.error }, 400);
    markupPercent = markup.value;
  }

  try {
    const result = await updateCrmCustomer(id, {
      entityKind: entityKind as CrmEntityKind,
      displayName,
      legalName: cleanCrmText(body.legalName, 180),
      tradingName: cleanCrmText(body.tradingName, 180),
      relationshipTypes,
      accountStatus: accountStatus as CrmAccountStatus,
      leadStage: leadStage as CrmLeadStage,
      leadSource: leadSource as CrmLeadSource | "",
      primaryEmail,
      primaryPhone: cleanCrmText(body.primaryPhone, 60),
      website: cleanCrmText(body.website, 240),
      industry: cleanCrmText(body.industry, 120),
      taxId: cleanCrmText(body.taxId, 100),
      country: cleanCrmText(body.country, 100) || "Nepal",
      primaryBranch: primaryBranch as KcplBranch,
      accountManagerName: cleanCrmText(body.accountManagerName, 120),
      accountManagerEmail,
      accountManagerPhone: cleanCrmText(body.accountManagerPhone, 80),
      billingEmail,
      tags: stringArray(body.tags),
      transportPreferences: stringArray(body.transportPreferences),
      internalSummary: cleanCrmText(body.internalSummary, 5000),
      ...(includesCommercial ? {
        preferredCurrency: preferredCurrency as CrmCurrency,
        pricingNotes: cleanCrmText(body.pricingNotes, 5000),
        markupPercent,
        preferredCarriers: stringArray(body.preferredCarriers),
      } : {}),
      ...(includesCredit ? { paymentTermsDays, creditLimit } : {}),
    }, { name: auth.user.displayName, email: auth.user.email }, {
      allowCommercial: auth.permissions.canEditCommercial,
      allowCredit: auth.permissions.canManageCredit,
    });

    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    const customer = await getCrmCustomer(id);
    return crmJson({ ok: true, customer: customer ? redactCustomer(customer, auth.permissions) : null });
  } catch (error) {
    console.error("Failed to update KCPL CRM customer", id, error);
    return crmJson({ ok: false, error: "The customer record could not be updated." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canArchiveCustomer");
  if (capabilityError) return capabilityError;

  const { id } = await context.params;
  const access = await checkCrmCustomerAccess(id, auth.staff);
  if (access.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
  if (access.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
  if (access.kind === "forbidden") return crmJson({ ok: false, error: "This customer is outside your KCPL branch access." }, 403);
  try {
    const result = await archiveCrmCustomer(id, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, archived: true });
  } catch (error) {
    console.error("Failed to archive KCPL CRM customer", id, error);
    return crmJson({ ok: false, error: "The customer record could not be archived." }, 500);
  }
}