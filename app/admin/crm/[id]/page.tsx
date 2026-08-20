import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext } from "../../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../../staff-permissions";
import { OperationsShell } from "../../operations-shell";
import { getCrmCustomer } from "../crm-data.server";
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
    ? {
        ...customer.commercial,
        ...(permissions.canManageCredit ? {} : { payment_terms_days: null, credit_limit: null, outstanding_balance: null }),
      }
    : {
        preferred_currency: customer.preferred_currency,
        payment_terms_days: null,
        credit_limit: null,
        outstanding_balance: null,
        pricing_notes: null,
        markup_percent: null,
        preferred_carriers: [],
      };

  return {
    ...customer,
    ...(permissions.canViewCommercial ? {} : { revenue_total: 0, cost_total: 0, profit_total: 0 }),
    commercial,
  };
}

function redactHistoryForRole(history: CrmOperationsHistory, permissions: StaffCapabilities): CrmOperationsHistory {
  if (permissions.canViewCommercial) return history;
  return { quotes: history.quotes.map((quote) => ({ ...quote, quoted_amount: null })), shipments: history.shipments };
}

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <CustomerGate title="Sign in to KCPL Operations." detail="Customer 360 is available only to authorised KCPL staff." />;

  const staff = await getStaffContext(access.user);
  const permissions = staffCapabilitiesForEmail(access.user.email);
  const { id } = await params;
  let customer: CrmCustomerDetail | null | undefined;
  let linked: CrmQuoteLinkItem[] = [];
  let suggested: CrmQuoteLinkItem[] = [];
  let history: CrmOperationsHistory = { quotes: [], shipments: [] };
  let rateCards: CrmRateCard[] = [];
  let documents: CrmCustomerDocument[] = [];
  let documentStorageAvailable = false;
  let failed = false;

  try {
    const [customerResult, quoteLinks, operationsHistory, rateCardResult, documentResult] = await Promise.all([
      getCrmCustomer(id),
      listCrmQuoteLinks(id),
      listCrmOperationsHistory(id),
      permissions.canViewCommercial ? listCrmRateCards(id) : Promise.resolve(null),
      permissions.canManageCustomerDocuments ? listCrmCustomerDocuments(id) : Promise.resolve(null),
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
  } catch (error) {
    failed = true;
    customer = undefined;
    console.error("Failed to load KCPL Customer 360", id, error);
  }

  if (failed) return <CustomerGate title="Customer 360 could not be loaded." detail="KCPL customer data is temporarily unavailable." />;
  if (customer === undefined) return <CustomerGate title="Firestore is unavailable." detail="The CRM backend is not available for this deployment." />;
  if (!customer || customer.archived) return <CustomerGate title="Customer not found." detail="This CRM record does not exist or has been archived." />;

  const safeCustomer = redactCustomerForRole(customer, permissions);
  const safeHistory = redactHistoryForRole(history, permissions);

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff}>
      <Customer360Workspace initialCustomer={safeCustomer} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={permissions.canViewCommercial} creditVisible={permissions.canManageCredit} />
      <CrmCustomerProfileEditor customer={safeCustomer} permissions={permissions} />
      <CrmOperationsHistoryPanel history={safeHistory} showCommercial={permissions.canViewCommercial} />
      {permissions.canViewCommercial ? <CrmRateCardPanel customerId={safeCustomer.id} initialRateCards={rateCards} permissions={permissions} /> : null}
      {permissions.canManageCustomerDocuments ? <CrmCustomerDocumentsPanel customerId={safeCustomer.id} initialDocuments={documents} storageAvailable={documentStorageAvailable} permissions={permissions} /> : null}
      <CrmQuoteMatchDock customerId={safeCustomer.id} initialLinked={linked} initialSuggested={suggested} />
    </OperationsShell>
  );
}

function CustomerGate({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Customer 360</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/crm" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Back to Customers</Link><Link href="/admin" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Enquiries</Link></div>
      </section>
    </main>
  );
}
