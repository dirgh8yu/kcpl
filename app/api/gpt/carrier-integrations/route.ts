import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { carrierIntegrationDefinitions, inferCarrierIntegrationProvider } from "../../../admin/carrier-integrations/carrier-integrations";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function configured(provider: "maersk_ocean" | "dhl_express") {
  if (provider === "dhl_express") return Boolean(process.env.DHL_EXPRESS_API_USER?.trim() && process.env.DHL_EXPRESS_API_PASSWORD?.trim());
  return Boolean(process.env.MAERSK_CONSUMER_KEY?.trim() || process.env.MAERSK_WEBHOOK_SECRET?.trim());
}

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);
  try {
    const db = firebaseAdminDb();
    const [shipments, health, unmatched] = await Promise.all([
      db.collection("shipments").orderBy("updated_at", "desc").limit(1500).get(),
      db.collection("carrier_integrations").get(),
      db.collection("carrier_integration_unmatched_events").limit(500).get(),
    ]);
    const healthMap = new Map(health.docs.map((doc) => [doc.id, doc]));
    const providers = carrierIntegrationDefinitions.map((definition) => {
      const doc = healthMap.get(definition.id);
      return {
        id: definition.id,
        label: definition.label,
        configured: configured(definition.id),
        activeCapabilities: definition.activeCapabilities,
        lastAction: nullable(doc?.get("last_action")),
        lastSuccessAt: nullable(doc?.get("last_success_at")),
        lastFailureAt: nullable(doc?.get("last_failure_at")),
        lastHttpStatus: doc ? Number(doc.get("last_http_status") ?? 0) || null : null,
        lastMessage: nullable(doc?.get("last_message")),
      };
    });
    const linked = shipments.docs.flatMap((doc) => {
      const carrier = text(doc.get("carrier"));
      const mode = text(doc.get("mode"));
      const explicit = text(doc.get("carrier_integration_provider"));
      const provider = carrierIntegrationDefinitions.some((item) => item.id === explicit) ? explicit : inferCarrierIntegrationProvider(carrier, mode);
      if (!provider) return [];
      return [{
        reference: doc.id,
        provider,
        carrier,
        mode,
        status: text(doc.get("status")),
        branch: nullable(doc.get("primary_branch")),
        carrierReference: nullable(doc.get("carrier_reference")) ?? nullable(doc.get("tracking_number")),
        bookingReference: nullable(doc.get("booking_reference")),
        lastTrackingAt: nullable(doc.get("tracking_last_event_at")),
        lastTrackingProvider: nullable(doc.get("tracking_last_provider")),
        lastCarrierSyncAt: nullable(doc.get("carrier_integration_last_sync_at")),
        lastCarrierError: nullable(doc.get("carrier_integration_last_error")),
      }];
    }).slice(0, 120);
    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      providers,
      summary: {
        configuredProviders: providers.filter((provider) => provider.configured).length,
        linkedShipments: linked.length,
        shipmentsWithCarrierErrors: linked.filter((shipment) => shipment.lastCarrierError).length,
        unmatchedOceanEvents: unmatched.size,
      },
      linkedShipments: linked,
      safety: "This action is read-only. It reports carrier adapter configuration and health without exposing API credentials, webhook secrets or authorization headers. It cannot create carrier bookings, request pickups or mutate provider accounts.",
    });
  } catch (error) {
    console.error("KCPL Custom GPT carrier integration briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL carrier integration briefing is temporarily unavailable." }, 503);
  }
}
