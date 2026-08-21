export function normalizeReconciliationSupplierName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikePartnerReference(value: string) {
  return /^KCPL-P-[A-Z0-9-]+$/i.test(value.trim());
}

export function isDuplicateSupplierIdentityCandidate(input: {
  candidateSupplierId: string | null;
  candidateSupplierName: string;
  targetPartnerId: string;
  targetPartnerName: string;
  originalSupplierName: string;
}) {
  const candidateId = (input.candidateSupplierId ?? "").trim().toUpperCase();
  const targetId = input.targetPartnerId.trim().toUpperCase();
  if (candidateId === targetId) return true;
  if (candidateId && looksLikePartnerReference(candidateId)) return false;

  const candidateName = normalizeReconciliationSupplierName(input.candidateSupplierName);
  if (!candidateName) return false;
  const targetName = normalizeReconciliationSupplierName(input.targetPartnerName);
  const originalName = normalizeReconciliationSupplierName(input.originalSupplierName);
  return candidateName === targetName || Boolean(originalName && candidateName === originalName);
}
