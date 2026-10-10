import { moveContainerDeposit } from "../../../../../../container-deposits.server";
import { json, jobWriteRequest } from "../../../job-route-auth";

const errors: Record<string, [string, number]> = {
  missing: ["That deposit isn’t on this shipment.", 404],
  invalid_status: ["That can’t be done from where the deposit is now.", 409],
  invalid_date: ["Enter a date on or after the deposit was paid, and not in the future.", 400],
  finance_only: ["Accounts or Management record the refund, as it is money received.", 403],
  management_only: ["Only Management can write a deposit off.", 403],
  reason_required: ["Say why the deposit is being written off (a few words). It stays on the record.", 400],
};
const refundErrors: Record<string, string> = {
  amount: "Enter what the line paid back: from nothing up to the deposit.",
  date: "Enter the day the refund came in: not before the deposit was paid, and not in the future.",
  reason: "Say why the line kept part of the deposit. For “Other”, add a note.",
};

/** Claim, refund, write off, or take back a claim. */
export async function PATCH(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const action = auth.body.action;
  if (action !== "claim" && action !== "refund" && action !== "write_off" && action !== "reopen") return json({ ok: false, error: "Unknown action." }, 400);
  try {
    const result = await moveContainerDeposit(auth.reference, decodeURIComponent(id), { ...auth.body, action } as Parameters<typeof moveContainerDeposit>[2], auth.actor, auth.staff);
    if (result.kind === "updated") return json({ ok: true });
    if (result.kind === "invalid_refund") return json({ ok: false, error: refundErrors[result.error] }, 400);
    const [error, status] = errors[result.kind] ?? ["The deposit couldn’t be updated.", 400];
    return json({ ok: false, error }, status);
  } catch (error) {
    console.error("KCPL deposit update failed", error);
    return json({ ok: false, error: "The deposit couldn’t be updated. Try again." }, 500);
  }
}
