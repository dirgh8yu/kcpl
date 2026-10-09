import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../../../../../firebase-admin.server";
import { computeDutyEstimate, dutyEstimateFromInput } from "../../../../../shipment-duty-estimate";
import { json, jobWriteRequest } from "../../job-route-auth";

/**
 * Save the duty estimate on a shipment. It writes the estimate field and
 * nothing else on the shipment: an estimate never moves its status or money.
 */
export async function PUT(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const checked = dutyEstimateFromInput(auth.body);
  if (!checked.ok) return json({ ok: false, error: checked.error }, 400);
  const result = computeDutyEstimate(checked.input);
  const now = new Date().toISOString();
  const rateNote = typeof auth.body.rateNote === "string" ? auth.body.rateNote.trim().slice(0, 200) || null : null;
  try {
    const shipment = firebaseAdminDb().collection("shipments").doc(auth.reference);
    const batch = firebaseAdminDb().batch();
    batch.update(shipment, { duty_estimate: { ...checked.input, result, rate_note: rateNote, updated_at: now, updated_by_name: auth.actor.name, updated_by_email: auth.actor.email }, updated_at: now });
    batch.create(shipment.collection("job_activity").doc(`duty-estimate-${Date.now()}`), {
      type: "duty_estimate_updated", title: `Duty estimate NPR ${result.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      detail: `${checked.input.lines.length} HS line${checked.input.lines.length === 1 ? "" : "s"}${checked.input.shared_with_customer ? " · shown to the customer" : ""}`,
      actor_name: auth.actor.name, actor_email: auth.actor.email, created_at: now,
    });
    await batch.commit();
    return json({ ok: true, result });
  } catch (error) {
    console.error("KCPL duty estimate save failed", error);
    return json({ ok: false, error: "The estimate couldn’t be saved. Try again." }, 500);
  }
}

/** Clear the estimate. */
export async function DELETE(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  try {
    await firebaseAdminDb().collection("shipments").doc(auth.reference).update({ duty_estimate: FieldValue.delete(), updated_at: new Date().toISOString() });
    return json({ ok: true });
  } catch (error) {
    console.error("KCPL duty estimate clear failed", error);
    return json({ ok: false, error: "The estimate couldn’t be cleared. Try again." }, 500);
  }
}
