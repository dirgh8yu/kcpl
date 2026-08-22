import type { CrmCurrency } from "../crm/crm-data";

export const consolidationAllocationStatuses = ["pending_approval", "ready", "booked", "stale"] as const;
export type ConsolidationAllocationStatus = (typeof consolidationAllocationStatuses)[number];

export type ConsolidationAllocationMemberInput = {
  order_id: string;
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
};

export type ConsolidationAllocation = {
  order_id: string;
  amount: number;
  basis_value: number;
};

export type ConsolidationAllocationResult =
  | {
      ok: true;
      basis: "weight_kg" | "volume_cbm" | "pieces" | "equal";
      basis_total: number;
      currency: CrmCurrency;
      currency_decimals: number;
      total: number;
      allocations: ConsolidationAllocation[];
      rounding_strategy: "largest_remainder_then_order_id_desc";
      residual_units: number;
      residual_recipients: string[];
    }
  | { ok: false; reason: "invalid_total" | "invalid_members" | "duplicate_house" | "too_many_houses" };

export type ConsolidationAllocationApprovalView = {
  order_id: string;
  commercial_version_id: string;
  approval_required: boolean;
  approval_status: "not_required" | "pending" | "approved";
  approval_reasons: string[];
  gross_margin_percent: number | null;
};

export type ConsolidationAllocationView = {
  package_id: string;
  status: ConsolidationAllocationStatus;
  prepared_at: string;
  prepared_by_name: string;
  allocation_method: string;
  allocation_basis: string;
  currency: CrmCurrency;
  total: number;
  required_approvals: number;
  approved_approvals: number;
  pending_approvals: number;
  approvals: ConsolidationAllocationApprovalView[];
};

function normalizedId(value: string) {
  return value.trim().toUpperCase();
}

export function consolidationCurrencyDecimals(currency: string) {
  return currency.trim().toUpperCase() === "JPY" ? 0 : 2;
}

function memberNumbersValid(member: ConsolidationAllocationMemberInput) {
  return [member.weight_kg, member.volume_cbm, member.pieces]
    .every((value) => Number.isFinite(value) && value >= 0);
}

function allocationBasis(members: ConsolidationAllocationMemberInput[]) {
  const weight = members.reduce((sum, member) => sum + member.weight_kg, 0);
  if (weight > 0) return { field: "weight_kg" as const, total: weight };
  const volume = members.reduce((sum, member) => sum + member.volume_cbm, 0);
  if (volume > 0) return { field: "volume_cbm" as const, total: volume };
  const pieces = members.reduce((sum, member) => sum + member.pieces, 0);
  if (pieces > 0) return { field: "pieces" as const, total: pieces };
  return { field: "equal" as const, total: members.length };
}

/**
 * Deterministic currency-aware allocation used by staged consolidation economics.
 *
 * Money is converted to integer minor units before allocation. Base shares use
 * floor so they can never over-allocate. Remaining minor units are assigned by
 * largest fractional remainder, with canonical order id descending as the stable
 * tie breaker. Therefore 100.00 / 3 becomes 33.33, 33.33, 33.34 for ORD-1/2/3,
 * and retries are independent of Firestore/query/array iteration order.
 */
export function allocateConsolidationProcurement(
  total: number,
  currency: CrmCurrency,
  membersInput: ConsolidationAllocationMemberInput[],
): ConsolidationAllocationResult {
  if (!Number.isFinite(total) || total < 0) return { ok: false, reason: "invalid_total" };
  if (!membersInput.length) return { ok: false, reason: "invalid_members" };
  if (membersInput.length > 20) return { ok: false, reason: "too_many_houses" };

  const members = membersInput.map((member) => ({
    ...member,
    order_id: normalizedId(member.order_id),
  }));
  if (members.some((member) => !member.order_id || !memberNumbersValid(member))) return { ok: false, reason: "invalid_members" };
  if (new Set(members.map((member) => member.order_id)).size !== members.length) return { ok: false, reason: "duplicate_house" };

  members.sort((left, right) => left.order_id.localeCompare(right.order_id));
  const basis = allocationBasis(members);
  const decimals = consolidationCurrencyDecimals(currency);
  const scale = 10 ** decimals;
  const totalUnits = Math.round(total * scale);
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 0) return { ok: false, reason: "invalid_total" };

  const working = members.map((member) => {
    const basisValue = basis.field === "equal" ? 1 : member[basis.field];
    const exactUnits = basis.total > 0 ? totalUnits * (basisValue / basis.total) : 0;
    const floorUnits = Math.floor(exactUnits + Number.EPSILON);
    return {
      order_id: member.order_id,
      basis_value: basisValue,
      floor_units: floorUnits,
      fraction: exactUnits - floorUnits,
      extra_units: 0,
    };
  });

  const floorTotal = working.reduce((sum, item) => sum + item.floor_units, 0);
  const residualUnits = totalUnits - floorTotal;
  if (residualUnits < 0 || residualUnits > working.length) return { ok: false, reason: "invalid_total" };
  const recipients = [...working].sort((left, right) => {
    const fractionDelta = right.fraction - left.fraction;
    if (Math.abs(fractionDelta) > 1e-12) return fractionDelta;
    return right.order_id.localeCompare(left.order_id);
  });
  const residualRecipients: string[] = [];
  for (let index = 0; index < residualUnits; index += 1) {
    const recipient = recipients[index];
    if (!recipient) return { ok: false, reason: "invalid_total" };
    recipient.extra_units += 1;
    residualRecipients.push(recipient.order_id);
  }

  const allocations = working
    .sort((left, right) => left.order_id.localeCompare(right.order_id))
    .map((item) => ({
      order_id: item.order_id,
      amount: (item.floor_units + item.extra_units) / scale,
      basis_value: item.basis_value,
    }));
  const allocatedUnits = allocations.reduce((sum, item) => sum + Math.round(item.amount * scale), 0);
  if (allocatedUnits !== totalUnits || allocations.some((item) => item.amount < 0 || !Number.isFinite(item.amount))) {
    return { ok: false, reason: "invalid_total" };
  }

  return {
    ok: true,
    basis: basis.field,
    basis_total: basis.total,
    currency,
    currency_decimals: decimals,
    total: totalUnits / scale,
    allocations,
    rounding_strategy: "largest_remainder_then_order_id_desc",
    residual_units: residualUnits,
    residual_recipients: residualRecipients,
  };
}

export function consolidationAllocationApprovalStatus(
  required: Array<{ approval_required: boolean; approved: boolean }>,
): { status: "pending_approval" | "ready"; required: number; approved: number; pending: number } {
  const requiring = required.filter((item) => item.approval_required);
  const approved = requiring.filter((item) => item.approved).length;
  return {
    status: approved === requiring.length ? "ready" : "pending_approval",
    required: requiring.length,
    approved,
    pending: requiring.length - approved,
  };
}
