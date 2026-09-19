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

export function PortalInvoicesWorkspace({
  invoices,
  summary,
}: {
  invoices: PortalInvoiceView[];
  summary: PortalFinanceSummary;
}) {
  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Invoices"
        description="Your issued invoices with KCPL, what has been receipted against them and what remains outstanding."
        meta={<>
          <span>{invoices.length} invoice{invoices.length === 1 ? "" : "s"}</span>
          <span>{summary.openInvoices} open · {summary.overdueInvoices} overdue</span>
        </>}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {summary.balances.length ? (
            <OpsSurface
              eyebrow="Account position"
              title="Balances"
              description="Totals are grouped by the currency each invoice was issued in; KCPL does not convert between them here."
              priority={summary.overdueInvoices > 0 ? "warning" : "normal"}
            >
              <OpsMetricStrip columns={Math.min(4, Math.max(1, summary.balances.length))}>
                {summary.balances.map((balance) => (
                  <OpsMetric
                    key={balance.currency}
                    icon={<Receipt size={14} strokeWidth={1.75}/>}
                    label={`${balance.currency} outstanding`}
                    value={portalMoney(balance.outstanding, balance.currency)}
                    detail={`${portalMoney(balance.invoiced, balance.currency)} invoiced · ${portalMoney(balance.paid, balance.currency)} receipted`}
                  />
                ))}
              </OpsMetricStrip>
            </OpsSurface>
          ) : null}

          <OpsSurface eyebrow="Billing" title="Issued invoices" flush>
            {invoices.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Shipment</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.reference}>
                        <td>
                          <OpsMono>{invoice.external_invoice_number ?? invoice.reference}</OpsMono>
                          {invoice.record_type === "opening_balance"
                            ? <span className="portal-cell-detail">Opening balance</span>
                            : null}
                        </td>
                        <td>
                          {invoice.shipment_reference ? (
                            <Link href={`/portal/shipments/${encodeURIComponent(invoice.shipment_reference)}`} className="portal-row-link">
                              <OpsMono>{invoice.shipment_reference}</OpsMono>
                            </Link>
                          ) : "—"}
                        </td>
                        <td>{portalDate(invoice.issue_date)}</td>
                        <td>{portalDate(invoice.due_date)}</td>
                        <td><OpsBadge tone={portalInvoiceTone(invoice.status)}>{portalInvoiceStatusLabel(invoice.status)}</OpsBadge></td>
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
                  title="No invoices issued"
                  description="Invoices appear here once KCPL issues them against your account."
                />
              </div>
            )}
          </OpsSurface>

          <p className="portal-footnote">
            Payment references, bank details and credit terms are confirmed by KCPL accounts. Contact your account manager
            if an invoice needs to be reissued or a payment is not yet reflected here.
          </p>
        </div>
      </div>
    </OpsPage>
  );
}
