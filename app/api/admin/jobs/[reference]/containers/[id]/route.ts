import { removeShipmentContainer, updateShipmentContainer } from "../../../../../../shipment-containers.server";
import { json, jobWriteRequest } from "../../../job-route-auth";

type Context = { params: Promise<{ reference: string; id: string }> };

/** Record a container's dates (out of the port, delivered, empty returned) and its detention terms. */
export async function PATCH(request: Request, context: Context) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  try {
    const result = await updateShipmentContainer(auth.reference, decodeURIComponent(id), auth.body, auth.actor);
    if (result.kind === "updated") return json({ ok: true });
    if (result.kind === "missing") return json({ ok: false, error: "That container isn’t on this shipment." }, 404);
    return json({ ok: false, error: result.error }, 400);
  } catch (error) {
    console.error("KCPL container update failed", error);
    return json({ ok: false, error: "The container couldn’t be saved. Try again." }, 500);
  }
}

/** Take off a container entered by mistake, before it has left the port. */
export async function DELETE(request: Request, context: Context) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  try {
    const result = await removeShipmentContainer(auth.reference, decodeURIComponent(id), auth.actor);
    if (result.kind === "removed") return json({ ok: true });
    if (result.kind === "has_movement") return json({ ok: false, error: "This container has left the port, so its record stays. Correct its dates instead." }, 409);
    return json({ ok: false, error: "That container isn’t on this shipment." }, 404);
  } catch (error) {
    console.error("KCPL container remove failed", error);
    return json({ ok: false, error: "The container couldn’t be removed. Try again." }, 500);
  }
}
