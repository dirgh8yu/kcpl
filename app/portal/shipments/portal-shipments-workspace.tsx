"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Package } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFilterChip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  OpsToolbar,
} from "../../admin/operations-ui";
import type { PortalShipmentView } from "../portal-access-policy";
import { portalDate, portalDateTime, portalModeLabel, portalStatusLabel, portalStatusTone } from "../portal-format";

type ShipmentFocus = "all" | "active" | "in_transit" | "attention" | "delivered";

const focusLabels: Record<ShipmentFocus, string> = {
  all: "All",
  active: "Active",
  in_transit: "In transit",
  attention: "Needs attention",
  delivered: "Delivered",
};

function matchesFocus(shipment: PortalShipmentView, focus: ShipmentFocus) {
  if (focus === "all") return true;
  if (focus === "active") return shipment.status !== "delivered";
  if (focus === "in_transit") return shipment.status === "in_transit";
  if (focus === "attention") return shipment.status === "exception";
  return shipment.status === "delivered";
}

export function PortalShipmentsWorkspace({ shipments }: { shipments: PortalShipmentView[] }) {
  const [focus, setFocus] = useState<ShipmentFocus>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shipments.filter((shipment) => {
      if (!matchesFocus(shipment, focus)) return false;
      if (!needle) return true;
      return [shipment.reference, shipment.origin, shipment.destination, shipment.carrier, shipment.carrier_reference]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [shipments, focus, query]);

  const filtered = focus !== "all" || query.trim().length > 0;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Shipments"
        description="Every movement KCPL has handled for your account, with the milestones your operations team records."
        meta={<span>{shipments.length} shipment{shipments.length === 1 ? "" : "s"} on record</span>}
      />
      <div className="ops-content">
        <OpsSurface flush>
          <OpsToolbar className="portal-toolbar">
            <OpsSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reference, route or carrier…"
              aria-label="Search your shipments"
            />
            <div className="portal-filter-group" role="group" aria-label="Shipment filter">
              {(Object.keys(focusLabels) as ShipmentFocus[]).map((value) => (
                <OpsFilterChip key={value} active={focus === value} onClick={() => setFocus(value)}>
                  {focusLabels[value]}
                </OpsFilterChip>
              ))}
            </div>
            {filtered ? (
              <OpsButton size="sm" variant="ghost" onClick={() => { setFocus("all"); setQuery(""); }}>Reset</OpsButton>
            ) : null}
            <span className="portal-toolbar-count">{rows.length} shown</span>
          </OpsToolbar>

          {rows.length ? (
            <OpsTableWrap>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Carrier</th>
                    <th>ETA</th>
                    <th>Last update</th>
                    <th><span className="portal-sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((shipment) => (
                    <tr key={shipment.reference}>
                      <td>
                        <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-link">
                          <OpsMono>{shipment.reference}</OpsMono>
                        </Link>
                        <span className="portal-cell-detail">{portalModeLabel(shipment.mode)}</span>
                      </td>
                      <td>
                        <span className="portal-lane">{shipment.origin || "Origin"}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || "Destination"}</span>
                        {shipment.current_location ? <span className="portal-cell-detail">Now at {shipment.current_location}</span> : null}
                      </td>
                      <td><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status)}</OpsBadge></td>
                      <td>
                        {shipment.carrier ?? "—"}
                        {shipment.carrier_reference ? <span className="portal-cell-detail"><OpsMono>{shipment.carrier_reference}</OpsMono></span> : null}
                      </td>
                      <td>{portalDate(shipment.eta)}</td>
                      <td>{portalDateTime(shipment.updated_at)}</td>
                      <td>
                        <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-open" aria-label={`Open shipment ${shipment.reference}`}>
                          <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <div className="portal-empty-wrap">
              <OpsEmptyState
                kind={filtered ? "search" : "neutral"}
                icon={<Package size={18}/>}
                title={filtered ? "No shipments match this view" : "No shipments yet"}
                description={filtered
                  ? "Try a different filter or clear the search."
                  : "Once KCPL books a shipment for your account it appears here with its milestones and documents."}
                action={filtered ? <OpsButton size="sm" variant="secondary" onClick={() => { setFocus("all"); setQuery(""); }}>Reset view</OpsButton> : undefined}
              />
            </div>
          )}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
