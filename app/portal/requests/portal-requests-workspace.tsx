"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ClipboardCheck, Package, Send, Tag } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
  OpsTableWrap,
} from "../../admin/operations-ui";
import { PortalKpiStrip } from "../portal-kpi";
import type { PortalQuoteView } from "../portal-access-policy";
import type { PortalCapabilities } from "../portal-access-policy";
import { portalDate, portalMoney } from "../portal-format";

type FormState = {
  origin: string;
  destination: string;
  mode: string;
  cargoType: string;
  weight: string;
  weightUnit: string;
  timing: string;
  requirements: string;
};

const emptyForm: FormState = {
  origin: "",
  destination: "",
  mode: "unsure",
  cargoType: "",
  weight: "",
  weightUnit: "kg",
  timing: "",
  requirements: "",
};

export function PortalRequestsWorkspace({
  quotes,
  requests,
  capabilities,
}: {
  quotes: PortalQuoteView[];
  requests: PortalQuoteView[];
  capabilities: PortalCapabilities;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingBusy, setBookingBusy] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "enquiry", ...form }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; reference?: string; fields?: Record<string, string> };
      if (!response.ok || !data.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error || "The request could not be submitted.");
      }
      setForm(emptyForm);
      setNotice(`Request ${data.reference} has been sent to the KCPL team.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function requestBooking(reference: string) {
    if (bookingBusy) return;
    setBookingBusy(reference);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "booking", quoteReference: reference }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The booking request could not be sent.");
      setNotice(`KCPL has been notified that you want to proceed with ${reference}.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The booking request could not be sent.");
    } finally {
      setBookingBusy("");
    }
  }

  const awaitingDecision = quotes.filter((quote) => !quote.shipment_reference).length;
  const booked = quotes.length - awaitingDecision;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Quotes & requests"
        description="Raise a new freight request, follow the ones KCPL is still working on, and review the quotes you have been issued."
        meta={<>
          <span>{quotes.length} quote{quotes.length === 1 ? "" : "s"}</span>
          <span>{requests.length} open request{requests.length === 1 ? "" : "s"}</span>
        </>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

          <PortalKpiStrip
            items={[
              { key: "quotes", icon: Tag, label: "Quotes issued", value: quotes.length, tone: "accent" },
              {
                key: "awaiting",
                icon: ClipboardCheck,
                label: "Ready to book",
                value: awaitingDecision,
                tone: awaitingDecision > 0 ? "warning" : "success",
                detail: awaitingDecision > 0 ? "Ask KCPL to proceed" : "No quotes waiting on you",
              },
              { key: "booked", icon: Package, label: "Booked from a quote", value: booked, tone: "success" },
              {
                key: "requests",
                icon: Send,
                label: "With KCPL to price",
                value: requests.length,
                tone: requests.length > 0 ? "info" : "success",
                detail: requests.length > 0 ? "Being worked on now" : "Every request has been priced",
              },
            ]}
          />

          {capabilities.canSubmitRequests ? (
            <OpsSurface
              eyebrow="New request"
              title="Ask KCPL to quote a movement"
              description="Share what you know. KCPL confirms routing, the customs point and the price before anything is booked."
            >
              <form onSubmit={submitRequest} className="portal-form" aria-busy={busy}>
                <div className="portal-form-grid">
                  <OpsField label="Origin" hint={fieldErrors.origin}>
                    <input required value={form.origin} onChange={(event) => update("origin", event.target.value)} placeholder="Shanghai, China" disabled={busy}/>
                  </OpsField>
                  <OpsField label="Destination" hint={fieldErrors.destination}>
                    <input required value={form.destination} onChange={(event) => update("destination", event.target.value)} placeholder="Kathmandu, Nepal" disabled={busy}/>
                  </OpsField>
                  <OpsField label="Mode">
                    <select value={form.mode} onChange={(event) => update("mode", event.target.value)} disabled={busy}>
                      <option value="unsure">Not sure yet</option>
                      <option value="sea">Sea freight</option>
                      <option value="air">Air freight</option>
                      <option value="road">Road / cross-border</option>
                    </select>
                  </OpsField>
                  <OpsField label="Commodity" hint={fieldErrors.cargoType}>
                    <input value={form.cargoType} onChange={(event) => update("cargoType", event.target.value)} placeholder="Machinery parts" disabled={busy}/>
                  </OpsField>
                  <OpsField label="Weight" hint={fieldErrors.weight}>
                    <input value={form.weight} onChange={(event) => update("weight", event.target.value)} inputMode="decimal" placeholder="1200" disabled={busy}/>
                  </OpsField>
                  <OpsField label="Weight unit">
                    <select value={form.weightUnit} onChange={(event) => update("weightUnit", event.target.value)} disabled={busy}>
                      <option value="kg">Kilograms</option>
                      <option value="tonnes">Tonnes</option>
                      <option value="lb">Pounds</option>
                    </select>
                  </OpsField>
                  <OpsField label="Cargo ready date" hint={fieldErrors.timing}>
                    <input value={form.timing} onChange={(event) => update("timing", event.target.value)} placeholder="Ready in two weeks" disabled={busy}/>
                  </OpsField>
                </div>
                <OpsField label="Anything else KCPL should know" hint={fieldErrors.requirements}>
                  <textarea
                    value={form.requirements}
                    onChange={(event) => update("requirements", event.target.value)}
                    placeholder="Dimensions, packing, delivery site access, deadlines, permits…"
                    disabled={busy}
                  />
                </OpsField>
                <div className="portal-form-actions">
                  <OpsButton type="submit" variant="primary" disabled={busy}>
                    <Send size={15} strokeWidth={1.75} aria-hidden="true"/>
                    <span>{busy ? "Sending…" : "Send request"}</span>
                  </OpsButton>
                </div>
              </form>
            </OpsSurface>
          ) : null}

          <OpsSurface
            eyebrow="Commercial"
            title="Quotes issued to you"
            description="Prices KCPL has confirmed. Ask to proceed and your account manager will convert the quote into a booking."
            flush
          >
            {quotes.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Route</th>
                      <th>Price</th>
                      <th>Valid until</th>
                      <th>Shipment</th>
                      <th><span className="portal-sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.reference}>
                        <td>
                          <OpsMono>{quote.reference}</OpsMono>
                          <span className="portal-cell-detail">Raised {portalDate(quote.created_at)}</span>
                        </td>
                        <td>
                          <span className="portal-lane">{quote.origin}<span className="portal-lane-arrow" aria-hidden="true">→</span>{quote.destination}</span>
                          {quote.cargo_type ? <span className="portal-cell-detail">{quote.cargo_type}</span> : null}
                        </td>
                        <td>
                          <strong>{quote.quoted_amount === null ? "—" : portalMoney(quote.quoted_amount, quote.quote_currency)}</strong>
                          {quote.customer_quote_note ? <span className="portal-cell-detail">{quote.customer_quote_note}</span> : null}
                        </td>
                        <td>{portalDate(quote.valid_until)}</td>
                        <td>
                          {quote.shipment_reference ? (
                            <Link href={`/portal/shipments/${encodeURIComponent(quote.shipment_reference)}`} className="portal-row-link">
                              <OpsMono>{quote.shipment_reference}</OpsMono>
                            </Link>
                          ) : <OpsBadge tone="neutral">Not booked</OpsBadge>}
                        </td>
                        <td>
                          {!quote.shipment_reference && capabilities.canSubmitRequests ? (
                            <OpsButton
                              size="sm"
                              variant="secondary"
                              disabled={bookingBusy === quote.reference}
                              onClick={() => requestBooking(quote.reference)}
                            >
                              {bookingBusy === quote.reference ? "Sending…" : "Ask to proceed"}
                            </OpsButton>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind="neutral"
                  icon={<Tag size={18}/>}
                  title="No quotes yet"
                  description="Quotes KCPL issues to your account appear here with their price and validity."
                />
              </div>
            )}
          </OpsSurface>

          <OpsSurface
            eyebrow="In progress"
            title="Requests KCPL is working on"
            description="Requests that have not been priced yet."
            flush
          >
            {requests.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Route</th>
                      <th>Commodity</th>
                      <th>Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.reference}>
                        <td><OpsMono>{request.reference}</OpsMono></td>
                        <td>
                          <span className="portal-lane">{request.origin}<span className="portal-lane-arrow" aria-hidden="true">→</span>{request.destination}</span>
                        </td>
                        <td>{request.cargo_type ?? "—"}</td>
                        <td>{portalDate(request.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  compact
                  kind="healthy"
                  icon={<Send size={18}/>}
                  title="Nothing waiting"
                  description="Every request you have raised has been priced."
                />
              </div>
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
