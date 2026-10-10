import { moveCargoClaim } from "../../../../../../cargo-claims.server";
import { json, jobWriteRequest } from "../../../job-route-auth";

const errors: Record<string, [string, number]> = {
  missing: ["That claim isn’t on this shipment.", 404],
  invalid_status: ["That can’t be done from where the claim is now.", 409],
  finance_only: ["Accounts or Management settle or turn down a claim, as it decides money.", 403],
  reason_required: ["Say why the claim isn’t accepted (a few words). The customer sees the outcome.", 400],
};
const inputErrors: Record<string, string> = {
  party: "Choose who the claim is filed with.",
  date: "Enter a date on or after the problem was found, and not in the future.",
  amount: "Enter amounts as numbers; a credit note or refund needs an amount.",
  method: "Choose how the customer is compensated. “Nothing” can’t carry an amount.",
  note: "Add a note.",
};

/** File, settle, turn down or withdraw a claim, or move its notice deadline. */
export async function PATCH(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const action = auth.body.action;
  if (action !== "file" && action !== "settle" && action !== "reject" && action !== "withdraw" && action !== "notice_due") return json({ ok: false, error: "Unknown action." }, 400);
  try {
    const result = await moveCargoClaim(auth.reference, decodeURIComponent(id), { action, input: auth.body }, auth.actor, auth.staff);
    if (result.kind === "updated") return json({ ok: true });
    if (result.kind === "invalid") return json({ ok: false, error: inputErrors[result.error] ?? "Check the details." }, 400);
    const [error, status] = errors[result.kind] ?? ["The claim couldn’t be updated.", 400];
    return json({ ok: false, error }, status);
  } catch (error) {
    console.error("KCPL claim update failed", error);
    return json({ ok: false, error: "The claim couldn’t be updated. Try again." }, 500);
  }
}
