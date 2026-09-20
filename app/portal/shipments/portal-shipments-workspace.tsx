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
import { portalTranslator, type PortalLocale, type PortalTextKey } from "../portal-i18n";

type ShipmentFocus = "all" | "active" | "in_transit" | "attention" | "delivered";

const focusKeys: Record<ShipmentFocus, PortalTextKey> = {
  all: "ships.focus_all",
  active: "ships.focus_active",
  in_transit: "ships.focus_in_transit",
  attention: "ships.focus_attention",
  delivered: "ships.focus_delivered",
};

function matchesFocus(shipment: PortalShipmentView, focus: ShipmentFocus) {
  if (focus === "all") return true;
  if (focus === "active") return shipment.status !== "delivered";
  if (focus === "in_transit") return shipment.status === "in_transit";
  if (focus === "attention") return shipment.status === "exception";
  return shipment.status === "delivered";
}

export function PortalShipmentsWorkspace({ shipments, locale }: { shipments: PortalShipmentView[]; locale: PortalLocale }) {
  const t = portalTranslator(locale);
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
        eyebrow={t("overview.eyebrow")}
        title={t("ships.title")}
        description={t("ships.description")}
        meta={<span>{shipments.length === 1 ? t("overview.on_record_one") : t("overview.on_record", { count: shipments.length })}</span>}
      />
      <div className="ops-content">
        <OpsSurface flush>
          <OpsToolbar className="portal-toolbar">
            <OpsSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("ships.search_placeholder")}
              aria-label={t("ships.search_label")}
            />
            <div className="portal-filter-group" role="group" aria-label={t("ships.filter_label")}>
              {(Object.keys(focusKeys) as ShipmentFocus[]).map((value) => (
                <OpsFilterChip key={value} active={focus === value} onClick={() => setFocus(value)}>
                  {t(focusKeys[value])}
                </OpsFilterChip>
              ))}
            </div>
            {filtered ? (
              <OpsButton size="sm" variant="ghost" onClick={() => { setFocus("all"); setQuery(""); }}>{t("ships.reset")}</OpsButton>
            ) : null}
            <span className="portal-toolbar-count">{t("ships.shown", { count: rows.length })}</span>
          </OpsToolbar>

          {rows.length ? (
            <OpsTableWrap>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{t("overview.col_reference")}</th>
                    <th>{t("common.route")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("ships.col_carrier")}</th>
                    <th>{t("overview.col_eta")}</th>
                    <th>{t("overview.col_last_update")}</th>
                    <th><span className="portal-sr-only">{t("overview.open")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((shipment) => (
                    <tr key={shipment.reference}>
                      <td>
                        <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-link">
                          <OpsMono>{shipment.reference}</OpsMono>
                        </Link>
                        <span className="portal-cell-detail">{portalModeLabel(shipment.mode, locale)}</span>
                      </td>
                      <td>
                        <span className="portal-lane">{shipment.origin || t("overview.origin")}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || t("overview.destination")}</span>
                        {shipment.current_location ? <span className="portal-cell-detail">{t("overview.now_at", { location: shipment.current_location })}</span> : null}
                      </td>
                      <td><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status, locale)}</OpsBadge></td>
                      <td>
                        {shipment.carrier ?? t("common.none")}
                        {shipment.carrier_reference ? <span className="portal-cell-detail"><OpsMono>{shipment.carrier_reference}</OpsMono></span> : null}
                      </td>
                      <td>{portalDate(shipment.eta)}</td>
                      <td>{portalDateTime(shipment.updated_at)}</td>
                      <td>
                        <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-open" aria-label={t("overview.open_shipment", { reference: shipment.reference })}>
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
                title={filtered ? t("ships.empty_filtered_title") : t("ships.empty_title")}
                description={filtered
                  ? t("ships.empty_filtered_description")
                  : t("ships.empty_description")}
                action={filtered ? <OpsButton size="sm" variant="secondary" onClick={() => { setFocus("all"); setQuery(""); }}>{t("ships.reset_view")}</OpsButton> : undefined}
              />
            </div>
          )}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
