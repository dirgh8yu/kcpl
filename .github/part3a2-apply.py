from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, value: str) -> None:
    Path(path).write_text(value)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    value = read(path)
    if value.count(old) < count:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    write(path, value.replace(old, new, count))


# Customer detail API: live finance snapshot on GET/refresh and cache rebuild after currency change.
path = "app/api/admin/crm/customers/[id]/route.ts"
replace(
    path,
    'import { getCrmCustomer } from "../../../../../admin/crm/crm-data.server";\n',
    'import { getCrmCustomer } from "../../../../../admin/crm/crm-data.server";\n'
    'import { getCrmCustomerFinanceSnapshot } from "../../../../../admin/crm/crm-customer-finance.server";\n'
    'import type { CrmCustomerFinanceSnapshot } from "../../../../../admin/crm/crm-customer-finance";\n'
    'import { recomputeCustomerFinance } from "../../../../../admin/finance/finance.server";\n',
)
replace(
    path,
    '\nfunction stringArray(value: unknown, max = 50) {',
    '''\nfunction applyFinanceSnapshot(customer: CrmCustomerDetail, snapshot: CrmCustomerFinanceSnapshot | null) {\n  if (!snapshot) return customer;\n  return {\n    ...customer,\n    revenue_total: snapshot.revenue_total,\n    cost_total: snapshot.cost_total,\n    profit_total: snapshot.profit_total,\n    commercial: { ...customer.commercial, outstanding_balance: snapshot.outstanding_total },\n  };\n}\n\nfunction stringArray(value: unknown, max = 50) {''',
)
replace(
    path,
    '    return crmJson({ ok: true, customer: redactCustomer(customer, auth.permissions), permissions: auth.permissions });',
    '''    const financeSnapshot = auth.permissions.canViewCommercial\n      ? await getCrmCustomerFinanceSnapshot(id, auth.staff) ?? null\n      : null;\n    const reconciled = applyFinanceSnapshot(customer, financeSnapshot);\n    return crmJson({ ok: true, customer: redactCustomer(reconciled, auth.permissions), financeSnapshot, permissions: auth.permissions });''',
)
replace(
    path,
    '  const statusError = crmAccountStatusChangeError(currentStatus, accountStatus as CrmAccountStatus, auth.permissions);\n  if (statusError) return crmJson({ ok: false, error: statusError }, 403);',
    '''  const statusError = crmAccountStatusChangeError(currentStatus, accountStatus as CrmAccountStatus, auth.permissions);\n  if (statusError) return crmJson({ ok: false, error: statusError }, 403);\n  const currentPreferredCurrency = crmCurrencies.includes(access.snapshot.get("preferred_currency") as CrmCurrency)\n    ? access.snapshot.get("preferred_currency") as CrmCurrency\n    : "NPR";''',
)
replace(
    path,
    '''    const customer = await getCrmCustomer(id);\n    return crmJson({ ok: true, customer: customer ? redactCustomer(customer, auth.permissions) : null });''',
    '''    if (includesCommercial && preferredCurrency !== currentPreferredCurrency) await recomputeCustomerFinance(id);\n    const customer = await getCrmCustomer(id);\n    const financeSnapshot = auth.permissions.canViewCommercial\n      ? await getCrmCustomerFinanceSnapshot(id, auth.staff) ?? null\n      : null;\n    const reconciled = customer ? applyFinanceSnapshot(customer, financeSnapshot) : null;\n    return crmJson({ ok: true, customer: reconciled ? redactCustomer(reconciled, auth.permissions) : null, financeSnapshot });''',
)

# Job File cost entry: refresh customer profitability cache immediately.
path = "app/api/admin/jobs/[reference]/route.ts"
replace(
    path,
    'import { firebaseAdminDb } from "../../../../firebase-admin.server";\n',
    'import { firebaseAdminDb } from "../../../../firebase-admin.server";\nimport { recomputeCustomerFinance } from "../../../../admin/finance/finance.server";\n',
)
replace(
    path,
    '''async function touchShipment(reference: string) {\n  await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).update({ updated_at: new Date().toISOString() });\n}\n''',
    '''async function touchShipment(reference: string) {\n  await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).update({ updated_at: new Date().toISOString() });\n}\n\nasync function refreshShipmentCustomerFinance(reference: string) {\n  const shipment = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();\n  const customerId = typeof shipment.get("customer_id") === "string" ? shipment.get("customer_id").trim().toUpperCase() : "";\n  if (customerId) await recomputeCustomerFinance(customerId);\n}\n''',
)
replace(
    path,
    '''    if (result.kind !== "created") return resultError(result.kind);\n    await touchShipment(reference);\n    return json({ ok: true, cost: result.cost }, 201);''',
    '''    if (result.kind !== "created") return resultError(result.kind);\n    await touchShipment(reference);\n    await refreshShipmentCustomerFinance(reference);\n    return json({ ok: true, cost: result.cost }, 201);''',
)

# Enquiry-created customers: preserve the same branch-scoped quote-link guard.
path = "app/api/admin/quotes/[reference]/route.ts"
replace(
    path,
    '      const result = await createCrmCustomerFromQuote(reference, { name: auth.user.displayName, email: auth.user.email }, customerBranch);',
    '      const result = await createCrmCustomerFromQuote(reference, { name: auth.user.displayName, email: auth.user.email }, customerBranch, auth.staff);',
)
replace(
    path,
    '      if (result.kind === "missing_quote") return json({ ok: false, error: "Quote not found." }, 404);',
    '      if (result.kind === "missing_quote") return json({ ok: false, error: "Quote not found." }, 404);\n      if (result.kind === "forbidden") return json({ ok: false, error: "This enquiry has a shipment outside your KCPL branch access." }, 403);',
)

# Customer 360 client: keep live finance state through Refresh and make credit exposure operationally useful.
path = "app/admin/crm/[id]/customer-360-workspace.tsx"
replace(
    path,
    '} from "../crm-data";\n',
    '} from "../crm-data";\nimport type { CrmCustomerFinanceSnapshot } from "../crm-customer-finance";\n',
)
replace(
    path,
    'export function Customer360Workspace({ initialCustomer, userName, userEmail, commercialVisible, creditVisible }: { initialCustomer: CrmCustomerDetail; userName: string; userEmail: string; commercialVisible: boolean; creditVisible: boolean }) {',
    'export function Customer360Workspace({ initialCustomer, initialFinanceSnapshot, userName, userEmail, commercialVisible, creditVisible }: { initialCustomer: CrmCustomerDetail; initialFinanceSnapshot: CrmCustomerFinanceSnapshot | null; userName: string; userEmail: string; commercialVisible: boolean; creditVisible: boolean }) {',
)
replace(
    path,
    '  const [customer, setCustomer] = useState(initialCustomer);\n',
    '  const [customer, setCustomer] = useState(initialCustomer);\n  const [financeSnapshot, setFinanceSnapshot] = useState(initialFinanceSnapshot);\n',
)
replace(
    path,
    '''  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;''',
    '''  const financeRevenue = financeSnapshot?.revenue_total ?? customer.revenue_total;\n  const financeCost = financeSnapshot?.cost_total ?? customer.cost_total;\n  const financeProfit = financeSnapshot?.profit_total ?? customer.profit_total;\n  const financeOutstanding = financeSnapshot?.outstanding_total ?? customer.commercial.outstanding_balance ?? 0;\n  const creditLimit = customer.commercial.credit_limit;\n  const availableCredit = creditLimit === null ? null : creditLimit - financeOutstanding;\n  const creditOverLimit = creditLimit !== null && financeOutstanding > creditLimit;\n  const grossMargin = financeSnapshot?.gross_margin_percent ?? (financeRevenue > 0 ? (financeProfit / financeRevenue) * 100 : 0);\n  const accountRisk = customer.account_status === "blacklisted"\n    ? "This account is blacklisted. New commercial commitments should not proceed."\n    : customer.account_status === "on_hold"\n      ? "This account is on credit hold. Accounts or Management must clear the hold before new exposure."\n      : creditOverLimit\n        ? "Outstanding receivables exceed the approved credit limit."\n        : financeSnapshot && financeSnapshot.overdue_total > 0\n          ? `${financeSnapshot.overdue_invoice_count} overdue invoice${financeSnapshot.overdue_invoice_count === 1 ? "" : "s"} require Accounts follow-up.`\n          : null;''',
)
replace(
    path,
    '    const data = await response.json() as { customer?: CrmCustomerDetail; error?: string };\n    if (!response.ok || !data.customer) throw new Error(data.error || "Could not refresh Customer 360.");\n    setCustomer(data.customer);',
    '    const data = await response.json() as { customer?: CrmCustomerDetail; financeSnapshot?: CrmCustomerFinanceSnapshot | null; error?: string };\n    if (!response.ok || !data.customer) throw new Error(data.error || "Could not refresh Customer 360.");\n    setCustomer(data.customer);\n    setFinanceSnapshot(data.financeSnapshot ?? null);',
)
old_surface = '''            {commercialVisible ? <OpsSurface eyebrow="Commercial" title={`${customer.preferred_currency} account`} description="Commercial data is visible only to authorised roles."><div className="divide-y divide-[#eee7e1]"><MoneyLine label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)}/><MoneyLine label="Cost" value={formatMoney(customer.cost_total, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} strong/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/><MoneyLine label="Markup" value={customer.commercial.markup_percent === null ? "Not set" : `${customer.commercial.markup_percent}%`}/>{creditVisible ? <><MoneyLine label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`}/><MoneyLine label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)}/><MoneyLine label="Outstanding" value={formatMoney(customer.commercial.outstanding_balance, customer.preferred_currency)}/></> : null}</div>{customer.commercial.pricing_notes ? <div className="mt-4 rounded-[12px] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Pricing note</p><p className="mt-2 text-[9px] leading-5 text-[#756b63]">{customer.commercial.pricing_notes}</p></div> : null}</OpsSurface> : <OpsSurface eyebrow="Commercial" title="Commercial data restricted"'''
new_surface = '''            {commercialVisible ? <OpsSurface eyebrow="Commercial" title={`${customer.preferred_currency} account`} description={financeSnapshot ? `Live branch-aware reconciliation · ${formatDate(financeSnapshot.generated_at)}` : "Commercial data is visible only to authorised roles."}>{accountRisk ? <div className="mb-4 rounded-[12px] border border-[#ead1c8] bg-[#fff6f2] p-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#a45543]">Account attention</p><p className="mt-1.5 text-[9px] leading-5 text-[#71544a]">{accountRisk}</p></div> : null}<div className="divide-y divide-[#eee7e1]"><MoneyLine label="Revenue" value={formatMoney(financeRevenue, customer.preferred_currency)}/><MoneyLine label="Cost" value={formatMoney(financeCost, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(financeProfit, customer.preferred_currency)} strong/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/><MoneyLine label="Markup" value={customer.commercial.markup_percent === null ? "Not set" : `${customer.commercial.markup_percent}%`}/>{creditVisible ? <><MoneyLine label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`}/><MoneyLine label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)}/><MoneyLine label="Outstanding" value={formatMoney(financeOutstanding, customer.preferred_currency)}/><MoneyLine label="Available credit" value={availableCredit === null ? "Not set" : formatMoney(availableCredit, customer.preferred_currency)}/>{financeSnapshot ? <><MoneyLine label="Collected" value={formatMoney(financeSnapshot.collected_total, customer.preferred_currency)}/><MoneyLine label="Overdue" value={formatMoney(financeSnapshot.overdue_total, customer.preferred_currency)}/><MoneyLine label="Open invoices" value={`${financeSnapshot.open_invoice_count}`}/>{financeSnapshot.oldest_overdue_days !== null ? <MoneyLine label="Oldest overdue" value={`${financeSnapshot.oldest_overdue_days} days`}/> : null}</> : null}</> : null}</div>{financeSnapshot && (financeSnapshot.other_currency_invoice_count || financeSnapshot.other_currency_cost_count || financeSnapshot.integrity_warning_count) ? <div className="mt-4 rounded-[12px] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Reconciliation note</p><p className="mt-2 text-[9px] leading-5 text-[#756b63]">{financeSnapshot.other_currency_invoice_count ? `${financeSnapshot.other_currency_invoice_count} invoice(s) use another currency. ` : ""}{financeSnapshot.other_currency_cost_count ? `${financeSnapshot.other_currency_cost_count} job cost(s) use another currency. ` : ""}{financeSnapshot.integrity_warning_count ? `${financeSnapshot.integrity_warning_count} finance record(s) were excluded because branch data is invalid.` : ""}</p></div> : null}{customer.commercial.pricing_notes ? <div className="mt-4 rounded-[12px] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Pricing note</p><p className="mt-2 text-[9px] leading-5 text-[#756b63]">{customer.commercial.pricing_notes}</p></div> : null}</OpsSurface> : <OpsSurface eyebrow="Commercial" title="Commercial data restricted"'''
replace(path, old_surface, new_surface)
