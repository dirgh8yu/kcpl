import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { recordOrderedTrackingEvent } from "../visibility/tracking-ingest.server";
import {
  carrierIntegrationDefinitions,
  inferCarrierIntegrationProvider,
  normalizeDhlTrackingPayload,
  providerConfigState,
  safeCarrierErrorMessage,
  type CarrierIntegrationProvider,
  type CarrierIntegrationState,
} from "./carrier-integrations";
import { ingestMaerskDcsaPayloadSafely } from "./maersk-webhook.server";

type Actor = { name: string; email: string };

type HealthRecord = {
  provider: CarrierIntegrationProvider;
  state: CarrierIntegrationState;
  last_action: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_http_status: number | null;
  last_message: string | null;
  last_latency_ms: number | null;
  updated_at: string | null;
};

export type CarrierProviderDashboard = {
  id: CarrierIntegrationProvider;
  label: string;
  carrier: string;
  modes: string[];
  auth: string;
  capabilities: string[];
  active_capabilities: string[];
  docs_note: string;
  state: CarrierIntegrationState;
  configured: boolean;
  configuration: {
    schedules?: boolean;
    webhook?: boolean;
    private_api?: boolean;
    tracking?: boolean;
  };
  last_action: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_http_status: number | null;
  last_message: string | null;
  last_latency_ms: number | null;
};

export type CarrierShipmentCandidate = {
  reference: string;
  provider: CarrierIntegrationProvider | null;
  carrier: string;
  carrier_reference: string | null;
  booking_reference: string | null;
  mode: string;
  status: string;
  branch: KcplBranch;
  current_location: string | null;
  last_tracking_at: string | null;
  last_tracking_provider: string | null;
  last_sync_at: string | null;
  sync_error: string | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberOrNull(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function eventHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function env(name: string) { return process.env[name]?.trim() ?? ""; }

function dhlBaseUrl() {
  return env("DHL_EXPRESS_API_BASE_URL") || "https://express.api.dhl.com/mydhlapi/test";
}

function maerskBaseUrl() {
  return env("MAERSK_API_BASE_URL") || "https://api.maersk.com";
}

function providerConfiguration(provider: CarrierIntegrationProvider) {
  if (provider === "dhl_express") {
    const user = Boolean(env("DHL_EXPRESS_API_USER"));
    const password = Boolean(env("DHL_EXPRESS_API_PASSWORD"));
    return { present: Number(user) + Number(password), required: 2, detail: { tracking: user && password } };
  }
  const consumerKey = Boolean(env("MAERSK_CONSUMER_KEY"));
  const webhook = Boolean(env("MAERSK_WEBHOOK_SECRET"));
  const privateApi = consumerKey && Boolean(env("MAERSK_CLIENT_SECRET")) && Boolean(env("MAERSK_OAUTH_TOKEN_URL"));
  return { present: Number(consumerKey) + Number(webhook), required: 2, detail: { schedules: consumerKey, webhook, private_api: privateApi } };
}

async function healthRecord(provider: CarrierIntegrationProvider): Promise<HealthRecord> {
  if (!firebaseRuntimeConfigured()) return { provider, state: "unconfigured", last_action: null, last_success_at: null, last_failure_at: null, last_http_status: null, last_message: null, last_latency_ms: null, updated_at: null };
  const snapshot = await firebaseAdminDb().collection("carrier_integrations").doc(provider).get();
  const config = providerConfiguration(provider);
  const lastSuccess = nullable(snapshot.get("last_success_at"));
  const lastFailure = nullable(snapshot.get("last_failure_at"));
  const state = providerConfigState(config.present, config.required, Boolean(lastSuccess), Boolean(lastFailure && (!lastSuccess || lastFailure > lastSuccess)));
  return {
    provider,
    state,
    last_action: nullable(snapshot.get("last_action")),
    last_success_at: lastSuccess,
    last_failure_at: lastFailure,
    last_http_status: numberOrNull(snapshot.get("last_http_status")),
    last_message: nullable(snapshot.get("last_message")),
    last_latency_ms: numberOrNull(snapshot.get("last_latency_ms")),
    updated_at: nullable(snapshot.get("updated_at")),
  };
}

async function recordHealth(provider: CarrierIntegrationProvider, action: string, ok: boolean, status: number | null, message: string, latencyMs: number | null) {
  if (!firebaseRuntimeConfigured()) return;
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("carrier_integrations").doc(provider).set({
    provider,
    last_action: action,
    ...(ok ? { last_success_at: now } : { last_failure_at: now }),
    last_http_status: status,
    last_message: message.slice(0, 500),
    last_latency_ms: latencyMs,
    updated_at: now,
  }, { merge: true });
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const raw = await response.text();
    let body: unknown = {};
    if (raw) {
      try { body = JSON.parse(raw); }
      catch { body = { message: raw.slice(0, 1000) }; }
    }
    return { response, body, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function shipmentBranch(data: Record<string, unknown>) {
  const primary = branchValue(data.primary_branch);
  if (primary) return primary;
  const handling = Array.isArray(data.handling_branches) ? data.handling_branches : [];
  return handling.map(branchValue).find((branch): branch is KcplBranch => Boolean(branch)) ?? null;
}

function candidateFromSnapshot(snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): CarrierShipmentCandidate | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const branch = shipmentBranch(data);
  if (!branch) return null;
  const carrier = text(data.carrier);
  const mode = text(data.mode);
  const explicit = text(data.carrier_integration_provider) as CarrierIntegrationProvider;
  const provider = carrierIntegrationDefinitions.some((definition) => definition.id === explicit) ? explicit : inferCarrierIntegrationProvider(carrier, mode);
  return {
    reference: snapshot.id,
    provider,
    carrier,
    carrier_reference: nullable(data.carrier_reference) ?? nullable(data.tracking_number),
    booking_reference: nullable(data.booking_reference),
    mode,
    status: text(data.status, "booking_confirmed"),
    branch,
    current_location: nullable(data.current_location),
    last_tracking_at: nullable(data.tracking_last_event_at),
    last_tracking_provider: nullable(data.tracking_last_provider),
    last_sync_at: nullable(data.carrier_integration_last_sync_at),
    sync_error: nullable(data.carrier_integration_last_error),
  };
}

export async function listCarrierIntegrationDashboard(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [health, shipments] = await Promise.all([
    Promise.all(carrierIntegrationDefinitions.map((definition) => healthRecord(definition.id))),
    db.collection("shipments").orderBy("updated_at", "desc").limit(1500).get(),
  ]);
  const healthMap = new Map(health.map((item) => [item.provider, item]));
  const providers: CarrierProviderDashboard[] = carrierIntegrationDefinitions.map((definition) => {
    const config = providerConfiguration(definition.id);
    const h = healthMap.get(definition.id)!;
    return {
      id: definition.id,
      label: definition.label,
      carrier: definition.carrier,
      modes: definition.modes,
      auth: definition.auth,
      capabilities: definition.capabilities,
      active_capabilities: definition.activeCapabilities,
      docs_note: definition.docsNote,
      state: h.state,
      configured: h.state !== "unconfigured" && h.state !== "partial",
      configuration: config.detail,
      last_action: h.last_action,
      last_success_at: h.last_success_at,
      last_failure_at: h.last_failure_at,
      last_http_status: h.last_http_status,
      last_message: h.last_message,
      last_latency_ms: h.last_latency_ms,
    };
  });
  const rows = shipments.docs
    .map(candidateFromSnapshot)
    .filter((row): row is CarrierShipmentCandidate => Boolean(row))
    .filter((row) => staffCanAccessBranch(staff, row.branch))
    .filter((row) => Boolean(row.provider || row.carrier_reference || row.booking_reference))
    .slice(0, 500);
  return {
    kind: "ready" as const,
    providers,
    rows,
    summary: {
      configured: providers.filter((provider) => provider.configured).length,
      degraded: providers.filter((provider) => provider.state === "degraded").length,
      linked_shipments: rows.filter((row) => row.provider).length,
      dhl_sync_ready: rows.filter((row) => row.provider === "dhl_express" && row.carrier_reference).length,
      maersk_linked: rows.filter((row) => row.provider === "maersk_ocean").length,
    },
    generated_at: new Date().toISOString(),
  };
}

async function shipmentScope(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const branch = shipmentBranch(data);
  if (!branch) return { kind: "invalid_branch" as const };
  if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
  return { kind: "ready" as const, ref, snapshot, data, branch };
}

export async function syncDhlTracking(reference: string, actor: Actor, staff: KcplStaffContext) {
  const configuration = providerConfiguration("dhl_express");
  if (configuration.present < configuration.required) return { kind: "not_configured" as const };
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  const canonicalBranch = branchValue(scope.data.primary_branch);
  if (!canonicalBranch) return { kind: "invalid_branch" as const };
  const trackingNumber = nullable(scope.data.carrier_reference) ?? nullable(scope.data.tracking_number) ?? nullable(scope.data.booking_reference);
  if (!trackingNumber) return { kind: "tracking_reference_required" as const };
  const username = env("DHL_EXPRESS_API_USER");
  const password = env("DHL_EXPRESS_API_PASSWORD");
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const url = `${dhlBaseUrl().replace(/\/$/, "")}/shipments/${encodeURIComponent(trackingNumber)}/tracking`;
  let result;
  try {
    result = await fetchJson(url, { headers: { authorization: `Basic ${auth}`, accept: "application/json", "user-agent": "KCPL-Operations/1.0" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "DHL tracking request timed out." : "DHL tracking request failed before a response was received.";
    await recordHealth("dhl_express", "tracking_sync", false, null, message, null);
    await scope.ref.update({ carrier_integration_provider: "dhl_express", carrier_integration_last_error: message, carrier_integration_last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { kind: "provider_error" as const, error: message };
  }
  if (!result.response.ok) {
    const message = safeCarrierErrorMessage(result.response.status, result.body);
    await recordHealth("dhl_express", "tracking_sync", false, result.response.status, message, result.latencyMs);
    await scope.ref.update({ carrier_integration_provider: "dhl_express", carrier_integration_last_error: message, carrier_integration_last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { kind: "provider_error" as const, status: result.response.status, error: message };
  }
  const events = normalizeDhlTrackingPayload(result.body, trackingNumber);
  let created = 0;
  let duplicates = 0;
  let historical = 0;
  for (const event of events) {
    const saved = await recordOrderedTrackingEvent(scope.snapshot.id, {
      rawStatus: event.rawStatus,
      milestone: event.milestone,
      title: event.title,
      location: event.location,
      latitude: null,
      longitude: null,
      eventTime: event.eventTime,
      source: "carrier_api",
      provider: "DHL Express MyDHL API",
      providerEventId: eventHash(event.providerEventId),
      details: event.details,
      eta: "",
      confidence: 1,
    }, { name: "DHL Express MyDHL API", email: "dhl-tracking@kcpl.internal" });
    if (saved.kind === "created") {
      created += 1;
      if ("historical" in saved && saved.historical) historical += 1;
    } else if (saved.kind === "duplicate") {
      duplicates += 1;
    } else if (saved.kind === "invalid_branch" || saved.kind === "missing" || saved.kind === "unavailable") {
      await recordHealth("dhl_express", "tracking_sync", false, 409, `DHL checkpoint ingestion stopped: ${saved.kind}.`, result.latencyMs);
      return saved;
    }
  }
  const now = new Date().toISOString();
  await scope.ref.update({
    carrier_integration_provider: "dhl_express",
    carrier_integration_last_sync_at: now,
    carrier_integration_last_error: null,
    carrier_integration_last_result_count: events.length,
    updated_at: now,
  });
  await scope.ref.collection("job_activity").add({
    type: "carrier_tracking_sync",
    title: "DHL Express tracking synchronized",
    detail: `${events.length} checkpoint${events.length === 1 ? "" : "s"} received · ${created} new · ${duplicates} duplicate`,
    branch: canonicalBranch,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
    provider: "dhl_express",
  });
  await recordHealth("dhl_express", "tracking_sync", true, result.response.status, `${events.length} DHL tracking checkpoints received.`, result.latencyMs);
  return { kind: "ready" as const, trackingNumber, received: events.length, created, duplicates, historical };
}

function objectArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  return [];
}

function scheduleRows(payload: unknown) {
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const candidates = Array.isArray(payload)
    ? objectArray(payload)
    : [root.oceanProducts, root.products, root.routes, root.transportSchedules, root.data].flatMap(objectArray);
  return candidates.slice(0, 20).map((item, index) => {
    const origin = item.origin && typeof item.origin === "object" ? item.origin as Record<string, unknown> : {};
    const destination = item.destination && typeof item.destination === "object" ? item.destination as Record<string, unknown> : {};
    return {
      index: index + 1,
      origin: text(item.origin) || text(origin.locationName) || text(origin.UNLocationCode) || text(origin.unLocationCode),
      destination: text(item.destination) || text(destination.locationName) || text(destination.UNLocationCode) || text(destination.unLocationCode),
      departure: text(item.departureDateTime) || text(item.departureDate) || text(item.estimatedDepartureDateTime),
      arrival: text(item.arrivalDateTime) || text(item.arrivalDate) || text(item.estimatedArrivalDateTime),
      vessel: text(item.vesselName),
      voyage: text(item.voyageNumber) || text(item.exportVoyageNumber),
      service: text(item.serviceName) || text(item.serviceCode) || text(item.productName),
    };
  });
}

export async function searchMaerskOceanSchedules(origin: string, destination: string) {
  const consumerKey = env("MAERSK_CONSUMER_KEY");
  if (!consumerKey) return { kind: "not_configured" as const };
  const from = origin.trim().toUpperCase();
  const to = destination.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(from) || !/^[A-Z]{2}[A-Z0-9]{3}$/.test(to)) return { kind: "invalid_locations" as const };
  const url = new URL(`${maerskBaseUrl().replace(/\/$/, "")}/products/ocean-products`);
  url.searchParams.set("origin", from);
  url.searchParams.set("destination", to);
  url.searchParams.set("vesselOperatorCarrierCode", "MAEU");
  let result;
  try {
    result = await fetchJson(url.toString(), { headers: { "Consumer-Key": consumerKey, accept: "application/json", "user-agent": "KCPL-Operations/1.0" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Maersk schedule request timed out." : "Maersk schedule request failed before a response was received.";
    await recordHealth("maersk_ocean", "schedule_search", false, null, message, null);
    return { kind: "provider_error" as const, error: message };
  }
  if (!result.response.ok) {
    const message = safeCarrierErrorMessage(result.response.status, result.body);
    await recordHealth("maersk_ocean", "schedule_search", false, result.response.status, message, result.latencyMs);
    return { kind: "provider_error" as const, status: result.response.status, error: message };
  }
  const rows = scheduleRows(result.body);
  await recordHealth("maersk_ocean", "schedule_search", true, result.response.status, `${rows.length} Maersk schedule option${rows.length === 1 ? "" : "s"} normalized.`, result.latencyMs);
  return { kind: "ready" as const, origin: from, destination: to, rows, raw_result_count: rows.length };
}

/**
 * Compatibility export for any internal callers. It deliberately delegates to
 * the same #128-safe set-based resolver used by the production webhook route;
 * there is no alternate first-match ingestion authority.
 */
export async function ingestMaerskDcsaPayload(payload: unknown) {
  return ingestMaerskDcsaPayloadSafely(payload);
}
