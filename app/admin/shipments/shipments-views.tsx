"use client";

import { ArrowRight, Package, Plane, Ship, Train, Truck } from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import type { CommandCentreJob } from "../command-centre/command-centre-data";
import { shipmentNextAction } from "./shipment-queue-policy";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

/* ---- Shared presentation helpers (single source of truth for the register) ---- */

export function statusTone(status: ShipmentStatus): StatusTone {
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "warning";
  if (status === "out_for_delivery") return "info";
  if (status === "in_transit") return "success";
  return "neutral";
}

export function priorityTone(priority: CommandCentreJob["priority"]): StatusTone {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  return "neutral";
}

export function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: value.length === 10 ? "UTC" : NEPAL_TIME_ZONE,
  }).format(date);
}

export function relativeAge(value: string, anchor: string) {
  const time = Date.parse(value);
  const anchorTime = Date.parse(anchor);
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return "Updated";
  const minutes = Math.max(0, Math.round((anchorTime - time) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ownerLabel(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}

export function routeText(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

/* ---- Country flags -------------------------------------------------------- */
// Origin/destination are free text. We resolve an ISO country only when it can
// be derived confidently from a trailing code, a country name, or a known port
// city — otherwise we render no flag rather than guess wrong.

const COUNTRY_NAMES: Record<string, string> = {
  CN: "China", NP: "Nepal", IN: "India", AE: "United Arab Emirates", SG: "Singapore",
  TH: "Thailand", KR: "South Korea", BD: "Bangladesh", LK: "Sri Lanka", US: "United States",
  DE: "Germany", GB: "United Kingdom", JP: "Japan", HK: "Hong Kong", MY: "Malaysia",
  VN: "Vietnam", ID: "Indonesia", PK: "Pakistan", QA: "Qatar", SA: "Saudi Arabia",
  NL: "Netherlands", IT: "Italy", FR: "France", TR: "Turkey", TW: "Taiwan", AU: "Australia",
};

const NAME_TO_CODE: Record<string, string> = {
  china: "CN", nepal: "NP", india: "IN", "united arab emirates": "AE", uae: "AE",
  singapore: "SG", thailand: "TH", "south korea": "KR", korea: "KR", bangladesh: "BD",
  "sri lanka": "LK", "united states": "US", usa: "US", germany: "DE", "united kingdom": "GB",
  japan: "JP", "hong kong": "HK", malaysia: "MY", vietnam: "VN", indonesia: "ID",
  pakistan: "PK", qatar: "QA", "saudi arabia": "SA", netherlands: "NL", italy: "IT",
  france: "FR", turkey: "TR", taiwan: "TW", australia: "AU",
};

const CITY_TO_CODE: Record<string, string> = {
  shanghai: "CN", qingdao: "CN", shenzhen: "CN", ningbo: "CN", guangzhou: "CN", beijing: "CN", xiamen: "CN",
  "hong kong": "HK", kolkata: "IN", haldia: "IN", delhi: "IN", "new delhi": "IN", mumbai: "IN",
  chennai: "IN", visakhapatnam: "IN", "nhava sheva": "IN", raxaul: "IN",
  kathmandu: "NP", birgunj: "NP", biratnagar: "NP", bhairahawa: "NP",
  dubai: "AE", "abu dhabi": "AE", "jebel ali": "AE", bangkok: "TH", "laem chabang": "TH",
  seoul: "KR", busan: "KR", dhaka: "BD", chittagong: "BD", colombo: "LK", "port klang": "MY",
  klang: "MY", "ho chi minh": "VN", jakarta: "ID", karachi: "PK", doha: "QA", jeddah: "SA",
  rotterdam: "NL", hamburg: "DE", singapore: "SG",
};

function resolveCountry(raw: string | null): { code: string; name: string } | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  const parts = text.split(",").map((segment) => segment.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (/^[A-Za-z]{2}$/.test(last)) {
    const code = last.toUpperCase();
    return { code, name: COUNTRY_NAMES[code] ?? code };
  }
  const lowerFull = text.toLowerCase();
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    if (lowerFull.includes(name)) return { code, name: COUNTRY_NAMES[code] ?? name };
  }
  for (const part of parts) {
    const code = CITY_TO_CODE[part.toLowerCase()];
    if (code) return { code, name: COUNTRY_NAMES[code] ?? code };
  }
  return null;
}

// Emoji flags render through whatever emoji font the machine happens to ship,
// so the same row looked different on every workstation and turned to a blob at
// 13px. The ISO code is legible everywhere and is the vocabulary freight staff
// already use. The city name beside it carries the meaning, so this stays
// aria-hidden rather than doubling up for screen readers.
export function CountryFlag({ location }: { location: string | null }) {
  const country = resolveCountry(location);
  if (!country) return null;
  return (
    <span className="ship-flag" title={country.name} data-code={country.code} aria-hidden="true">
      {country.code}
    </span>
  );
}

export function ModeIcon({ mode, size = 15 }: { mode: string | null; size?: number }) {
  const value = (mode || "").toLowerCase();
  const props = { size, strokeWidth: 1.75, "aria-hidden": true } as const;
  if (value.includes("air") || value.includes("plane")) return <Plane {...props} />;
  if (value.includes("sea") || value.includes("ocean")) return <Ship {...props} />;
  if (value.includes("rail") || value.includes("train")) return <Train {...props} />;
  if (value.includes("road") || value.includes("truck")) return <Truck {...props} />;
  return <Package {...props} />;
}

export function ShipRoute({ origin, destination }: { origin: string | null; destination: string | null }) {
  return (
    <span className="ship-route">
      <span className="ship-route-end">
        <CountryFlag location={origin} />
        <span className="loc">{origin || "Origin"}</span>
      </span>
      <ArrowRight className="ship-route-arrow" size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="ship-route-end">
        <CountryFlag location={destination} />
        <span className="loc">{destination || "Destination"}</span>
      </span>
    </span>
  );
}

/* ---- Alternate register views -------------------------------------------- */

type ViewProps = {
  jobs: CommandCentreJob[];
  selectedReference: string | null;
  onSelect: (reference: string) => void;
};

export function ShipmentCards({ jobs, selectedReference, onSelect }: ViewProps) {
  if (!jobs.length) return null;
  return (
    <div className="shipments-cards" role="list" aria-label="Shipment cards">
      {jobs.map((job) => {
        const action = shipmentNextAction(job);
        const owner = ownerLabel(job);
        return (
          <div key={job.reference} role="listitem" style={{ display: "contents" }}>
            <button
              type="button"
              className="ship-card"
              data-selected={selectedReference === job.reference || undefined}
              onClick={() => onSelect(job.reference)}
              aria-label={`Open ${job.reference}, ${job.customer_name || "unlinked customer"}, ${shipmentStatusLabels[job.status]}`}
            >
              <span className="ship-card-head">
                <span className="ops-mono ship-card-ref">{job.reference}</span>
                <span className="ops-badge" data-tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</span>
              </span>
              <strong className="ship-card-customer">{job.customer_name || "Customer not linked"}</strong>
              <ShipRoute origin={job.origin} destination={job.destination} />
              <span className="ship-card-meta">
                <span className="ship-card-mode"><ModeIcon mode={job.mode} size={14} />{job.mode || "—"}</span>
                <span>ETA {shortDate(job.eta)}</span>
                <span className={owner === "Unassigned" ? "ship-card-warn" : undefined}>{owner}</span>
              </span>
              <span className="shipment-next-action-cell" data-tone={action.tone}>{action.title}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ShipmentMap({ jobs, selectedReference, onSelect }: ViewProps) {
  if (!jobs.length) return null;
  return (
    <div className="shipments-map">
      <p className="shipments-map-note">
        Route schematic · {jobs.length} shipment{jobs.length === 1 ? "" : "s"} in view. Lanes are illustrative, not geographic positions.
      </p>
      <div className="shipments-map-canvas" role="list" aria-label="Shipment routes">
        {jobs.map((job) => (
          <div key={job.reference} role="listitem" style={{ display: "contents" }}>
            <button
              type="button"
              className="ship-lane"
              data-selected={selectedReference === job.reference || undefined}
              onClick={() => onSelect(job.reference)}
              aria-label={`Open ${job.reference}, ${job.origin || "origin"} to ${job.destination || "destination"}, ${shipmentStatusLabels[job.status]}`}
            >
              <span className="ops-mono ship-lane-ref">{job.reference}</span>
              <span className="ship-lane-track">
                <span className="ship-lane-end">
                  <CountryFlag location={job.origin} />
                  <span className="loc">{job.origin || "Origin"}</span>
                </span>
                <span className="ship-lane-line">
                  <span className="ship-lane-mode"><ModeIcon mode={job.mode} size={13} /></span>
                </span>
                <span className="ship-lane-end ship-lane-end-dest">
                  <CountryFlag location={job.destination} />
                  <span className="loc">{job.destination || "Destination"}</span>
                </span>
              </span>
              <span className="ship-lane-status">
                <span className="ops-badge" data-tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</span>
                <span className="ship-lane-eta">ETA {shortDate(job.eta)}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- CSV export ----------------------------------------------------------- */

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportShipmentsCsv(jobs: CommandCentreJob[], filenameBase = "kcpl-shipments") {
  const headers = [
    "Reference", "Quote", "Customer", "Origin", "Destination", "Mode",
    "Status", "Priority", "ETA", "Owner", "Branch", "Updated",
  ];
  const rows = jobs.map((job) => [
    job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.mode,
    shipmentStatusLabels[job.status], job.priority, job.eta ?? "", ownerLabel(job), job.primary_branch, job.updated_at,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
