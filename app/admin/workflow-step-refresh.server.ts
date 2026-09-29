import { refreshShipmentWorkflowStep } from "./workflow-guard.server";

type ShipmentRouteContext = { params: Promise<{ reference: string }> };

/** Wrap a shipment route so a successful change also refreshes the
 * shipment's stored current step (what the Shipments list shows). */
export function withStepRefresh<C extends ShipmentRouteContext, R extends Response | undefined>(handler: (request: Request, context: C) => Promise<R>) {
  return async (request: Request, context: C): Promise<R> => {
    const response = await handler(request, context);
    if (response?.ok) await refreshShipmentWorkflowStep((await context.params).reference);
    return response;
  };
}
