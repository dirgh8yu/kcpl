import { compatibleRecordBranches, strictBranchValue, type AccessBranch } from "../branch-access-policy.ts";

export type Edi990TenderCandidate = {
  id: string;
  orderId: string;
  branch: unknown;
  status: string;
};

export type Edi990TenderResolution =
  | { kind: "ready"; tender: Edi990TenderCandidate }
  | { kind: "reject"; reason: "missing_reference" | "tender_not_unique" | "order_not_unique" | "reference_conflict" };

export function resolveEdi990TenderTarget(input: {
  hasTenderReference: boolean;
  suppliedOrderReference?: string | null;
  candidates: Edi990TenderCandidate[];
}): Edi990TenderResolution {
  const suppliedOrder = input.suppliedOrderReference?.trim().toUpperCase() || "";
  if (input.hasTenderReference) {
    if (input.candidates.length !== 1) return { kind: "reject", reason: "tender_not_unique" };
    const tender = input.candidates[0];
    if (suppliedOrder && tender.orderId.trim().toUpperCase() !== suppliedOrder) return { kind: "reject", reason: "reference_conflict" };
    return { kind: "ready", tender };
  }
  if (!suppliedOrder) return { kind: "reject", reason: "missing_reference" };
  const live = input.candidates.filter((candidate) => candidate.status === "sent");
  if (live.length !== 1) return { kind: "reject", reason: "order_not_unique" };
  return { kind: "ready", tender: live[0] };
}

export type Edi990ChainResolution =
  | { kind: "ready"; branch: AccessBranch }
  | { kind: "reject"; reason: "invalid_tender_scope" | "missing_order" | "branch_mismatch" | "claimed_branch_conflict"; branch: AccessBranch | null };

export function validateEdi990CanonicalChain(input: {
  tender: Edi990TenderCandidate;
  orderExists: boolean;
  orderBranch: unknown;
  claimedBranch?: string | null;
}): Edi990ChainResolution {
  const branch = strictBranchValue(input.tender.branch);
  if (!branch || !input.tender.orderId.trim()) return { kind: "reject", reason: "invalid_tender_scope", branch };
  if (!input.orderExists) return { kind: "reject", reason: "missing_order", branch };
  if (!compatibleRecordBranches(branch, input.orderBranch)) return { kind: "reject", reason: "branch_mismatch", branch };
  const claimed = input.claimedBranch?.trim() || "";
  if (claimed && claimed !== branch) return { kind: "reject", reason: "claimed_branch_conflict", branch };
  return { kind: "ready", branch };
}
