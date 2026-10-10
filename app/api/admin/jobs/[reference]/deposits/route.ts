import { addContainerDeposit } from "../../../../../container-deposits.server";
import { json, jobWriteRequest } from "../../job-route-auth";

const errors: Record<string, string> = {
  line: "Name the shipping line or agent the deposit was paid to.",
  amount: "Enter the deposit amount.",
  date: "Enter the day it was paid, not a future date.",
  payer: "Choose who paid the deposit.",
  containers: "Choose containers that are on this shipment.",
};

/** A deposit paid to the shipping line for this shipment's containers. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  try {
    const result = await addContainerDeposit(auth.reference, auth.body, auth.actor);
    if (result.kind === "added") return json({ ok: true, id: result.id });
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    return json({ ok: false, error: errors[result.error] ?? "Check the deposit details." }, 400);
  } catch (error) {
    console.error("KCPL deposit add failed", error);
    return json({ ok: false, error: "The deposit couldn’t be saved. Try again." }, 500);
  }
}
