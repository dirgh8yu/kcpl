import { crmCurrencies, type CrmCurrency } from "../../../../../../../admin/crm/crm-data";
import { crmRateModes, crmRateUnits, type CrmRateCardInput, type CrmRateMode, type CrmRateUnit } from "../../../../../../../admin/crm/crm-rate-cards";
import { archiveCrmRateCard, updateCrmRateCard } from "../../../../../../../admin/crm/crm-rate-cards.server";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, requireCrmCapability } from "../../../../crm-api";

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return { value: null as number | null };
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? { value: parsed } : { error: "Rates must be positive numbers." };
}

function parseRateCard(body: Record<string, unknown>) {
  const origin = cleanCrmText(body.origin, 160);
  const destination = cleanCrmText(body.destination, 160);
  const mode = cleanCrmText(body.mode, 30);
  const currency = cleanCrmText(body.currency, 10).toUpperCase();
  const unit = cleanCrmText(body.unit, 30);
  if (!origin || !destination) return { error: "Origin and destination are required." };
  if (!crmRateModes.includes(mode as CrmRateMode)) return { error: "Choose a valid freight mode." };
  if (!crmCurrencies.includes(currency as CrmCurrency)) return { error: "Choose a supported currency." };
  if (!crmRateUnits.includes(unit as CrmRateUnit)) return { error: "Choose a valid rate unit." };

  const sellRate = optionalNumber(body.sellRate);
  const costRate = optionalNumber(body.costRate);
  const minimumCharge = optionalNumber(body.minimumCharge);
  const sellRateValue = sellRate.value;
  if (sellRate.error || sellRateValue === null || sellRateValue === undefined) return { error: sellRate.error || "Sell rate is required." };
  if (costRate.error || minimumCharge.error) return { error: costRate.error || minimumCharge.error };

  const validFrom = cleanCrmText(body.validFrom, 10);
  const validUntil = cleanCrmText(body.validUntil, 10);
  for (const value of [validFrom, validUntil]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Rate validity dates must be valid dates." };
  }
  if (validFrom && validUntil && validUntil < validFrom) return { error: "Valid until cannot be before valid from." };

  const input: CrmRateCardInput = {
    origin,
    destination,
    mode: mode as CrmRateMode,
    carrier: cleanCrmText(body.carrier, 160),
    service: cleanCrmText(body.service, 160),
    currency: currency as CrmCurrency,
    costRate: costRate.value ?? null,
    sellRate: sellRateValue,
    unit: unit as CrmRateUnit,
    minimumCharge: minimumCharge.value ?? null,
    validFrom,
    validUntil,
    notes: cleanCrmText(body.notes, 5000),
    active: body.active !== false,
  };
  return { input };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; rateId: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageRateCards");
  if (capabilityError) return capabilityError;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return crmJson({ ok: false, error: "The rate card could not be read." }, 400); }
  const parsed = parseRateCard(body);
  if (!parsed.input) return crmJson({ ok: false, error: parsed.error }, 400);
  const { id, rateId } = await context.params;
  try {
    const result = await updateCrmRateCard(id, rateId, parsed.input, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    if (result.kind === "missing_rate") return crmJson({ ok: false, error: "Rate card not found." }, 404);
    return crmJson({ ok: true, rateCard: result.rateCard });
  } catch (error) {
    console.error("Failed to update KCPL CRM rate card", rateId, error);
    return crmJson({ ok: false, error: "The rate card could not be updated." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; rateId: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageRateCards");
  if (capabilityError) return capabilityError;
  const { id, rateId } = await context.params;
  try {
    const result = await archiveCrmRateCard(id, rateId, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    if (result.kind === "missing_rate") return crmJson({ ok: false, error: "Rate card not found." }, 404);
    return crmJson({ ok: true, archived: true });
  } catch (error) {
    console.error("Failed to archive KCPL CRM rate card", rateId, error);
    return crmJson({ ok: false, error: "The rate card could not be archived." }, 500);
  }
}
