"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Send, Tag } from "lucide-react";
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
import type { PortalQuoteView } from "../portal-access-policy";
import type { PortalCapabilities } from "../portal-access-policy";
import { portalDate, portalMoney } from "../portal-format";
import { portalTranslator, type PortalLocale } from "../portal-i18n";

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
  locale,
}: {
  quotes: PortalQuoteView[];
  requests: PortalQuoteView[];
  capabilities: PortalCapabilities;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingBusy, setBookingBusy] = useState("");
  // The quote being accepted, and the pickup asked for with it.
  const [proceeding, setProceeding] = useState<PortalQuoteView | null>(null);
  const [pickup, setPickup] = useState({ collect: true, date: "", window: "any", address: "", contactName: "", contactPhone: "", note: "" });

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
        throw new Error(data.error || t("req.submit_failed"));
      }
      setForm(emptyForm);
      setNotice(t("req.submitted", { reference: data.reference ?? "" }));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("req.submit_failed"));
    } finally {
      setBusy(false);
    }
  }

  function startBooking(quote: PortalQuoteView) {
    setProceeding(quote);
    setPickup({ collect: true, date: "", window: "any", address: quote.origin, contactName: "", contactPhone: "", note: "" });
    setError("");
    setNotice("");
  }

  async function requestBooking(reference: string) {
    if (bookingBusy) return;
    const collect = proceeding?.reference === reference && pickup.collect;
    setBookingBusy(reference);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "booking",
          quoteReference: reference,
          note: pickup.note,
          // A request for the pickup desk; KCPL confirms the time.
          pickup: collect
            ? { date: pickup.date, window: pickup.window, address: pickup.address, contact_name: pickup.contactName, contact_phone: pickup.contactPhone }
            : null,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("req.booking_failed"));
      setNotice(t("req.booking_sent", { reference }));
      setProceeding(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("req.booking_failed"));
    } finally {
      setBookingBusy("");
    }
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={t("overview.eyebrow")}
        title={t("req.title")}
        description={t("req.description")}
        meta={<>
          <span>{quotes.length === 1 ? t("req.quote_count_one") : t("req.quote_count", { count: quotes.length })}</span>
          <span>{requests.length === 1 ? t("req.open_count_one") : t("req.open_count", { count: requests.length })}</span>
        </>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

          {capabilities.canSubmitRequests ? (
            <OpsSurface
              eyebrow={t("req.new_eyebrow")}
              title={t("req.new_title")}
              description={t("req.new_description")}
            >
              <form onSubmit={submitRequest} className="portal-form" aria-busy={busy}>
                <div className="portal-form-grid">
                  <OpsField label={t("overview.origin")} hint={fieldErrors.origin}>
                    <input required value={form.origin} onChange={(event) => update("origin", event.target.value)} placeholder={t("req.origin_placeholder")} disabled={busy}/>
                  </OpsField>
                  <OpsField label={t("overview.destination")} hint={fieldErrors.destination}>
                    <input required value={form.destination} onChange={(event) => update("destination", event.target.value)} placeholder={t("req.destination_placeholder")} disabled={busy}/>
                  </OpsField>
                  <OpsField label={t("ship.mode")}>
                    <select value={form.mode} onChange={(event) => update("mode", event.target.value)} disabled={busy}>
                      <option value="unsure">{t("req.mode_unsure")}</option>
                      <option value="sea">{t("mode.sea")}</option>
                      <option value="air">{t("mode.air")}</option>
                      <option value="road">{t("req.mode_road")}</option>
                    </select>
                  </OpsField>
                  <OpsField label={t("req.commodity")} hint={fieldErrors.cargoType}>
                    <input value={form.cargoType} onChange={(event) => update("cargoType", event.target.value)} placeholder={t("req.commodity_placeholder")} disabled={busy}/>
                  </OpsField>
                  <OpsField label={t("req.weight")} hint={fieldErrors.weight}>
                    <input value={form.weight} onChange={(event) => update("weight", event.target.value)} inputMode="decimal" placeholder={t("req.weight_placeholder")} disabled={busy}/>
                  </OpsField>
                  <OpsField label={t("req.weight_unit")}>
                    <select value={form.weightUnit} onChange={(event) => update("weightUnit", event.target.value)} disabled={busy}>
                      <option value="kg">{t("req.unit_kg")}</option>
                      <option value="tonnes">{t("req.unit_tonnes")}</option>
                      <option value="lb">{t("req.unit_lb")}</option>
                    </select>
                  </OpsField>
                  <OpsField label={t("req.ready_date")} hint={fieldErrors.timing}>
                    <input value={form.timing} onChange={(event) => update("timing", event.target.value)} placeholder={t("req.ready_placeholder")} disabled={busy}/>
                  </OpsField>
                </div>
                <OpsField label={t("req.anything_else")} hint={fieldErrors.requirements}>
                  <textarea
                    value={form.requirements}
                    onChange={(event) => update("requirements", event.target.value)}
                    placeholder={t("req.anything_else_placeholder")}
                    disabled={busy}
                  />
                </OpsField>
                <div className="portal-form-actions">
                  <OpsButton type="submit" variant="primary" disabled={busy}>
                    <Send size={15} strokeWidth={1.75} aria-hidden="true"/>
                    <span>{busy ? t("req.sending") : t("req.send")}</span>
                  </OpsButton>
                </div>
              </form>
            </OpsSurface>
          ) : null}

          <OpsSurface
            eyebrow={t("req.commercial_eyebrow")}
            title={t("req.quotes_title")}
            description={t("req.quotes_description")}
            flush
          >
            {quotes.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{t("req.col_quote")}</th>
                      <th>{t("common.route")}</th>
                      <th>{t("req.col_price")}</th>
                      <th>{t("req.col_valid")}</th>
                      <th>{t("common.shipment")}</th>
                      <th><span className="portal-sr-only">{t("req.col_action")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.reference}>
                        <td>
                          <OpsMono>{quote.reference}</OpsMono>
                          <span className="portal-cell-detail">{t("req.raised_on", { date: portalDate(quote.created_at) })}</span>
                        </td>
                        <td>
                          <span className="portal-lane">{quote.origin}<span className="portal-lane-arrow" aria-hidden="true">→</span>{quote.destination}</span>
                          {quote.cargo_type ? <span className="portal-cell-detail">{quote.cargo_type}</span> : null}
                        </td>
                        <td>
                          <strong>{quote.quoted_amount === null ? t("common.none") : portalMoney(quote.quoted_amount, quote.quote_currency)}</strong>
                          {quote.customer_quote_note ? <span className="portal-cell-detail">{quote.customer_quote_note}</span> : null}
                        </td>
                        <td>{portalDate(quote.valid_until)}</td>
                        <td>
                          {quote.shipment_reference ? (
                            <Link href={`/portal/shipments/${encodeURIComponent(quote.shipment_reference)}`} className="portal-row-link">
                              <OpsMono>{quote.shipment_reference}</OpsMono>
                            </Link>
                          ) : <OpsBadge tone="neutral">{t("req.not_booked")}</OpsBadge>}
                        </td>
                        <td>
                          {!quote.shipment_reference && capabilities.canSubmitRequests ? (
                            <OpsButton
                              size="sm"
                              variant="secondary"
                              disabled={bookingBusy === quote.reference}
                              onClick={() => startBooking(quote)}
                            >
                              {bookingBusy === quote.reference ? t("req.sending") : t("req.ask_to_proceed")}
                            </OpsButton>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : null}
            {proceeding ? (
              <form
                className="portal-pickup-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestBooking(proceeding.reference);
                }}
              >
                <h3>{t("pk.title")} · {proceeding.reference}</h3>
                <p>{t("pk.description")}</p>
                <label className="portal-pickup-check">
                  <input type="checkbox" checked={pickup.collect} onChange={(event) => setPickup({ ...pickup, collect: event.target.checked })}/>
                  {t("pk.collect")}
                </label>
                {pickup.collect ? (
                  <div className="portal-pickup-grid">
                    <OpsField label={t("pk.date")}>
                      <input type="date" required value={pickup.date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setPickup({ ...pickup, date: event.target.value })}/>
                    </OpsField>
                    <OpsField label={t("pk.window")}>
                      <select value={pickup.window} onChange={(event) => setPickup({ ...pickup, window: event.target.value })}>
                        <option value="morning">{t("pk.morning")}</option>
                        <option value="afternoon">{t("pk.afternoon")}</option>
                        <option value="any">{t("pk.any")}</option>
                      </select>
                    </OpsField>
                    <OpsField label={t("pk.address")} className="portal-pickup-wide">
                      <input required minLength={5} maxLength={300} value={pickup.address} onChange={(event) => setPickup({ ...pickup, address: event.target.value })}/>
                    </OpsField>
                    <OpsField label={t("pk.contact")}>
                      <input maxLength={120} value={pickup.contactName} onChange={(event) => setPickup({ ...pickup, contactName: event.target.value })}/>
                    </OpsField>
                    <OpsField label={t("pk.phone")}>
                      <input type="tel" maxLength={30} value={pickup.contactPhone} onChange={(event) => setPickup({ ...pickup, contactPhone: event.target.value })}/>
                    </OpsField>
                  </div>
                ) : null}
                <OpsField label={t("pk.note")}>
                  <input maxLength={2000} value={pickup.note} onChange={(event) => setPickup({ ...pickup, note: event.target.value })}/>
                </OpsField>
                <div className="portal-pickup-actions">
                  <OpsButton type="submit" variant="primary" disabled={Boolean(bookingBusy)}>
                    {bookingBusy ? t("req.sending") : t("pk.send")}
                  </OpsButton>
                  <OpsButton type="button" variant="ghost" onClick={() => setProceeding(null)}>{t("pk.cancel")}</OpsButton>
                </div>
              </form>
            ) : null}
            {quotes.length ? null : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind="neutral"
                  icon={<Tag size={18}/>}
                  title={t("req.no_quotes_title")}
                  description={t("req.no_quotes_description")}
                />
              </div>
            )}
          </OpsSurface>

          <OpsSurface
            eyebrow={t("req.progress_eyebrow")}
            title={t("req.progress_title")}
            description={t("req.progress_description")}
            flush
          >
            {requests.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{t("overview.col_reference")}</th>
                      <th>{t("common.route")}</th>
                      <th>{t("req.commodity")}</th>
                      <th>{t("req.col_raised")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.reference}>
                        <td><OpsMono>{request.reference}</OpsMono></td>
                        <td>
                          <span className="portal-lane">{request.origin}<span className="portal-lane-arrow" aria-hidden="true">→</span>{request.destination}</span>
                        </td>
                        <td>{request.cargo_type ?? t("common.none")}</td>
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
                  title={t("req.nothing_waiting_title")}
                  description={t("req.nothing_waiting_description")}
                />
              </div>
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
