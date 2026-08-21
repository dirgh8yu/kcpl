export const customsClearanceStatuses = ["not_started", "preparing", "lodged", "held", "released"] as const;
export type CustomsClearanceStatus = (typeof customsClearanceStatuses)[number];

export const customsClearanceStatusLabels: Record<CustomsClearanceStatus, string> = {
  not_started: "Not started",
  preparing: "Preparing",
  lodged: "Lodged",
  held: "Held",
  released: "Released",
};

export type CustomsDeskState = "blocked" | "in_progress" | "awaiting_release" | "ready" | "released";
export type CustomsDeskRisk = "critical" | "warning" | "normal";

export function customsClearanceStatusValue(value: unknown): CustomsClearanceStatus {
  return customsClearanceStatuses.includes(value as CustomsClearanceStatus) ? value as CustomsClearanceStatus : "not_started";
}

export function customsReleaseRequired(direction: string) {
  return direction === "import" || direction === "export" || direction === "cross_trade";
}

export function customsClearanceValidationError(input: {
  status: CustomsClearanceStatus;
  entryPoint: string;
  declarationReference: string;
  holdReason: string;
  releaseEvidence: string;
}) {
  if (input.status === "held" && input.holdReason.trim().length < 4) {
    return "Record why Customs has placed the shipment on hold.";
  }
  if (input.status === "released") {
    if (input.entryPoint.trim().length < 2) return "Record the customs or border point before confirming release.";
    if (!input.declarationReference.trim() && input.releaseEvidence.trim().length < 8) {
      return "Record a declaration/reference or a short release-evidence note before confirming Customs release.";
    }
  }
  return null;
}

export function customsDeskState(input: {
  requiredSteps: number;
  openSteps: number;
  missingDocuments: number;
  integrityIssues: number;
  shipmentInCustoms: boolean;
  releaseRequired?: boolean;
  clearanceStatus?: CustomsClearanceStatus;
}): CustomsDeskState {
  const clearanceStatus = input.clearanceStatus ?? "not_started";
  if (input.missingDocuments > 0 || input.integrityIssues > 0 || clearanceStatus === "held") return "blocked";
  if (input.openSteps > 0) return "in_progress";
  if (input.releaseRequired) return clearanceStatus === "released" ? "released" : "awaiting_release";
  if (clearanceStatus === "released") return "released";
  return "ready";
}

export function customsDeskRisk(input: {
  status: string;
  openSteps: number;
  missingDocuments: number;
  integrityIssues: number;
  etaDays: number | null;
  releaseRequired?: boolean;
  clearanceStatus?: CustomsClearanceStatus;
}): CustomsDeskRisk {
  const clearanceStatus = input.clearanceStatus ?? "not_started";
  const releasePending = Boolean(input.releaseRequired && clearanceStatus !== "released");
  const hasBlocker = input.openSteps > 0 || input.missingDocuments > 0 || input.integrityIssues > 0 || clearanceStatus === "held" || releasePending;
  if (!hasBlocker) return "normal";
  if (input.status === "out_for_delivery") return "critical";
  if (input.etaDays !== null && input.etaDays <= 0) return "critical";
  if (clearanceStatus === "held" && input.status === "customs_clearance") return "critical";
  if (input.status === "customs_clearance") return "warning";
  if (input.etaDays !== null && input.etaDays <= 2) return "warning";
  return "normal";
}

export function validCustomsDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
