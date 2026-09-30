import { ChevronDown } from "lucide-react";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { OpsSurface } from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import type { StaffCapabilities } from "../../staff-permissions";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { checkCrmCustomerReadAccess } from "../crm-access.server";
import type { CrmCustomerDocument } from "../crm-customer-document-types";
import { listCrmCustomerDocuments } from "../crm-customer-documents.server";
import type { CrmCustomerFinanceSnapshot } from "../crm-customer-finance";
import { getCrmCustomerFinanceSnapshot } from "../crm-customer-finance.server";
import type { CrmCustomerDetail } from "../crm-data";
import { getCrmCustomer } from "../crm-data.server";
import { listCrmOperationsHistory, type CrmOperationsHistory } from "../crm-operations-history.server";
import { listCrmQuoteLinks, type CrmQuoteLinkItem } from "../crm-quote-links.server";
import type { CrmRateCard } from "../crm-rate-cards";
import { listCrmRateCards } from "../crm-rate-cards.server";
import { CrmCustomerDocumentsPanel } from "./crm-customer-documents-panel";
import { CrmCustomerProfileEditor } from "./crm-customer-profile-editor";
import { CrmOperationsHistoryPanel } from "./crm-operations-history";
import { CrmQuoteMatchPanel } from "./crm-quote-match-dock";
import { CrmRateCardPanel } from "./crm-rate-card-panel";
import { Customer360Workspace } from "./customer-360-workspace";
import { CrmStatementPanel } from "./crm-statement-panel";
import "./customer-360.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer", robots: { index: false, follow: false } };

function redactCustomerForRole(customer: CrmCustomerDetail, permissions: StaffCapabilities): CrmCustomerDetail {
  const commercial = permissions.canViewCommercial
    ? { ...customer.commercial, ...(permissions.canManageCredit ? {} : { payment_terms_days: null, credit_limit: null, outstanding_balance: null }) }
    : { preferred_currency: customer.preferred_currency, payment_terms_days: null, credit_limit: null, outstanding_balance: null, pricing_notes: null, markup_percent: null, preferred_carriers: [] };
  return { ...customer, ...(permissions.canViewCommercial ? {} : { revenue_total: 0, cost_total: 0, profit_total: 0 }), commercial };
}

function reconcileCustomerFinance(customer: CrmCustomerDetail, financeSnapshot: CrmCustomerFinanceSnapshot | null, permissions: StaffCapabilities) {
  if (!financeSnapshot || !permissions.canViewCommercial) return customer;
  return {
    ...customer,
    revenue_total: financeSnapshot.revenue_total,
    cost_total: financeSnapshot.cost_total,
    profit_total: financeSnapshot.profit_total,
    commercial: {
      ...customer.commercial,
      ...(permissions.canManageCredit ? { outstanding_balance: financeSnapshot.outstanding_total } : {}),
    },
  };
}

function redactHistoryForRole(history: CrmOperationsHistory, permissions: StaffCapabilities): CrmOperationsHistory {
  if (permissions.canViewCommercial) return history;
  return { quotes: history.quotes.map((quote) => ({ ...quote, quoted_amount: null })), shipments: history.shipments };
}

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <CustomerGate title="Sign in to KCPL Operations" detail="Customer pages are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const permissions = staff.permissions;
  // Gates past this point keep the navigation shell; losing the sidebar on a
  // backend hiccup strands the user with no way out but the back button.
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  const shellGate = (title: string, detail: string) => (
    <OperationsShell {...shellProps}><CustomerGate title={title} detail={detail} embedded/></OperationsShell>
  );
  const { id } = await params;
  const customerAccess = await checkCrmCustomerReadAccess(id, staff);
  if (customerAccess.kind === "unavailable") return shellGate("Customer can’t be opened right now", "The records service isn’t responding. Try again in a minute.");
  if (customerAccess.kind === "missing") return shellGate("Customer not found", "This customer record does not exist or has been archived.");
  if (customerAccess.kind === "forbidden") return shellGate("Customer access restricted", "This customer belongs to a KCPL branch outside your assigned access.");
  let customer: CrmCustomerDetail | null | undefined;
  let linked: CrmQuoteLinkItem[] = [];
  let suggested: CrmQuoteLinkItem[] = [];
  let history: CrmOperationsHistory = { quotes: [], shipments: [] };
  let rateCards: CrmRateCard[] = [];
  let documents: CrmCustomerDocument[] = [];
  let financeSnapshot: CrmCustomerFinanceSnapshot | null = null;
  let documentStorageAvailable = false;
  let failed = false;

  try {
    const [customerResult, quoteLinks, operationsHistory, rateCardResult, documentResult, financeResult] = await Promise.all([
      getCrmCustomer(id), listCrmQuoteLinks(id, staff), listCrmOperationsHistory(id, staff),
      permissions.canViewCommercial ? listCrmRateCards(id) : Promise.resolve(null),
      permissions.canManageCustomerDocuments ? listCrmCustomerDocuments(id) : Promise.resolve(null),
      permissions.canViewCommercial ? getCrmCustomerFinanceSnapshot(id, staff) : Promise.resolve(null),
    ]);
    customer = customerResult;
    linked = quoteLinks?.linked ?? [];
    suggested = quoteLinks?.suggested ?? [];
    history = operationsHistory ?? history;
    if (rateCardResult?.kind === "ready") rateCards = rateCardResult.rateCards;
    if (documentResult?.kind === "ready") {
      documents = documentResult.documents;
      documentStorageAvailable = documentResult.storageAvailable;
    }
    financeSnapshot = financeResult ?? null;
  } catch (error) {
    failed = true;
    customer = undefined;
    console.error("Failed to load KCPL Customer 360", id, error);
  }

  if (failed) return <CustomerGate title="Customer didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work."/>;
  if (customer === undefined) return shellGate("Customer can’t be opened right now", "The records service isn’t responding. Try again in a minute.");
  if (!customer || customer.archived) return shellGate("Customer not found", "This customer record does not exist or has been archived.");

  const safeCustomer = redactCustomerForRole(customer, permissions);
  const reconciledCustomer = reconcileCustomerFinance(safeCustomer, financeSnapshot, permissions);
  const safeHistory = redactHistoryForRole(history, permissions);

  return <OperationsShell {...shellProps} detailLabel={reconciledCustomer.display_name}>
    <Customer360Workspace initialCustomer={reconciledCustomer} initialFinanceSnapshot={financeSnapshot} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={permissions.canViewCommercial} creditVisible={permissions.canManageCredit}/>
    <section className="ops-content-wide pb-4 pt-0">
      <CrmOperationsHistoryPanel history={safeHistory} showCommercial={permissions.canViewCommercial}/>
    </section>
    <section className="ops-content-wide pb-12 pt-0">
      <OpsSurface title="Account tools" description="Profile, rate cards, statement, documents and enquiry matching for this customer." flush>
      <div className="crm360-tools">
        <Tool title="Profile" detail="Names, contacts, owner, relationships and commercial settings."><CrmCustomerProfileEditor customer={reconciledCustomer} permissions={permissions}/></Tool>
        {permissions.canViewCommercial ? <Tool title="Rate cards" detail="Customer-specific lanes and rates."><CrmRateCardPanel customerId={reconciledCustomer.id} initialRateCards={rateCards} permissions={permissions}/></Tool> : null}
        {permissions.canManageFinance ? <Tool title="Statement of account" detail="The customer's statement as a PDF: view it, or email it to their portal owners."><CrmStatementPanel customerId={reconciledCustomer.id}/></Tool> : null}
        {permissions.canManageCustomerDocuments ? <Tool title="Customer documents" detail="KYC, tax registration, contracts and rate sheets, kept against the customer rather than a shipment."><CrmCustomerDocumentsPanel customerId={reconciledCustomer.id} initialDocuments={documents} storageAvailable={documentStorageAvailable} permissions={permissions}/></Tool> : null}
        <Tool title="Enquiry matching" detail={suggested.length ? `${suggested.length} website ${suggested.length === 1 ? "enquiry needs" : "enquiries need"} confirming.` : "Website enquiries linked to this customer."}><CrmQuoteMatchPanel customerId={reconciledCustomer.id} initialLinked={linked} initialSuggested={suggested}/></Tool>
      </div>
      </OpsSurface>
    </section>
  </OperationsShell>;
}

function Tool({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <details className="crm360-tool"><summary><span><strong>{title}</strong><small>{detail}</small></span><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"/></summary><div className="crm360-tool-body">{children}</div></details>;
}

function CustomerGate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="Customer"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/crm", label: "Back to Customers", primary: true },
      { href: "/admin", label: "Enquiries" },
    ]}
  />;
}
