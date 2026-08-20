import Link from "next/link";
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

  return <>{children}<Link href="/admin/alerts" className="fixed bottom-5 left-5 z-50 rounded-2xl border border-white/15 bg-[#b78a3e] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-[#10263f] shadow-xl transition hover:-translate-y-0.5">Alerts & escalations</Link></>;
}
