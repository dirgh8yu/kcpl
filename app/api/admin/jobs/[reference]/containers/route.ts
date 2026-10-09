import { addShipmentContainers } from "../../../../../shipment-containers.server";
import { json, jobWriteRequest } from "../../job-route-auth";

/** Add containers to a shipment: one number or several pasted, with their size and detention terms. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  try {
    const result = await addShipmentContainers(auth.reference, auth.body, auth.actor);
    if (result.kind === "added") return json({ ok: true, added: result.added, skipped: result.skipped });
    if (result.kind === "invalid_numbers") return json({ ok: false, error: `${result.invalid.join(", ")} ${result.invalid.length === 1 ? "isn’t a valid container number" : "aren’t valid container numbers"}: four letters and seven digits, the last a check digit. Check them against the box or the bill of lading.` }, 400);
    if (result.kind === "numbers_required") return json({ ok: false, error: "Enter at least one container number." }, 400);
    if (result.kind === "too_many") return json({ ok: false, error: "A shipment holds up to 200 containers here." }, 400);
    return json({ ok: false, error: result.error }, 400);
  } catch (error) {
    console.error("KCPL containers add failed", error);
    return json({ ok: false, error: "The containers couldn’t be saved. Try again." }, 500);
  }
}
