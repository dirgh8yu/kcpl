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

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalInvoicePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const { reference } = await params;
  const result = await getPortalInvoice(access.session, decodeURIComponent(reference));
  const remittances = result.kind === "ready"
    ? await listInvoiceRemittances(result.invoice.reference)
    : { kind: "unavailable" as const };

  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready" ? (
        <OpsPage>
          <OpsPageHeader
            eyebrow="Invoice"
            title={<OpsMono>{result.invoice.external_invoice_number ?? result.invoice.reference}</OpsMono>}
            description={`Issued to ${access.session.customerName} by ${company.name}`}
            meta={<>
              <span>Issued {portalDate(result.invoice.issue_date)}</span>
              <span>Due {portalDate(result.invoice.due_date)}</span>
            </>}
            actions={<>
              <OpsBadge tone={portalInvoiceTone(result.invoice.status)}>{portalInvoiceStatusLabel(result.invoice.status)}</OpsBadge>
              <Link href="/portal/invoices" className="ops-button" data-variant="secondary" data-size="sm">All invoices</Link>
            </>}
          />

          <div className="ops-content">
            <div className="ops-stack portal-stack">
              {/* The printable record. `portal-print-sheet` is what survives a
                  browser print, so a customer can file or forward a copy
                  without KCPL generating a PDF server-side. */}
              <section className="portal-print-sheet">
                <OpsSurface eyebrow="Statement" title="Invoice detail">
                  <OpsDetailGrid columns={4}>
                    <OpsDetailItem label="Invoice">
                      <OpsMono>{result.invoice.external_invoice_number ?? result.invoice.reference}</OpsMono>
                    </OpsDetailItem>
                    <OpsDetailItem label="Issued">{portalDate(result.invoice.issue_date)}</OpsDetailItem>
                    <OpsDetailItem label="Due">{portalDate(result.invoice.due_date)}</OpsDetailItem>
                    <OpsDetailItem label="Shipment">
                      {result.invoice.shipment_reference ? (
                        <Link href={`/portal/shipments/${encodeURIComponent(result.invoice.shipment_reference)}`} className="portal-row-link">
                          <OpsMono>{result.invoice.shipment_reference}</OpsMono>
                        </Link>
                      ) : "—"}
                    </OpsDetailItem>
                  </OpsDetailGrid>

                  {result.invoice.line_items.length ? (
                    <OpsTableWrap>
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>Charge</th>
                            <th>Quantity</th>
                            <th>Unit price</th>
                            <th>Amount</th>
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
                      title="No itemised charges"
                      description="This invoice carries a total without a line breakdown."
                    />
                  )}

                  <OpsDetailGrid columns={4}>
                    <OpsDetailItem label="Subtotal">{portalMoney(result.invoice.subtotal, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label="Tax">{portalMoney(result.invoice.tax_total, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label="Total">{portalMoney(result.invoice.total, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label="Receipted">{portalMoney(result.invoice.amount_paid, result.invoice.currency)}</OpsDetailItem>
                    <OpsDetailItem label="Balance due" wide>
                      <strong>{portalMoney(result.invoice.balance_due, result.invoice.currency)}</strong>
                    </OpsDetailItem>
                  </OpsDetailGrid>

                  <p className="portal-footnote portal-print-note">
                    <Printer size={14} aria-hidden="true"/> Use the print option in your browser to save or print this page.
                    Payment references and bank details are confirmed by KCPL accounts.
                  </p>
                </OpsSurface>
              </section>

              <PortalRemittancePanel
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
          <OpsPageHeader eyebrow="Invoice" title="Invoice not found"/>
          <div className="ops-content">
            <OpsEmptyState
              kind="search"
              icon={<Receipt size={18}/>}
              title="That invoice is not on your account"
              description="Open it from your invoice list instead."
              action={<Link href="/portal/invoices" className="ops-button" data-variant="primary" data-size="sm">All invoices</Link>}
            />
          </div>
        </OpsPage>
      ) : null}

      {result.kind === "forbidden" ? (
        <OpsPage>
          <OpsPageHeader eyebrow="Invoice" title="Invoices"/>
          <div className="ops-content">
            <OpsEmptyState
              kind="unavailable"
              icon={<Receipt size={18}/>}
              title="Account billing is not shared with this login"
              description="Ask your account owner or KCPL account manager if you also need invoice access."
            />
          </div>
        </OpsPage>
      ) : null}

      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable eyebrow="Invoice" title="Invoice" icon={<Receipt size={18}/>}/>
      ) : null}
    </PortalShell>
  );
}
