import Link from "next/link";
import { Package } from "lucide-react";
import { shipmentStatusLabels } from "../../../shipment-types";
import { shipmentStatusTone } from "../../../shipment-status-tone";
import { OpsBadge, OpsEmptyState, OpsMono, OpsSurface, OpsTableWrap } from "../../operations-ui";
import type { CrmOperationsHistory } from "../crm-operations-history.server";

const quoteStatusLabels: Record<string, string> = {
  new: "New",
  reviewing: "Pending",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const quoteStatusTones: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  new: "neutral",
  reviewing: "warning",
  quoted: "info",
  won: "success",
  lost: "danger",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: string | null, currency: string) {
  if (!value) return "Not priced";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-AU")}`;
  }
}

function route(origin: string, destination: string) {
  return `${origin || "Origin"} → ${destination || "Destination"}`;
}

/** The customer's shipments and quotes as two short registers; each reference
 *  opens its own record (the Job File, or the enquiry). */
export function CrmOperationsHistoryPanel({ history, showCommercial }: { history: CrmOperationsHistory; showCommercial: boolean }) {
  const { quotes, shipments } = history;
  return (
    <OpsSurface
      title="Quotes and shipments"
      flush
    >
      {!quotes.length && !shipments.length ? (
        <OpsEmptyState compact icon={<Package size={18}/>} title="No quotes or shipments yet" description="Confirm an enquiry match below and it will appear here."/>
      ) : (
        <div className="crm360-history">
          {shipments.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table ops-stack-table" data-row-link="">
                <thead><tr><th>Shipment</th><th>Route</th><th>Status</th><th>ETA</th><th>Now at</th></tr></thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.reference}>
                      <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(shipment.reference)}`}><OpsMono>{shipment.reference}</OpsMono></Link></td>
                      <td data-cell="route">{route(shipment.origin, shipment.destination)}</td>
                      <td data-cell="status"><OpsBadge tone={shipmentStatusTone(shipment.status)} dot>{shipmentStatusLabels[shipment.status]}</OpsBadge></td>
                      <td data-cell="meta" data-label="ETA">{formatDate(shipment.eta)}</td>
                      <td data-cell="meta" data-label="Now at">{shipment.current_location || "Not updated"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : null}
          {quotes.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table ops-stack-table" data-row-link="">
                <thead><tr><th>Quote</th><th>Route</th><th>Status</th>{showCommercial ? <th>Value</th> : null}<th>Updated</th></tr></thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.reference}>
                      <td data-cell="primary"><Link href={`/admin/enquiries?enquiry=${encodeURIComponent(quote.reference)}`}><OpsMono>{quote.reference}</OpsMono></Link></td>
                      <td data-cell="route">{route(quote.origin, quote.destination)}</td>
                      <td data-cell="status"><OpsBadge tone={quoteStatusTones[quote.status] ?? "neutral"} dot>{quoteStatusLabels[quote.status] ?? quote.status}</OpsBadge></td>
                      {showCommercial ? <td data-cell="amount" data-label="Value">{formatMoney(quote.quoted_amount, quote.currency)}</td> : null}
                      <td data-cell="meta" data-label="Updated">{formatDate(quote.updated_at || quote.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : null}
        </div>
      )}
    </OpsSurface>
  );
}
