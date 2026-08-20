import type { ReactNode } from "react";
import { evaluateAutomationRules } from "../alerts/alert-engine.server";
import { evaluatePayablesAlerts } from "../payables/payables-alerts.server";

export default async function CommandCentreLayout({ children }: { children: ReactNode }) {
  try {
    await evaluateAutomationRules();
    await evaluatePayablesAlerts();
  } catch (error) {
    console.error("KCPL automation evaluation failed during Command Centre load", error);
  }

  return <>{children}</>;
}
