import { getAdminAccess } from "../../../admin/admin-auth";
import { crmCurrencies, kcplBranches, type CrmCurrency } from "../../../admin/crm/crm-data";
import {
  partnerModes,
  partnerStatuses,
  partnerTypes,
  type PartnerInput,
  type PartnerMode,
  type PartnerOwnerBranch,
  type PartnerStatus,
  type PartnerType,
} from "../../../admin/partners/partners-data";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function authorizePartnerRequest(edit = false) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "KCPL admin access is not configured." }, 503) };
  const staff = await getStaffContext(access.user);
  if (edit && staff.permissions.role === "operations") return { response: json({ ok: false, error: "Your KCPL role has read-only partner network access." }, 403) };
  return { user: access.user, staff };
}

export function rejectCrossOrigin(request: Request) {
  return isTrustedSameOriginRequest(request) ? null : json({ ok: false, error: "Cross-origin partner changes are not accepted." }, 403);
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function array(value: unknown, maxItems = 100, maxLength = 160) {
  if (!Array.isArray(value)) return [];
  const result = new Set<string>();
  for (const item of value) {
    const cleaned = clean(item, maxLength);
    if (cleaned) result.add(cleaned);
    if (result.size >= maxItems) break;
  }
  return [...result];
}

function typedArray<T extends string>(value: unknown, allowed: readonly T[]) {
  return array(value, allowed.length).filter((item): item is T => allowed.includes(item as T));
}

function url(value: unknown, label: string) {
  const output = clean(value, 500);
  if (!output) return { value: "" };
  try {
    const parsed = new URL(output);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: `${label} must use http or https.` };
    return { value: output };
  } catch {
    return { error: `${label} is not a valid URL.` };
  }
}

export function parsePartnerInput(body: Record<string, unknown>): { input?: PartnerInput; error?: string } {
  const displayName = clean(body.displayName, 180);
  if (displayName.length < 2) return { error: "Enter a partner or vendor name." };

  const types = typedArray<PartnerType>(body.types, partnerTypes);
  if (!types.length) return { error: "Choose at least one partner relationship type." };
  const modes = typedArray<PartnerMode>(body.modes, partnerModes);

  const status = clean(body.status, 30);
  if (!partnerStatuses.includes(status as PartnerStatus)) return { error: "Choose a valid partner status." };

  const ownerBranch = clean(body.ownerBranch, 50);
  if (ownerBranch !== "Global" && !kcplBranches.includes(ownerBranch as (typeof kcplBranches)[number])) return { error: "Choose a valid KCPL owner branch." };

  const preferredCurrency = clean(body.preferredCurrency, 10).toUpperCase();
  if (!crmCurrencies.includes(preferredCurrency as CrmCurrency)) return { error: "Choose a supported partner currency." };

  const primaryEmail = clean(body.primaryEmail, 200).toLowerCase();
  if (primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) return { error: "Enter a valid partner email address." };

  const paymentTermsDays = Number(body.paymentTermsDays ?? 0);
  if (!Number.isFinite(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 3650 || !Number.isInteger(paymentTermsDays)) return { error: "Payment terms must be a whole number between 0 and 3650 days." };

  const rawRating = body.serviceRating;
  const serviceRating = rawRating === null || rawRating === undefined || rawRating === "" ? null : Number(rawRating);
  if (serviceRating !== null && (!Number.isFinite(serviceRating) || serviceRating < 1 || serviceRating > 5)) return { error: "Service rating must be between 1 and 5." };

  const contractExpiryDate = clean(body.contractExpiryDate, 10);
  if (contractExpiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(contractExpiryDate)) return { error: "Contract expiry date is invalid." };

  const website = url(body.website, "Website");
  if (website.error) return { error: website.error };
  const documentUrl = url(body.documentUrl, "Document URL");
  if (documentUrl.error) return { error: documentUrl.error };

  return {
    input: {
      displayName,
      legalName: clean(body.legalName, 180),
      types,
      modes,
      status: status as PartnerStatus,
      preferred: body.preferred === true,
      country: clean(body.country, 120) || "Nepal",
      ownerBranch: ownerBranch as PartnerOwnerBranch,
      citiesServed: array(body.citiesServed),
      countriesServed: array(body.countriesServed),
      portsServed: array(body.portsServed),
      primaryContactName: clean(body.primaryContactName, 160),
      primaryEmail,
      primaryPhone: clean(body.primaryPhone, 80),
      whatsapp: clean(body.whatsapp, 80),
      website: website.value ?? "",
      preferredCurrency: preferredCurrency as CrmCurrency,
      paymentTermsDays,
      serviceRating,
      registrationNumber: clean(body.registrationNumber, 120),
      taxId: clean(body.taxId, 120),
      contractReference: clean(body.contractReference, 180),
      contractExpiryDate,
      documentUrl: documentUrl.value ?? "",
      commercialTerms: clean(body.commercialTerms, 8000),
      internalNotes: clean(body.internalNotes, 8000),
      tags: array(body.tags, 50, 100),
    },
  };
}
