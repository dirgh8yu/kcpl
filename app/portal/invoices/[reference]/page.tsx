import Link from "next/link";
import { Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsDetailGrid,
  OpsDetailItem,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
  OpsTableWrap,
} from "../../../admin/operations-ui";
import { company } from "../../../company-data";
import { getPortalAccess } from "../../portal-auth";
import { getPortalInvoice } from "../../portal-data.server";
import { listInvoiceRemittances } from "../../portal-remittance.server";
import { PortalLoginPage } from "../../portal-login-page";
import { PortalShell } from "../../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../../portal-frame";
import { portalDate, portalInvoiceStatusLabel, portalInvoiceTone, portalMoney } from "../../portal-format";
import { PortalRemittancePanel } from "./portal-remittance-panel";
import { portalTranslator } from "../../portal-i18n";
import { recordTitle } from "../../../record-title";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  const name = recordTitle((await params).reference);
  return { title: name, robots: { index: false, follow: false } };
}

export default async function PortalInvoicePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const t = portalTranslator(access.session.locale);
  const locale = access.session.locale;
  const { reference } = await params;
  const result = await getPortalInvoice(access.session, decodeURIComponent(reference));
  const remittances = result.kind === "ready"
    ? await listInvoiceRemittances(result.invoice.reference)
    : { kind: "unavailable" as const };

  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready" ? (
        <OpsPage>
          <OpsPageHeader
            eyebrow={t("invd.eyebrow")}
            title={<OpsMono>{result.invoice.external_invoice_number ?? result.invoice.reference}</OpsMono>}
            // Who issued it to whom is for the printed copy; on screen the
            // reader is the customer, who knows.
            description={<span className="portal-print-only">{t("invd.issued_to", { customer: access.session.customerName, company: company.name })}</span>}
            meta={<>
              <span>{t("invd.issued_on", { date: portalDate(result.invoice.issue_date) })}</span>
              <span>{t("invd.due_on", { date: portalDate(result.invoice.due_date) })}</span>
              {result.invoice.shipment_reference ? (
                <Link href={`/portal/shipments/${encodeURIComponent(result.invoice.shipment_reference)}`} className="portal-row-link">
                  <OpsMono>{result.invoice.shipment_reference}</OpsMono>
                </Link>
              ) : null}
            </>}
            // The way back to the list is the Invoices tab, lit above.
            actions={<OpsBadge tone={portalInvoiceTone(result.invoice.status)}>{portalInvoiceStatusLabel(result.invoice.status, locale)}</OpsBadge>}
          />

          <div className="ops-content">
            <div className="ops-stack portal-stack">
              {/* The printable record. `portal-print-sheet` is what survives a
                  browser print, so a customer can file or forward a copy
                  without KCPL generating a PDF server-side. */}
              <section className="portal-print-sheet">
                {/* The number, dates and shipment are the header's; this is
                    the charges and what they add up to. */}
                <OpsSurface>
                  {result.invoice.line_items.length ? (
                    <OpsTableWrap>
                      <table className="ops-table ops-register-table portal-stack-table">
                        <thead>
                          <tr>
                            <th>{t("invd.col_charge")}</th>
                            <th>{t("invd.col_quantity")}</th>
                            <th>{t("invd.col_unit_price")}</th>
                            <th>{t("invd.col_amount")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.invoice.line_items.map((line) => (
                            <tr key={line.id}>
                              <td data-cell="primary">{line.description}</td>
                              <td data-cell="meta" data-label={t("invd.col_quantity")}>{line.quantity}</td>
                              <td data-cell="meta" data-label={t("invd.col_unit_price")}>{portalMoney(line.unit_price, result.invoice.currency)}</td>
                              <td data-cell="amount">{portalMoney(line.total, result.invoice.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </OpsTableWrap>
                  ) : (
                    <OpsEmptyState
                      compact
                      kind="neutral"
                      icon={<Receipt size={18}/>}
                      title={t("invd.no_lines_title")}
                      description={t("invd.no_lines_description")}
                    />
                  )}

                  {/* Each sum once: a subtotal only beside the tax that makes
                      it differ from the total, and a balance only once
                      something has been receipted against it. */}
                  <OpsDetailGrid columns={4}>
                    {result.invoice.tax_total ? <>
                      <OpsDetailItem label={t("invd.subtotal")}>{portalMoney(result.invoice.subtotal, result.invoice.currency)}</OpsDetailItem>
                      <OpsDetailItem label={t("invd.tax")}>{portalMoney(result.invoice.tax_total, result.invoice.currency)}</OpsDetailItem>
                    </> : null}
                    <OpsDetailItem label={t("inv.col_total")}>
                      {result.invoice.amount_paid ? portalMoney(result.invoice.total, result.invoice.currency) : <strong>{portalMoney(result.invoice.total, result.invoice.currency)}</strong>}
                    </OpsDetailItem>
                    {result.invoice.amount_paid ? <>
                      <OpsDetailItem label={t("invd.receipted")}>{portalMoney(result.invoice.amount_paid, result.invoice.currency)}</OpsDetailItem>
                      <OpsDetailItem label={t("invd.balance_due")}>
                        <strong>{portalMoney(result.invoice.balance_due, result.invoice.currency)}</strong>
                      </OpsDetailItem>
                    </> : null}
                  </OpsDetailGrid>
                </OpsSurface>
              </section>

              {/* A settled invoice has nothing to report a payment against,
                  unless receipts were already sent for it. */}
              {result.invoice.balance_due > 0 || (remittances.kind === "ready" && remittances.remittances.length) ? (
                <PortalRemittancePanel
                  locale={locale}
                  reference={result.invoice.reference}
                  initialRemittances={remittances.kind === "ready" ? remittances.remittances : []}
                  currency={result.invoice.currency}
                />
              ) : null}
            </div>
          </div>
        </OpsPage>
      ) : null}

      {result.kind === "missing" ? (
        <OpsPage>
          <OpsPageHeader eyebrow={t("invd.eyebrow")} title={t("invd.not_found_title")}/>
          <div className="ops-content">
            <OpsEmptyState
              kind="search"
              icon={<Receipt size={18}/>}
              title={t("invd.not_found_heading")}
              description={t("invd.not_found_description")}
              action={<Link href="/portal/invoices" className="ops-button" data-variant="primary" data-size="sm">{t("invd.all_invoices")}</Link>}
            />
          </div>
        </OpsPage>
      ) : null}

      {result.kind === "forbidden" ? (
        <OpsPage>
          <OpsPageHeader eyebrow={t("invd.eyebrow")} title={t("inv.title")}/>
          <div className="ops-content">
            <OpsEmptyState
              kind="unavailable"
              icon={<Receipt size={18}/>}
              title={t("invd.no_access_title")}
              description={t("invd.no_access_description")}
            />
          </div>
        </OpsPage>
      ) : null}

      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable title={t("invd.eyebrow")} icon={<Receipt size={18}/>} locale={locale}/>
      ) : null}
    </PortalShell>
  );
}
