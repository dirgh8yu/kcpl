export const carrierIntegrationProviders = ["maersk_ocean", "dhl_express"] as const;
export type CarrierIntegrationProvider = (typeof carrierIntegrationProviders)[number];

export type CarrierIntegrationCapability =
  | "tracking"
  | "schedules"
  | "rating"
  | "booking"
  | "pickup"
  | "pod"
  | "webhook";

export type CarrierIntegrationState = "unconfigured" | "partial" | "configured" | "healthy" | "degraded";

export type CarrierIntegrationDefinition = {
  id: CarrierIntegrationProvider;
  label: string;
  carrier: string;
  modes: string[];
  auth: string;
  capabilities: CarrierIntegrationCapability[];
  activeCapabilities: CarrierIntegrationCapability[];
  docsNote: string;
};

export const carrierIntegrationDefinitions: CarrierIntegrationDefinition[] = [
  {
    id: "maersk_ocean",
    label: "Maersk Ocean",
    carrier: "Maersk",
    modes: ["sea", "multimodal"],
    auth: "Consumer-Key for schedules; OAuth 2.0 / webhook entitlement for private products",
    capabilities: ["tracking", "schedules", "booking", "webhook"],
    activeCapabilities: ["tracking", "schedules", "webhook"],
    docsNote: "DCSA-aligned ocean schedules and Track & Trace. Booking remains staff-controlled until KCPL is provisioned for the DCSA Booking product.",
  },
  {
    id: "dhl_express",
    label: "DHL Express",
    carrier: "DHL Express",
    modes: ["courier", "air"],
    auth: "HTTP BasicAuth using MyDHL API credentials",
    capabilities: ["tracking", "rating", "booking", "pickup", "pod"],
    activeCapabilities: ["tracking"],
    docsNote: "MyDHL tracking is live-adapter ready. Rating, shipment creation and pickup writes remain disabled until KCPL explicitly enables the commercial workflow and account controls.",
  },
];

export type DhlTrackingEvent = {
  providerEventId: string;
  rawStatus: string;
  milestone: string | null;
  title: string;
  location: string;
  eventTime: string;
  details: string;
};

export type DcsaTrackingEvent = {
  providerEventId: string;
  rawStatus: string;
  milestone: string | null;
  title: string;
  location: string;
  eventTime: string;
  details: string;
  carrierBookingReference: string | null;
  transportDocumentReference: string | null;
  equipmentReference: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function validIso(value: unknown) {
  const candidate = text(value);
  if (!candidate) return "";
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function combineDateTime(dateValue: unknown, timeValue: unknown) {
  const date = text(dateValue);
  const time = text(timeValue);
  if (!date) return validIso(timeValue);
  if (!time) return validIso(dateValue);
  return validIso(`${date}T${time}`) || validIso(`${date} ${time}`);
}

export function inferCarrierIntegrationProvider(carrier: string | null | undefined, mode = ""): CarrierIntegrationProvider | null {
  const normalizedCarrier = (carrier ?? "").trim().toLowerCase();
  const normalizedMode = mode.trim().toLowerCase();
  if (normalizedCarrier.includes("maersk") || normalizedCarrier.includes("sealand")) return "maersk_ocean";
  if (normalizedCarrier.includes("dhl") && (normalizedCarrier.includes("express") || ["courier", "air"].includes(normalizedMode))) return "dhl_express";
  return null;
}

export function providerConfigState(present: number, required: number, lastSuccess: boolean | null, lastFailure: boolean): CarrierIntegrationState {
  if (required <= 0 || present <= 0) return "unconfigured";
  if (present < required) return "partial";
  if (lastFailure) return "degraded";
  if (lastSuccess) return "healthy";
  return "configured";
}

export function dhlStatusMilestone(status: string): string | null {
  const value = status.trim().toLowerCase();
  if (!value) return null;
  if (/delivered|proof of delivery|signed for|received by/.test(value)) return "delivered";
  if (/with delivery courier|out for delivery|courier is delivering/.test(value)) return "out_for_delivery";
  if (/clearance|customs|broker/.test(value)) return "import_customs";
  if (/exception|on hold|shipment is held|failed|undeliverable/.test(value)) return "exception";
  if (/picked up|shipment picked up|collected from shipper/.test(value)) return "picked_up";
  if (/departed|processed at|transit|forwarded to/.test(value)) return "departed";
  if (/arrived|arrived at|facility/.test(value)) return "arrived_destination";
  return "unknown";
}

function dhlLocation(value: Record<string, unknown>) {
  const serviceArea = array(value.serviceArea).map(record);
  const location = record(value.location);
  const address = record(location.address);
  return firstText(
    value.locationDescription,
    serviceArea[0]?.description,
    serviceArea[0]?.code,
    location.name,
    address.addressLocality,
    address.cityName,
    value.serviceAreaDescription,
  );
}

function dhlEventTime(value: Record<string, unknown>) {
  return validIso(value.timestamp)
    || validIso(value.dateTime)
    || combineDateTime(value.date, value.time)
    || validIso(value.eventTime);
}

function dhlEventsFromShipment(shipment: Record<string, unknown>) {
  const events = array(shipment.events).map(record);
  if (events.length) return events;
  const checkpoints = array(shipment.checkpoints).map(record);
  if (checkpoints.length) return checkpoints;
  const status = record(shipment.status);
  return Object.keys(status).length ? [status] : [];
}

export function normalizeDhlTrackingPayload(payload: unknown, trackingNumber: string): DhlTrackingEvent[] {
  const root = record(payload);
  const shipments = array(root.shipments).map(record);
  const sourceShipments = shipments.length ? shipments : [root];
  const output: DhlTrackingEvent[] = [];
  for (const shipment of sourceShipments) {
    const shipmentId = firstText(shipment.id, shipment.shipmentTrackingNumber, shipment.trackingNumber, trackingNumber);
    for (const event of dhlEventsFromShipment(shipment)) {
      const rawStatus = firstText(event.description, event.status, event.statusCode, event.typeCode, record(event.status).description);
      if (!rawStatus) continue;
      const eventTime = dhlEventTime(event) || validIso(shipment.timestamp) || new Date(0).toISOString();
      const location = dhlLocation(event);
      const code = firstText(event.typeCode, event.statusCode, event.code);
      const providerEventId = [shipmentId, eventTime, code, rawStatus, location].join("|");
      output.push({
        providerEventId,
        rawStatus,
        milestone: dhlStatusMilestone(`${code} ${rawStatus}`),
        title: rawStatus,
        location,
        eventTime,
        details: firstText(event.remark, event.remarks, event.details),
      });
    }
  }
  return output
    .filter((event) => event.eventTime !== new Date(0).toISOString())
    .sort((a, b) => a.eventTime.localeCompare(b.eventTime));
}

export function dcsaEventMilestone(event: Record<string, unknown>): string | null {
  const transport = firstText(event.transportEventTypeCode, event.transportEventType).toUpperCase();
  const equipment = firstText(event.equipmentEventTypeCode, event.equipmentEventType).toUpperCase();
  const shipment = firstText(event.shipmentEventTypeCode, event.shipmentEventType).toUpperCase();
  const classifier = firstText(event.eventClassifierCode, event.classifierCode).toUpperCase();
  if (["DEPA"].includes(transport)) return "departed";
  if (["ARRI"].includes(transport)) return "arrived_destination";
  if (["LOAD", "GTOT", "DEPA"].includes(equipment)) return "departed";
  if (["DISC", "GTIN"].includes(equipment)) return "arrived_destination";
  if (["PICK", "PICKUP"].includes(equipment)) return "picked_up";
  if (["RECE", "CONF"].includes(shipment)) return "booked";
  if (["CANC"].includes(shipment)) return "exception";
  if (classifier === "EST" || classifier === "PLN") return "unknown";
  return "unknown";
}

function dcsaLocation(event: Record<string, unknown>) {
  const location = record(event.eventLocation);
  const facility = record(event.facility);
  return firstText(location.locationName, location.UNLocationCode, location.unLocationCode, facility.facilityName, facility.UNLocationCode);
}

function referenceValue(event: Record<string, unknown>, type: string) {
  const documentReferences = array(event.documentReferences).map(record);
  const match = documentReferences.find((item) => firstText(item.documentReferenceType, item.type).toUpperCase() === type.toUpperCase());
  return match ? firstText(match.documentReferenceValue, match.value) : "";
}

export function normalizeDcsaTrackingEvent(input: unknown): DcsaTrackingEvent | null {
  const event = record(input);
  const eventType = firstText(event.eventType, event.transportEventTypeCode, event.equipmentEventTypeCode, event.shipmentEventTypeCode);
  const eventTime = validIso(event.eventDateTime) || validIso(event.eventCreatedDateTime);
  if (!eventType || !eventTime) return null;
  const carrierBookingReference = firstText(event.carrierBookingReference, referenceValue(event, "CBR")) || null;
  const transportDocumentReference = firstText(event.transportDocumentReference, referenceValue(event, "TRD")) || null;
  const equipmentReference = firstText(event.equipmentReference, record(event.equipment).equipmentReference) || null;
  const location = dcsaLocation(event);
  const classifier = firstText(event.eventClassifierCode, "ACT");
  const rawStatus = [eventType, classifier].filter(Boolean).join(" ");
  const providerEventId = firstText(event.eventID, event.eventId) || [eventTime, eventType, carrierBookingReference, transportDocumentReference, equipmentReference, location].filter(Boolean).join("|");
  return {
    providerEventId,
    rawStatus,
    milestone: dcsaEventMilestone(event),
    title: `${eventType}${classifier ? ` · ${classifier}` : ""}`,
    location,
    eventTime,
    details: firstText(event.remark, event.description),
    carrierBookingReference,
    transportDocumentReference,
    equipmentReference,
  };
}

export function dcsaPayloadEvents(payload: unknown) {
  if (Array.isArray(payload)) return payload.map(normalizeDcsaTrackingEvent).filter((event): event is DcsaTrackingEvent => Boolean(event));
  const root = record(payload);
  const events = array(root.events);
  if (events.length) return events.map(normalizeDcsaTrackingEvent).filter((event): event is DcsaTrackingEvent => Boolean(event));
  const single = normalizeDcsaTrackingEvent(root);
  return single ? [single] : [];
}

export function safeCarrierErrorMessage(status: number, body: unknown) {
  const root = record(body);
  const detail = firstText(root.detail, root.message, root.title, root.error);
  if (status === 401 || status === 403) return "Carrier authentication or product entitlement was rejected.";
  if (status === 404) return "Carrier could not find the requested shipment or resource.";
  if (status === 429) return "Carrier rate limit was reached. Retry after the provider window resets.";
  if (status >= 500) return "Carrier service is temporarily unavailable.";
  return detail ? detail.slice(0, 280) : `Carrier request failed with HTTP ${status}.`;
}
