const fs = require('node:fs');

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
  console.log(`updated ${path}`);
}

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing target: ${label}`);
  return source.replace(from, to);
}

patch('app/admin/admin-dashboard.tsx', (source) => {
  const oldRow = `<div className="flex items-center justify-between gap-2"><OpsMono className="truncate text-[10px] text-[#514840]">{quote.reference}</OpsMono><OpsBadge tone={statusTone(quote.status)} dot>{statusLabels[quote.status]}</OpsBadge></div>\n                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#514840]"><span className="truncate">{quote.origin}</span><ArrowRight size={11} className="shrink-0 text-[#c47b64]"/><span className="truncate">{quote.destination}</span></div>\n                <p className="mt-1 truncate text-[9px] text-[#857b73]">{quote.company_name || quote.contact_name}{quote.assigned_to ? \\` · \\${quote.assigned_to}\\` : ""}</p>\n                <div className="mt-2 flex items-center justify-between text-[8px] text-[#a0968e]"><span>{formatDate(quote.created_at)}</span>{quote.note_count ? <span className="flex items-center gap-1"><MessageSquareText size={10}/>{quote.note_count}</span> : null}</div>`;
  const newRow = `<div className="flex items-center justify-between gap-2"><div className="ops-route min-w-0 text-[12px]"><span className="truncate">{quote.origin}</span><ArrowRight size={11} className="ops-route-arrow shrink-0"/><span className="truncate">{quote.destination}</span></div><OpsBadge tone={statusTone(quote.status)} dot>{statusLabels[quote.status]}</OpsBadge></div>\n                <p className="mt-1.5 truncate text-[10px] font-semibold text-[#5f5953]">{quote.company_name || quote.contact_name} · {modeLabels[quote.mode] ?? quote.mode}</p>\n                <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-[#8b847d]"><span className="min-w-0 truncate"><OpsMono>{quote.reference}</OpsMono>{quote.assigned_to ? \\` · \\${quote.assigned_to}\\` : ""}</span><span className="flex shrink-0 items-center gap-2"><span>{formatDate(quote.created_at)}</span>{quote.note_count ? <span className="flex items-center gap-1"><MessageSquareText size={10}/>{quote.note_count}</span> : null}</span></div>`;
  return mustReplace(source, oldRow, newRow, 'enquiry inbox row');
});

patch('app/admin/shipments/shipments-workspace.tsx', (source) => {
  let next = source;
  const helperAnchor = `function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "violet" | "success" | "danger" {\n  if (status === "delivered") return "success";\n  if (status === "exception") return "danger";\n  if (status === "customs_clearance") return "violet";\n  if (status === "preparing") return "warning";\n  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";\n  return "neutral";\n}`;
  const helpers = `${helperAnchor}\n\nfunction shipmentMilestones(mode: string) {\n  const normalized = mode.toLowerCase();\n  if (normalized.includes("air")) return ["Booked", "Docs", "Export", "Departed", "Arrived", "Customs", "Delivery", "Delivered"];\n  if (normalized.includes("sea") || normalized.includes("ocean")) return ["Booked", "Docs", "Export", "Sailed", "Arrived", "Customs", "Delivery", "Delivered"];\n  if (normalized.includes("road")) return ["Booked", "Docs", "Origin", "Transit", "Customs", "Delivery", "Delivered"];\n  return ["Booked", "Docs", "Transit", "Customs", "Delivery", "Delivered"];\n}\n\nfunction milestonePosition(status: ShipmentStatus, count: number) {\n  const ratio: Record<Exclude<ShipmentStatus, "exception">, number> = { booking_confirmed: 0, preparing: .18, in_transit: .52, customs_clearance: .72, out_for_delivery: .88, delivered: 1 };\n  if (status === "exception") return -1;\n  return Math.min(count - 1, Math.round(ratio[status] * (count - 1)));\n}`;
  next = mustReplace(next, helperAnchor, helpers, 'shipment milestone helpers');
  next = mustReplace(next, `{columns.status ? <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td> : null}`, `{columns.status ? <td><div className="grid gap-2"><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge><ShipmentMilestoneRail job={job}/></div></td> : null}`, 'shipment status rail');
  next = mustReplace(next, `className={owner === "Unassigned" ? "font-bold text-[#b65355]" : ""}`, `className={owner === "Unassigned" ? "font-bold text-[#9b682b]" : ""}`, 'unassigned owner semantics');
  next = mustReplace(next, `<OpsEmptyState icon={<PackageCheck size={18}/>} title="No shipments in this view" description="Try another saved view or reset the filters. Nothing has been deleted or hidden from the underlying job files."/>`, `<OpsEmptyState kind="search" icon={<PackageCheck size={18}/>} title="No shipments in this view" description="Try another saved view or reset the filters. Nothing has been deleted or hidden from the underlying job files."/>`, 'shipment empty state');
  next = mustReplace(next, `<td className="text-right"><OpsButton variant="ghost" size="sm" onClick={onPreview}>Preview <ArrowRight size={11}/></OpsButton></td>`, `<td className="text-right"><div className="flex justify-end gap-1"><OpsButton variant="ghost" size="sm" onClick={onPreview}>Preview</OpsButton><Link href={\`/admin/jobs/\${encodeURIComponent(job.reference)}\`} className="ops-button" data-variant="secondary" data-size="sm">Open job <ArrowRight size={11}/></Link></div></td>`, 'shipment quick actions');
  const componentAnchor = `function PreviewFact({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {`;
  const component = `function ShipmentMilestoneRail({ job }: { job: CommandCentreJob }) {\n  const labels = shipmentMilestones(job.mode);\n  const current = milestonePosition(job.status, labels.length);\n  if (job.status === "exception") return <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#ae434a]"><AlertTriangle size={10}/>Operational exception</div>;\n  return <div title={labels.join(" → ")} aria-label={\`Shipment lifecycle: \${labels.join(", ")}\`}><div className="ops-milestones">{labels.map((label, index) => <span key={label} className="ops-milestone" data-state={index < current ? "done" : index === current ? "current" : "pending"}><i aria-hidden="true"/></span>)}</div><p className="mt-1 text-[8px] text-[#8b847d]">{labels[current]}</p></div>;\n}\n\n${componentAnchor}`;
  next = mustReplace(next, componentAnchor, component, 'shipment milestone component');
  return next;
});

patch('app/admin/alerts/alerts-workspace.tsx', (source) => {
  let next = mustReplace(source, `{evaluating ? "Checking…" : "Run checks"}`, `{evaluating ? "Checking…" : "Check now"}`, 'alert check action');
  const countsBlock = `  const counts = {\n    critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,\n    warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length,\n    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,\n    open: alerts.filter((alert) => alert.status === "open").length,\n  };`;
  next = mustReplace(next, countsBlock, `${countsBlock}\n  const unresolved = alerts.filter((alert) => alert.status !== "resolved").length;`, 'alert unresolved count');
  const oldEmpty = `<OpsEmptyState icon={<CheckCircle2 size={18}/>} title="Nothing needs attention in this view" description="The automation engine has no matching work. Change the filters or run the checks again if you want to refresh the queue." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Show all alerts</OpsButton>}/>`;
  const newEmpty = `{unresolved === 0 ? <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={18}/>} title="All clear ✓" description="No active exceptions require attention. KCPL will surface new operational risk here when a rule is triggered." action={<OpsButton variant="secondary" size="sm" onClick={() => action("evaluate")} disabled={evaluating}>{evaluating ? "Checking…" : "Check now"}</OpsButton>}/> : <OpsEmptyState kind="search" icon={<CheckCircle2 size={18}/>} title="No alerts match this view" description="There is active work elsewhere in the queue, but nothing matches the current filters." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Show all alerts</OpsButton>/>}`;
  next = mustReplace(next, oldEmpty, newEmpty, 'alert empty state');
  return next;
});

patch('app/admin/crm/crm-dashboard.tsx', (source) => {
  let next = source;
  next = mustReplace(next, `  crmRelationshipTypes,\n`, ``, 'customer relationship types import');
  next = mustReplace(next, `  type CrmRelationshipType,\n`, ``, 'customer relationship type import');
  const init = `export function CrmDashboard({ initialCustomers, initialStats, userName, userEmail }: { initialCustomers: CrmCustomerSummary[]; initialStats: CrmDashboardStats; userName: string; userEmail: string }) {\n  const [customers, setCustomers] = useState(initialCustomers);\n  const [stats, setStats] = useState(initialStats);\n  const [selectedId, setSelectedId] = useState(initialCustomers[0]?.id ?? "");`;
  const initNew = `export function CrmDashboard({ initialCustomers, initialStats, userName, userEmail }: { initialCustomers: CrmCustomerSummary[]; initialStats: CrmDashboardStats; userName: string; userEmail: string }) {\n  const buyerCustomers = initialCustomers.filter((customer) => customer.relationship_types.includes("customer"));\n  const [customers, setCustomers] = useState(buyerCustomers);\n  const [stats, setStats] = useState(buyerCustomers.length === initialCustomers.length ? initialStats : computeStats(buyerCustomers));\n  const [selectedId, setSelectedId] = useState(buyerCustomers[0]?.id ?? "");`;
  next = mustReplace(next, init, initNew, 'customer-only state');
  next = mustReplace(next, `const [showCreate, setShowCreate] = useState(initialCustomers.length === 0);`, `const [showCreate, setShowCreate] = useState(buyerCustomers.length === 0);`, 'customer create empty state');
  const toggle = `\n  function toggleRelationship(type: CrmRelationshipType) {\n    setForm((current) => ({ ...current, relationshipTypes: current.relationshipTypes.includes(type) ? current.relationshipTypes.filter((item) => item !== type) : [...current.relationshipTypes, type] }));\n    setDuplicates([]);\n  }\n`;
  next = mustReplace(next, toggle, `\n`, 'customer relation toggle');
  next = mustReplace(next, `A quiet account index for customers, suppliers, carriers, agents and partners. Open Customer 360 when you need the full relationship history.`, `Customer accounts that buy KCPL freight and logistics services. Carriers, agents, transporters, suppliers and overseas counterparts live in Partners.`, 'customer description');
  next = mustReplace(next, `toggleRelationship={toggleRelationship} `, ``, 'customer form prop');
  next = mustReplace(next, `function CreateCustomerForm({ form, setField, toggleRelationship, tagDraft, setTagDraft, carrierDraft, setCarrierDraft, transportDraft, setTransportDraft, saving, duplicates, advancedOpen, setAdvancedOpen, onSubmit, onCancel }: {`, `function CreateCustomerForm({ form, setField, tagDraft, setTagDraft, carrierDraft, setCarrierDraft, transportDraft, setTransportDraft, saving, duplicates, advancedOpen, setAdvancedOpen, onSubmit, onCancel }: {`, 'customer form signature');
  next = mustReplace(next, `  toggleRelationship: (type: CrmRelationshipType) => void;\n`, ``, 'customer form type prop');
  const relationPicker = `<div className="mt-4"><p className="mb-2 text-[9px] font-bold text-[#655c54]">Relationship</p><div className="flex flex-wrap gap-2">{crmRelationshipTypes.map((type) => <button key={type} type="button" onClick={() => toggleRelationship(type)} className="ops-badge" data-tone={form.relationshipTypes.includes(type) ? "accent" : "neutral"}>{form.relationshipTypes.includes(type) ? <span>✓</span> : null}{crmRelationshipLabels[type]}</button>)}</div></div>`;
  const relationFixed = `<div className="mt-4 flex flex-wrap items-center gap-2"><OpsBadge tone="info">Customer</OpsBadge><span className="text-[10px] text-[#756e67]">This workspace is for buyers of KCPL services. Operational suppliers and counterparts belong in Partners.</span></div>`;
  next = mustReplace(next, relationPicker, relationFixed, 'customer relationship picker');
  next = mustReplace(next, `<OpsEmptyState title="No records match" description="Change the filter or add a new relationship."/>`, `<OpsEmptyState kind="search" title="No customers match" description="Change the filter or create a customer account."/>`, 'customer search empty');
  next = mustReplace(next, `<OpsEmptyState icon={<UsersRound size={19}/>} title="Build the customer graph" description="Create the first CRM record to connect enquiries, shipments, contacts, commercial terms and activity." action={<OpsButton variant="primary" onClick={openNew}>Create record</OpsButton>}/>`, `<OpsEmptyState kind="setup" icon={<UsersRound size={19}/>} title="Add the first KCPL customer" description="Customer accounts connect enquiries, shipments, contacts, commercial terms and activity. Agents, carriers and vendors belong in Partners." action={<OpsButton variant="primary" onClick={openNew}>Create customer</OpsButton>}/>`, 'customer setup empty');
  return next;
});

patch('app/admin/partners/partners-workspace.tsx', (source) => {
  let next = source;
  const stats = `<OpsStatStrip><OpsStat label="Active network" value={dashboard.active_count} icon={<Handshake size={13}/>} tone="success"/><OpsStat label="Preferred" value={dashboard.preferred_count} icon={<BadgeCheck size={13}/>} tone="accent"/><OpsStat label="Countries" value={dashboard.country_count} icon={<Globe2 size={13}/>} /><OpsStat label="Unlinked supplier bills" value={dashboard.unlinked_supplier_bills} icon={<TriangleAlert size={13}/>} tone={dashboard.unlinked_supplier_bills ? "warning" : "neutral"}/><OpsStat label="Partner records" value={dashboard.partners.length} icon={<Building2 size={13}/>} /></OpsStatStrip>`;
  next = mustReplace(next, stats, `{dashboard.partners.length ? ${stats} : null}`, 'partner adaptive stats');
  const registerStart = `      <OpsSurface eyebrow="Network register" title="Partners & vendors" description={\`${'${filtered.length}'} of ${'${dashboard.partners.length}'} records shown.\`} flush>`;
  const onboarding = `      {!dashboard.partners.length && !formOpen ? <OpsSurface eyebrow="Operating network" title="Build your operating network" description="Add the carriers, agents, transporters, warehouses and international counterparts KCPL works with to move freight." action={canEdit ? <OpsButton variant="primary" onClick={startCreate}><Plus size={12}/>Add first partner</OpsButton> : null}>\n        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><PartnerKind title="Carrier" detail="Shipping line, airline or trucking provider"/><PartnerKind title="Agent" detail="International freight or customs counterpart"/><PartnerKind title="Warehouse" detail="Storage, handling or consolidation facility"/><PartnerKind title="Vendor" detail="External operational supplier"/></div>\n      </OpsSurface> : null}\n\n${registerStart}`;
  next = mustReplace(next, registerStart, onboarding, 'partner onboarding');
  next = mustReplace(next, `<OpsEmptyState icon={<Handshake size={18}/>} title="No partners match" description="Change the filters or add a new network record."/>`, `<OpsEmptyState kind="search" icon={<Handshake size={18}/>} title="No partners match" description="Change the filters or add a new network record."/>`, 'partner search empty');
  const toggleAnchor = `function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {`;
  next = mustReplace(next, toggleAnchor, `function PartnerKind({ title, detail }: { title: string; detail: string }) { return <div className="border-l-2 border-[#d8d2cc] pl-3"><strong className="text-[11px] text-[#403a36]">{title}</strong><p className="mt-1 text-[10px] leading-5 text-[#756e67]">{detail}</p></div>; }\n\n${toggleAnchor}`, 'partner kind helper');
  return next;
});

patch('app/admin/finance/finance-workspace.tsx', (source) => {
  let next = mustReplace(source, `eyebrow="Finance" title="Accounts Receivable"`, `eyebrow="Commercial" title="Receivables"`, 'receivables title');
  next = mustReplace(next, `<OpsEmptyState title="No invoices match" description="Change the filters or create a new invoice draft."/>`, `<OpsEmptyState kind="search" title="No receivables match" description="Change the filters or create a new invoice draft."/>`, 'receivables empty');
  return next;
});
