import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext } from "../../staff-directory.server";
import type { StaffCapabilities } from "../../staff-permissions";
import { OperationsShell } from "../../operations-shell";
import { checkCrmCustomerAccess } from "../crm-access.server";
import { getCrmCustomer } from "../crm-data.server";
import { getCrmCustomerFinanceSnapshot } from "../crm-customer-finance.server";
import type { CrmCustomerFinanceSnapshot } from "../crm-customer-finance";
import { listCrmQuoteLinks, type CrmQuoteLinkItem } from "../crm-quote-links.server";
import { listCrmOperationsHistory, type CrmOperationsHistory } from "../crm-operations-history.server";
import { listCrmRateCards } from "../crm-rate-cards.server";
import { listCrmCustomerDocuments } from "../crm-customer-documents.server";
import type { CrmCustomerDocument } from "../crm-customer-document-types";
import type { CrmRateCard } from "../crm-rate-cards";
import type { CrmCustomerDetail } from "../crm-data";
import { Customer360Workspace } from "./customer-360-workspace";
import { CrmQuoteMatchDock } from "./crm-quote-match-dock";
import { CrmOperationsHistoryPanel } from "./crm-operations-history";
import { CrmCustomerProfileEditor } from "./crm-customer-profile-editor";
import { CrmRateCardPanel } from "./crm-rate-card-panel";
import { CrmCustomerDocumentsPanel } from "./crm-customer-documents-panel";
import "./customer-360.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer 360 | KCPL Operations", robots: { index: false, follow: false } };

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
  if (access.kind !== "authorized") return <CustomerGate title="Sign in to KCPL Operations" detail="Customer 360 is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const permissions = staff.permissions;
  const { id } = await params;
  const customerAccess = await checkCrmCustomerAccess(id, staff);
  if (customerAccess.kind === "unavailable") return <CustomerGate title="Firestore is unavailable" detail="The CRM backend is not available for this deployment."/>;
  if (customerAccess.kind === "missing") return <CustomerGate title="Customer not found" detail="This CRM record does not exist or has been archived."/>;
  if (customerAccess.kind === "forbidden") return <CustomerGate title="Customer access restricted" detail="This customer belongs to a KCPL branch outside your assigned access."/>;
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
    linked = quoteLinks?.linked ?? []; suggested = quoteLinks?.suggested ?? []; history = operationsHistory ?? history;
    if (rateCardResult?.kind === "ready") rateCards = rateCardResult.rateCards;
    if (documentResult?.kind === "ready") { documents = documentResult.documents; documentStorageAvailable = documentResult.storageAvailable; }
    financeSnapshot = financeResult ?? null;
  } catch (error) {
    failed = true; customer = undefined; console.error("Failed to load KCPL Customer 360", id, error);
  }

  if (failed) return <CustomerGate title="Customer 360 could not be loaded" detail="KCPL customer data is temporarily unavailable."/>;
  if (customer === undefined) return <CustomerGate title="Firestore is unavailable" detail="The CRM backend is not available for this deployment."/>;
  if (!customer || customer.archived) return <CustomerGate title="Customer not found" detail="This CRM record does not exist or has been archived."/>;

  const safeCustomer = redactCustomerForRole(customer, permissions);
  const reconciledCustomer = reconcileCustomerFinance(safeCustomer, financeSnapshot, permissions);
  const safeHistory = redactHistoryForRole(history, permissions);

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
    <Customer360Workspace initialCustomer={reconciledCustomer} initialFinanceSnapshot={financeSnapshot} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={permissions.canViewCommercial} creditVisible={permissions.canManageCredit}/>
    <section className="ops-content-wide pb-12 pt-0">
      <div className="mb-3"><p className="ops-eyebrow">Account tools</p><h2 className="mt-1 text-[17px] font-[720] tracking-[-.025em] text-[#443b35]">Advanced customer controls</h2><p className="mt-1 max-w-2xl text-[9px] leading-4 text-[#958b83]">Detailed profile editing, operational history, rate cards, document storage and quote matching stay available without crowding the everyday account view.</p></div>
      <div className="crm360-tools">
        <Tool title="Master profile" detail="Edit identity, ownership, relationship classification and permitted commercial settings."><CrmCustomerProfileEditor customer={reconciledCustomer} permissions={permissions}/></Tool>
        <Tool title="Operations history" detail="Review the customer’s quote and shipment trail within your branch access."><CrmOperationsHistoryPanel history={safeHistory} showCommercial={permissions.canViewCommercial}/></Tool>
        {permissions.canViewCommercial ? <Tool title="Rate cards" detail="Customer-specific commercial rates and pricing references."><CrmRateCardPanel customerId={reconciledCustomer.id} initialRateCards={rateCards} permissions={permissions}/></Tool> : null}
        {permissions.canManageCustomerDocuments ? <Tool title="Customer documents" detail="Private account-level files stored through Firebase Storage."><CrmCustomerDocumentsPanel customerId={reconciledCustomer.id} initialDocuments={documents} storageAvailable={documentStorageAvailable} permissions={permissions}/></Tool> : null}
        <Tool title="Quote matching" detail="Link historical or suggested enquiries to this customer record within your branch access."><CrmQuoteMatchDock customerId={reconciledCustomer.id} initialLinked={linked} initialSuggested={suggested}/></Tool>
      </div>
    </section>
  </OperationsShell>;
}

function Tool({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <details className="crm360-tool"><summary><span><strong>{title}</strong><small>{detail}</small></span><span>Open</span></summary><div className="crm360-tool-body">{children}</div></details>;
}

function CustomerGate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Customer 360</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/crm" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Back to Customers</Link><Link href="/admin" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#665c55]">Enquiries</Link></div></section></main>;
}
