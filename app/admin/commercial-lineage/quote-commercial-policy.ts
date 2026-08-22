function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export type QuoteEconomicEditDecision = "allowed_legacy" | "locked_versioned";

export function quoteEconomicEditDecision(data: Record<string, unknown>): QuoteEconomicEditDecision {
  const hasVersionPointer = Boolean(text(data.commercial_version_id) || text(data.commercial_fingerprint));
  return data.commercial_locked === true || hasVersionPointer ? "locked_versioned" : "allowed_legacy";
}
