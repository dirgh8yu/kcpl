import "../organisation-premium.css";
import { Megaphone } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { OpsBadge, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../operations-ui";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { loadAttributionReport } from "./attribution.server";
import { quoteAttributionLabel } from "../../quote-attribution";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead sources", robots: { index: false, follow: false } };

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function percent(part: number, total: number) {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function AttributionPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <V4WorkspaceGate eyebrow="Management" title="Sign in to KCPL Operations" detail="Lead-source performance is restricted to authorised KCPL management." actions={[{ href: "/admin", label: "Operations", primary: true }]}/>;

  let shell;
  try {
    const staff = await getStaffContext(access.user);
    shell = {
      staff,
      props: {
        userName: access.user.displayName,
        canManageStaff: staff.permissions.canManageStaff,
        canManageFinance: staff.permissions.canManageFinance,
        canViewCommercial: staff.permissions.canViewCommercial,
        canManageJobFile: staff.permissions.canManageJobFile,
        isManagement: staff.permissions.role === "management",
      },
    };
  } catch {
    const permissions = staffCapabilitiesForEmail(access.user.email);
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><V4WorkspaceGate embedded eyebrow="Management" title="Lead sources didn’t load" detail="The staff profile could not be resolved. Try again in a minute."/></OperationsShell>;
  }

  if (shell.staff.permissions.role !== "management") {
    return <OperationsShell {...shell.props}><V4WorkspaceGate embedded eyebrow="Management" title="Management access required" detail="Lead-source performance is restricted to the Management role."/></OperationsShell>;
  }

  const report = await loadAttributionReport();
  if (!report) {
    return <OperationsShell {...shell.props}><V4WorkspaceGate embedded eyebrow="Management" title="Lead sources are unavailable" detail="The quote records could not be read. Try again in a minute."/></OperationsShell>;
  }

  const valued = Object.entries(report.valued);
  const invoiced = Object.entries(report.invoiced);
  const collected = Object.entries(report.collected);
  return <OperationsShell {...shell.props}>
    <OpsPage>
      <OpsPageHeader
        eyebrow="Acquisition"
        title="Lead sources"
        description="Where enquiries come from, and what those enquiries were later quoted and won."
        meta={<span>Last 2,000 quotes</span>}
      />
      <div className="ops-content">
        <OpsMetricStrip columns={4}>
          <OpsMetric label="Enquiries" value={report.total.toLocaleString("en-AU")}/>
          <OpsMetric label="Priced" value={report.quoted.toLocaleString("en-AU")} detail={percent(report.quoted, report.total) + " of enquiries"}/>
          <OpsMetric label="Won" value={report.won.toLocaleString("en-AU")} detail={percent(report.won, report.quoted) + " of priced"}/>
          <OpsMetric label="Unattributed" value={report.unattributed.toLocaleString("en-AU")} detail="Older or direct records"/>
        </OpsMetricStrip>
        {valued.length ? <div className="ops-metric-strip" data-columns="auto">
          {valued.map(([currency, amount]) => <OpsMetric key={currency} label={`Quoted ${currency}`} value={money(amount, currency)}/>)}
        </div> : null}
        {invoiced.length || collected.length ? <div className="ops-metric-strip" data-columns="auto">
          {invoiced.map(([currency, amount]) => <OpsMetric key={`inv-${currency}`} label={`Invoiced ${currency}`} value={money(amount, currency)} detail="Issued, net of credit notes"/>)}
          {collected.map(([currency, amount]) => <OpsMetric key={`col-${currency}`} label={`Collected ${currency}`} value={money(amount, currency)} detail="Cash applied to those invoices"/>)}
        </div> : null}
        <OpsSurface title="By source" description="A quote is attributed once, from the landing context captured with the enquiry." flush>
          {report.rows.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
            <thead><tr><th>Source</th><th>Tool</th><th>Enquiries</th><th>Priced</th><th>Won</th><th>Lost</th><th>Quoted value</th><th>Realized</th></tr></thead>
            <tbody>{report.rows.map((row) => <tr key={row.key}>
              <td data-cell="primary"><strong>{quoteAttributionLabel(row)}</strong><span className="ops-cell-secondary">{row.source}{row.medium ? ` · ${row.medium}` : ""}</span></td>
              <td data-cell="meta" data-label="Tool">{row.tool ? <OpsBadge tone="info">{row.tool}</OpsBadge> : <span className="ops-cell-secondary">—</span>}</td>
              <td data-cell="meta" data-label="Enquiries">{row.enquiries}</td>
              <td data-cell="meta" data-label="Priced">{row.quoted}</td>
              <td data-cell="meta" data-label="Won"><strong>{row.won}</strong></td>
              <td data-cell="meta" data-label="Lost">{row.lost}</td>
              <td data-cell="amount">{Object.keys(row.values).length ? Object.entries(row.values).map(([currency, amount]) => <span key={currency}>{money(amount, currency)}</span>) : "—"}</td>
              <td data-cell="amount">{Object.keys(row.invoiced).length || Object.keys(row.collected).length ? <>
                {Object.entries(row.invoiced).map(([currency, amount]) => <span key={`i-${currency}`}>Invoiced {money(amount, currency)}</span>)}
                {Object.entries(row.collected).map(([currency, amount]) => <span key={`c-${currency}`}>Collected {money(amount, currency)}</span>)}
              </> : "—"}</td>
            </tr>)}</tbody>
          </table></OpsTableWrap> : <OpsEmptyState icon={<Megaphone size={18}/>} title="No quote attribution yet" description="New public enquiries will record the tool, campaign and landing source that brought them in."/>}
        </OpsSurface>
      </div>
    </OpsPage>
  </OperationsShell>;
}
