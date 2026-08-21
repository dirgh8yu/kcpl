export type CustomsDeskState = "blocked" | "in_progress" | "ready" | "clear";
export type CustomsDeskRisk = "critical" | "warning" | "normal";

export function customsDeskState(input: {
  requiredSteps: number;
  openSteps: number;
  missingDocuments: number;
  integrityIssues: number;
  shipmentInCustoms: boolean;
}): CustomsDeskState {
  if (input.missingDocuments > 0 || input.integrityIssues > 0) return "blocked";
  if (input.openSteps > 0) return "in_progress";
  if (input.requiredSteps > 0 || input.shipmentInCustoms) return "ready";
  return "clear";
}

export function customsDeskRisk(input: {
  status: string;
  openSteps: number;
  missingDocuments: number;
  integrityIssues: number;
  etaDays: number | null;
}): CustomsDeskRisk {
  const hasBlocker = input.openSteps > 0 || input.missingDocuments > 0 || input.integrityIssues > 0;
  if (!hasBlocker) return "normal";
  if (input.status === "out_for_delivery") return "critical";
  if (input.etaDays !== null && input.etaDays <= 0) return "critical";
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
