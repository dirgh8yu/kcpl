import Link from "next/link";
import { Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
  OpsMetric,
  OpsMetricStrip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
  OpsTableWrap,
} from "../../admin/operations-ui";
import type { PortalInvoiceView } from "../portal-access-policy";
import type { PortalFinanceSummary } from "../portal-data.server";
import { portalDate, portalInvoiceStatusLabel, portalInvoiceTone, portalMoney } from "../portal-format";
import { portalTranslator, type PortalLocale } from "../portal-i18n";

export function PortalInvoicesWorkspace({
  invoices,
  summary,
  locale,
}: {
  invoices: PortalInvoiceView[];
  summary: PortalFinanceSummary;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={t("overview.eyebrow")}
        title={t("inv.title")}
        description={t("inv.description")}
        meta={<>
          <span>{invoices.length === 1 ? t("inv.count_one") : t("inv.count", { count: invoices.length })}</span>
          <span>{t("inv.open_overdue", { open: summary.openInvoices, overdue: summary.overdueInvoices })}</span>
        </>}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {summary.balances.length ? (
            <OpsSurface
              eyebrow={t("inv.position_eyebrow")}
              title={t("inv.position_title")}
              description={t("inv.position_description")}
              priority={summary.overdueInvoices > 0 ? "warning" : "normal"}
            >
              <OpsMetricStrip columns={Math.min(4, Math.max(1, summary.balances.length))}>
                {summary.balances.map((balance) => (
                  <OpsMetric
                    key={balance.currency}
                    icon={<Receipt size={14} strokeWidth={1.75}/>}
                    label={t("overview.currency_outstanding", { currency: balance.currency })}
                    value={portalMoney(balance.outstanding, balance.currency)}
                    detail={t("inv.invoiced_receipted", { invoiced: portalMoney(balance.invoiced, balance.currency), paid: portalMoney(balance.paid, balance.currency) })}
                  />
                ))}
              </OpsMetricStrip>
            </OpsSurface>
          ) : null}

          <OpsSurface eyebrow={t("inv.billing_eyebrow")} title={t("inv.billing_title")} flush>
            {invoices.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{t("inv.col_invoice")}</th>
                      <th>{t("common.shipment")}</th>
                      <th>{t("inv.col_issued")}</th>
                      <th>{t("inv.col_due")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("inv.col_total")}</th>
                      <th>{t("inv.col_paid")}</th>
                      <th>{t("inv.col_balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.reference}>
                        <td>
                          <Link href={`/portal/invoices/${encodeURIComponent(invoice.reference)}`} className="portal-row-link">
                            <OpsMono>{invoice.external_invoice_number ?? invoice.reference}</OpsMono>
                          </Link>
                          {invoice.record_type === "opening_balance"
                            ? <span className="portal-cell-detail">{t("inv.opening_balance")}</span>
                            : null}
                        </td>
                        <td>
                          {invoice.shipment_reference ? (
                            <Link href={`/portal/shipments/${encodeURIComponent(invoice.shipment_reference)}`} className="portal-row-link">
                              <OpsMono>{invoice.shipment_reference}</OpsMono>
                            </Link>
                          ) : t("common.none")}
                        </td>
                        <td>{portalDate(invoice.issue_date)}</td>
                        <td>{portalDate(invoice.due_date)}</td>
                        <td><OpsBadge tone={portalInvoiceTone(invoice.status)}>{portalInvoiceStatusLabel(invoice.status, locale)}</OpsBadge></td>
                        <td>{portalMoney(invoice.total, invoice.currency)}</td>
                        <td>{portalMoney(invoice.amount_paid, invoice.currency)}</td>
                        <td><strong>{portalMoney(invoice.balance_due, invoice.currency)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind="healthy"
                  icon={<Receipt size={18}/>}
                  title={t("inv.empty_title")}
                  description={t("inv.empty_description")}
                />
              </div>
            )}
          </OpsSurface>

          <p className="portal-footnote">{t("inv.footnote")}</p>
        </div>
      </div>
    </OpsPage>
  );
}
