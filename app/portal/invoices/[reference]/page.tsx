import Link from "next/link";
import { Printer, Receipt } from "lucide-react";
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

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice · KCPL Customer Portal", robots: { index: false, follow: false } };

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
            description={t("invd.issued_to", { customer: access.session.customerName, company: company.name })}
            meta={<>
              <span>{t("invd.issued_on", { date: portalDate(result.invoice.issue_date) })}</span>
              <span>{t("invd.due_on", { date: portalDate(result.invoice.due_date) })}</span>
            </>}
            actions={<>
              <OpsBadge tone={portalInvoiceTone(result.invoice.status)}>{portalInvoiceStatusLabel(result.invoice.status, locale)}</OpsBadge>
              <Link href="/portal/invoices" className="ops-button" data-variant="secondary" data-size="sm">{t("invd.all_invoices")}</Link>
            </>}
          />

          <div className="ops-content">
            <div className="ops-stack portal-stack">
              {/* The printable record. `portal-print-sheet` is what survives a
                  browser print, so a customer can file or forward a copy
                  without KCPL generating a PDF server-side. */}
              <section className="portal-print-sheet">
                <OpsSurface eyebrow={t("invd.statement")} title={t("invd.detail_title")}>
                  <OpsDetailGrid columns={4}>
                    <OpsDetailItem label={t("invd.eyebrow")}>
                      <OpsMono>{result.invoice.external_invoice_number ?? result.invoice.reference}</OpsMono>
                    </OpsDetailItem>
                    <OpsDetailItem label={t("inv.col_issued")}>{portalDate(result.invoice.issue_date)}</OpsDetailItem>
                    <OpsDetailItem label={t("inv.col_due")}>{portalDate(result.invoice.due_date)}</OpsDetailItem>
                    <OpsDetailItem label={t("common.shipment")}>
                      {result.invoice.shipment_reference ? (
                        <Link href={`/portal/shipments/${encodeURIComponent(result.invoice.shipment_reference)}`} className="portal-row-link">
                          <OpsMono>{result.invoice.shipment_reference}</OpsMono>
                        </Link>
                      ) : t("common.none")}
                    </OpsDetailItem>
                  </OpsDetailGrid>

                  {result.invoice.line_items.length ? (
                    <OpsTableWrap>
                      <table className="ops-table">
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
                              <td>{line.description}</td>
                              <td>{line.quantity}</td>
                              <td>{portalMoney(line.unit_price, result.invoice.currency)}</td>
                              <td>{portalMoney(line.total, result.invoice.currency)}</td>
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

                  <OpsDetailGrid columns={4}>
                    <OpsDetailItem label={t("invd.subtotal")}>{portalMoney(result.invoice.subtotal, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label={t("invd.tax")}>{portalMoney(result.invoice.tax_total, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label={t("inv.col_total")}>{portalMoney(result.invoice.total, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label={t("invd.receipted")}>{portalMoney(result.invoice.amount_paid, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label={t("invd.balance_due")} wide>
                      <strong>{portalMoney(result.invoice.balance_due, result.invoice.currency)}</strong>
                    </OpsDetailItem>
                  </OpsDetailGrid>

                  <p className="portal-footnote portal-print-note">
                    <Printer size={14} aria-hidden="true"/> {t("invd.print_note")}
                  </p>
                </OpsSurface>
              </section>

              <PortalRemittancePanel
                locale={locale}
                reference={result.invoice.reference}
                initialRemittances={remittances.kind === "ready" ? remittances.remittances : []}
                currency={result.invoice.currency}
              />
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
        <PortalWorkspaceUnavailable eyebrow={t("invd.eyebrow")} title={t("invd.eyebrow")} icon={<Receipt size={18}/>} locale={locale}/>
      ) : null}
    </PortalShell>
  );
}
