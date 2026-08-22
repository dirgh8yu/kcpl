import type { TrackingMilestone } from "../visibility/tracking-visibility";

export type EdiTransactionSet = "204" | "990" | "214";
export type EdiDirection = "inbound" | "outbound";
export type EdiTransactionStatus = "queued" | "dispatched" | "processed" | "duplicate" | "quarantined" | "failed";

export type X12Segment = { tag: string; elements: string[] };
export type X12Envelope = {
  transactionSet: string | null;
  transactionControl: string | null;
  groupControl: string | null;
  interchangeControl: string | null;
  senderId: string | null;
  receiverId: string | null;
  segments: X12Segment[];
};

export type Edi990Response = {
  tenderReference: string | null;
  orderReference: string | null;
  carrierReference: string | null;
  response: "accepted" | "rejected" | null;
  responseCode: string | null;
  note: string | null;
};

export type Edi214Event = {
  code: string;
  reasonCode: string | null;
  milestone: TrackingMilestone;
  rawStatus: string;
  eventTime: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  providerEventId: string;
};

export type Edi214Message = {
  carrierReference: string | null;
  shipmentReference: string | null;
  tenderReference: string | null;
  bookingReference: string | null;
  scac: string | null;
  events: Edi214Event[];
};

export type Build204Input = {
  tenderReference: string;
  orderReference: string;
  senderId?: string;
  receiverId?: string;
  partnerName: string;
  origin: string;
  destination: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  equipment?: string | null;
  mode: string;
  weightKg?: number;
  pieces?: number;
  offeredCost: number;
  currency: string;
  controlNumber?: number;
  now?: Date;
};

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().replace(/[\r\n*~]+/g, " ").replace(/\s+/g, " ").slice(0, max) : "";
}

function nullable(value: unknown) {
  const output = clean(value);
  return output || null;
}

function x12Date(date: Date) { return date.toISOString().slice(2, 10).replaceAll("-", ""); }
function x12Date8(date: Date) { return date.toISOString().slice(0, 10).replaceAll("-", ""); }
function x12Time(date: Date) { return date.toISOString().slice(11, 16).replace(":", ""); }
function padIsa(value: string, length: number) { return clean(value, length).padEnd(length, " ").slice(0, length); }

export function parseX12(raw: string): X12Envelope {
  const input = raw.replace(/^\uFEFF/, "").trim();
  if (!input) return { transactionSet: null, transactionControl: null, groupControl: null, interchangeControl: null, senderId: null, receiverId: null, segments: [] };
  const segmentTerminator = input.includes("~") ? "~" : "\n";
  const segments = input
    .split(segmentTerminator)
    .map((segment) => segment.trim().replace(/\r$/, ""))
    .filter(Boolean)
    .map((segment) => {
      const [tag, ...elements] = segment.split("*");
      return { tag: clean(tag, 8).toUpperCase(), elements: elements.map((item) => item.trim()) };
    });
  const isa = segments.find((segment) => segment.tag === "ISA");
  const gs = segments.find((segment) => segment.tag === "GS");
  const st = segments.find((segment) => segment.tag === "ST");
  return {
    transactionSet: nullable(st?.elements[0]),
    transactionControl: nullable(st?.elements[1]),
    groupControl: nullable(gs?.elements[5]),
    interchangeControl: nullable(isa?.elements[12]),
    senderId: nullable(isa?.elements[5]) ?? nullable(gs?.elements[1]),
    receiverId: nullable(isa?.elements[7]) ?? nullable(gs?.elements[2]),
    segments,
  };
}

function referenceFromSegments(segments: X12Segment[], qualifiers: string[]) {
  for (const segment of segments) {
    if (segment.tag !== "N9" && segment.tag !== "L11") continue;
    const qualifier = clean(segment.elements[0], 20).toUpperCase();
    if (qualifiers.includes(qualifier)) return nullable(segment.elements[1]);
  }
  return null;
}

export function parse990(raw: string): Edi990Response {
  const envelope = parseX12(raw);
  if (envelope.transactionSet !== "990") return { tenderReference: null, orderReference: null, carrierReference: null, response: null, responseCode: null, note: null };
  const b1 = envelope.segments.find((segment) => segment.tag === "B1");
  const code = clean(b1?.elements[3] ?? b1?.elements[2], 10).toUpperCase() || null;
  const acceptedCodes = new Set(["A", "AC", "Y"]);
  const rejectedCodes = new Set(["D", "R", "N"]);
  const response = code && acceptedCodes.has(code) ? "accepted" : code && rejectedCodes.has(code) ? "rejected" : null;
  const noteSegment = envelope.segments.find((segment) => segment.tag === "K1" || segment.tag === "NTE");
  return {
    tenderReference: referenceFromSegments(envelope.segments, ["TN", "TENDER", "ZZ"]),
    orderReference: referenceFromSegments(envelope.segments, ["CN", "PO", "OR"]),
    carrierReference: nullable(b1?.elements[1]) ?? referenceFromSegments(envelope.segments, ["BM", "2I", "CR"]),
    response,
    responseCode: code,
    note: nullable(noteSegment?.elements.join(" ")),
  };
}

function parseEventTime(dateValue: string | undefined, timeValue: string | undefined) {
  const date = clean(dateValue, 8);
  const time = clean(timeValue, 6);
  if (!/^\d{8}$/.test(date)) return null;
  const hh = /^\d{4,6}$/.test(time) ? time.slice(0, 2) : "00";
  const mm = /^\d{4,6}$/.test(time) ? time.slice(2, 4) : "00";
  const ss = /^\d{6}$/.test(time) ? time.slice(4, 6) : "00";
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${hh}:${mm}:${ss}Z`;
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : null;
}

export function edi214Milestone(codeValue: string): TrackingMilestone {
  const code = clean(codeValue, 12).toUpperCase();
  if (["AF", "X3", "X4", "CP"].includes(code)) return "picked_up";
  if (["X6", "AG", "I1", "OA"].includes(code)) return "departed";
  if (["X1", "AR", "AV"].includes(code)) return "arrived_destination";
  if (["OD"].includes(code)) return "out_for_delivery";
  if (["D1", "CD"].includes(code)) return "delivered";
  if (["A7", "AD"].includes(code)) return "delivery_attempted";
  if (["R1"].includes(code)) return "delivery_refused";
  if (["SD", "S1", "J1", "J2", "J4", "J5"].includes(code)) return "exception";
  return "unknown";
}

function edi214Status(codeValue: string) {
  const code = clean(codeValue, 12).toUpperCase();
  const milestone = edi214Milestone(code);
  const labels: Record<TrackingMilestone, string> = {
    booked: "Booking confirmed",
    pickup_scheduled: "Pickup scheduled",
    picked_up: "Picked up",
    origin_terminal: "Origin terminal",
    export_customs: "Export customs",
    departed: "In transit / departed",
    transshipment: "Transshipment",
    arrived_destination: "Arrived at destination",
    import_customs: "Import customs",
    out_for_delivery: "Out for delivery",
    delivery_attempted: "Delivery attempted",
    delivered: "Delivered",
    delivery_refused: "Delivery refused",
    exception: "Carrier exception",
    unknown: `EDI 214 status ${code || "unknown"}`,
  };
  return labels[milestone];
}

export function parse214(raw: string): Edi214Message {
  const envelope = parseX12(raw);
  if (envelope.transactionSet !== "214") return { carrierReference: null, shipmentReference: null, tenderReference: null, bookingReference: null, scac: null, events: [] };
  const b10 = envelope.segments.find((segment) => segment.tag === "B10");
  const events: Edi214Event[] = [];
  let pendingIndex: number | null = null;
  let eventCounter = 0;
  for (const segment of envelope.segments) {
    if (segment.tag === "AT7") {
      const code = clean(segment.elements[0], 12).toUpperCase();
      const reasonCode = nullable(segment.elements[1]);
      const eventTime = parseEventTime(segment.elements[4], segment.elements[5]);
      const milestone = edi214Milestone(code);
      eventCounter += 1;
      events.push({
        code,
        reasonCode,
        milestone,
        rawStatus: edi214Status(code),
        eventTime,
        location: null,
        city: null,
        state: null,
        country: null,
        providerEventId: [envelope.interchangeControl, envelope.groupControl, envelope.transactionControl, eventCounter, code, eventTime].filter(Boolean).join(":"),
      });
      pendingIndex = events.length - 1;
    } else if (segment.tag === "MS1" && pendingIndex !== null) {
      const city = nullable(segment.elements[0]);
      const state = nullable(segment.elements[1]);
      const country = nullable(segment.elements[2]);
      events[pendingIndex] = { ...events[pendingIndex], city, state, country, location: [city, state, country].filter(Boolean).join(", ") || null };
      pendingIndex = null;
    }
  }
  return {
    carrierReference: nullable(b10?.elements[0]),
    shipmentReference: nullable(b10?.elements[1]) ?? referenceFromSegments(envelope.segments, ["CN", "SI"]),
    tenderReference: referenceFromSegments(envelope.segments, ["TN", "TENDER"]),
    bookingReference: referenceFromSegments(envelope.segments, ["BM", "2I", "BN"]),
    scac: nullable(b10?.elements[2]) ?? nullable(envelope.segments.find((segment) => segment.tag === "MS3")?.elements[0]),
    events,
  };
}

export function build204(input: Build204Input) {
  const now = input.now ?? new Date();
  const control = Math.max(1, Math.trunc(input.controlNumber ?? Number(now.getTime().toString().slice(-9)))).toString().padStart(9, "0").slice(-9);
  const sender = clean(input.senderId || "KCPL", 15) || "KCPL";
  const receiver = clean(input.receiverId || input.partnerName, 15) || "PARTNER";
  const stControl = control.slice(-4);
  const pickup = input.pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate) ? input.pickupDate.replaceAll("-", "") : null;
  const delivery = input.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate) ? input.deliveryDate.replaceAll("-", "") : null;
  const body = [
    `ST*204*${stControl}`,
    `B2**KCPL**${clean(input.tenderReference, 30)}**CC`,
    "B2A*00",
    `L11*CN*${clean(input.orderReference, 80)}`,
    `L11*TN*${clean(input.tenderReference, 80)}`,
    "N1*SH*Kapileshwor Cargo Pvt Ltd",
    "S5*1*LD",
    `N1*SF*${clean(input.origin, 60)}`,
    ...(pickup ? [`G62*10*${pickup}`] : []),
    "S5*2*UL",
    `N1*ST*${clean(input.destination, 60)}`,
    ...(delivery ? [`G62*17*${delivery}`] : []),
    ...(input.equipment ? [`N7**${clean(input.equipment, 20)}`] : []),
    `L3*${Math.max(0, Number(input.weightKg ?? 0)).toFixed(2)}*K***${Math.max(0, input.offeredCost).toFixed(2)}*****${clean(input.currency, 3)}***${Math.max(0, Math.trunc(input.pieces ?? 0))}`,
    `NTE*GEN*Mode ${clean(input.mode, 30)}; commercial offer ${clean(input.currency, 3)} ${Math.max(0, input.offeredCost).toFixed(2)}`,
  ];
  const seCount = body.length + 1;
  const segments = [
    `ISA*00*          *00*          *ZZ*${padIsa(sender, 15)}*ZZ*${padIsa(receiver, 15)}*${x12Date(now)}*${x12Time(now)}*U*00401*${control}*0*T*:`,
    `GS*SM*${sender}*${receiver}*${x12Date8(now)}*${x12Time(now)}*1*X*004010`,
    ...body,
    `SE*${seCount}*${stControl}`,
    "GE*1*1",
    `IEA*1*${control}`,
  ];
  return `${segments.join("~")}~`;
}
