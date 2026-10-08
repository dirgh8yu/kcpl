"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, Circle, CircleDot, Minus, OctagonAlert } from "lucide-react";
import type { DigitalJobFile } from "../../job-file";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import type { CustomsAgentOption, CustomsClearanceRecord } from "../../customs/customs-clearance";
import { CustomsClearanceEditor } from "../../customs/customs-clearance-editor";
import { shipmentStatusLabels } from "../../../shipment-types";
import type { PickupAppointmentStatus } from "../../pickups/pickup-appointments";
import { OpsBadge, OpsCopyButton, OpsNotice, OpsPageHeader, OpsSurface } from "../../operations-ui";
import { ShipmentStatusControl } from "../../shipment-status-control";
import { statusTone } from "../../shipments/shipments-views";
import { MovementControl, POST_UPDATE_EVENT } from "./movement-control";
import { PickupControl } from "./pickup-control";
import type { JobPickup } from "./job-step-context.server";
import { buildJobSteps, initialJobPanel, type JobPanel, type JobStep, type JobStepState } from "./job-steps";
import { freightModeLabel } from "../../freight-mode";

/** Other parts of the Job File (the closeout, a blocker's fix link) open a
 * panel by announcing it; the record owns which one is showing. */
export const JOB_PANEL_EVENT = "kcpl:job-panel";
export function openJobPanel(panel: JobPanel) {
  window.dispatchEvent(new CustomEvent<JobPanel>(JOB_PANEL_EVENT, { detail: panel }));
}

// Keep the open step in the address so a reload or a shared link lands on it.
function rememberPanel(panel: JobPanel) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", panel);
  window.history.replaceState(window.history.state, "", url);
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU")}`; }
}

const stateLabels: Record<JobStepState, string> = {
  done: "Done",
  current: "Next",
  blocked: "Stuck",
  upcoming: "Later",
  skipped: "Not needed",
};

function StepIcon({ state }: { state: JobStepState }) {
  const props = { size: 14, strokeWidth: 2, "aria-hidden": true } as const;
  if (state === "done") return <Check {...props}/>;
  if (state === "current") return <CircleDot {...props}/>;
  if (state === "blocked") return <OctagonAlert {...props}/>;
  if (state === "skipped") return <Minus {...props}/>;
  return <Circle {...props}/>;
}

const extraLabels = {
  tasks: "Tasks",
  problems: "Problems",
  messages: "Customer messages",
  costs: "Costs & margin",
  history: "History",
} as const;

export function JobRecord({
  job,
  readiness,
  clearance,
  customsAgents,
  pickupStatus,
  pickup,
  requestedPanel,
  openProblems,
  canManageFinance,
  canMessageCustomer,
  children,
}: {
  job: DigitalJobFile;
  readiness: ShipmentWorkflowReadiness;
  clearance: CustomsClearanceRecord | null;
  customsAgents: CustomsAgentOption[];
  pickupStatus: PickupAppointmentStatus | null;
  pickup: JobPickup | null;
  requestedPanel: string | null;
  openProblems: number;
  canManageFinance: boolean;
  canMessageCustomer: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const steps = buildJobSteps({
    status: job.status,
    customerName: job.customer_name,
    currentLocation: job.current_location,
    readiness,
    pickupStatus,
    customsHoldReason: clearance?.hold_reason ?? null,
  });
  const [panel, setPanel] = useState<JobPanel>(() => initialJobPanel(steps, requestedPanel));
  const [notice, setNotice] = useState("");
  const reference = encodeURIComponent(job.reference);
  const openTaskCount = job.tasks.filter((task) => !task.completed).length;
  const currentStep = steps.find((step) => step.state === "current" || step.state === "blocked") ?? null;
  const selectedStep = steps.find((step) => step.id === panel) ?? null;

  function show(next: JobPanel) {
    setPanel(next);
    rememberPanel(next);
  }

  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent<JobPanel>).detail;
      setPanel(next);
      rememberPanel(next);
    };
    window.addEventListener(JOB_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(JOB_PANEL_EVENT, onOpen);
  }, []);

  function changed(message: string) {
    setNotice(message);
    router.refresh();
  }

  const extras = ([
    ["tasks", openTaskCount],
    ["problems", openProblems],
    ...(canMessageCustomer ? [["messages", 0]] as const : []),
    ...(job.can_view_costs ? [["costs", 0]] as const : []),
    ["history", 0],
  ] as const);

  // One currency is shown as it is; several are combined in NPR at NRB's
  // rates, never by showing the first currency alone (a USD invoice against
  // NPR costs read as a 100% margin).
  const currencies = [...new Set([...Object.entries(job.revenue_totals), ...Object.entries(job.cost_totals)].filter(([, value]) => value).map(([currency]) => currency))];
  const combined = job.combined_margin ?? null;
  const singleCurrency = currencies.length === 1 ? currencies[0] : null;
  const marginFigures = combined?.kind === "converted"
    ? { currency: combined.currency, revenue: combined.revenue, cost: combined.cost, profit: combined.profit, margin: combined.margin_percent ?? undefined }
    : singleCurrency
      ? {
        currency: singleCurrency,
        revenue: job.revenue_totals[singleCurrency as keyof typeof job.revenue_totals] ?? 0,
        cost: job.cost_totals[singleCurrency as keyof typeof job.cost_totals] ?? 0,
        profit: job.profit_totals[singleCurrency as keyof typeof job.profit_totals] ?? 0,
        margin: job.margin_percent[singleCurrency as keyof typeof job.margin_percent],
      }
      : null;

  return <div className="shipment-detail-v2 job-record" data-panel-active={panel} data-surface-density="compact">
    <OpsPageHeader
      // Every record page reads the same way: the kind of record, then its
      // reference and status, then the route, then the facts.
      eyebrow="Shipment"
      title={<span className="job-record-title"><span className="ops-mono">{job.reference}</span><OpsCopyButton value={job.reference} label={job.reference}/><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></span>}
      description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`}
      meta={<><span>{job.customer_name || "No customer linked"}</span><span>{freightModeLabel(job.mode)}{job.carrier ? ` · ${job.carrier}` : ""}</span><span>ETA {shortDate(job.eta)}</span><span>Owner {job.assigned_to_name || job.assigned_to_email || "nobody yet"}</span></>}
      // Tells the customer where the shipment is: the "Post update" form under
      // In transit, which publishes to their tracking page.
      actions={<button type="button" className="ops-button" data-variant="secondary" data-size="md" onClick={() => { show("transit"); window.dispatchEvent(new Event(POST_UPDATE_EVENT)); }}>Send customer update</button>}
    />

    <div className="job-guide">
      <nav className="job-steps" aria-label="Shipment steps">
        <ol>
          {steps.map((step) => <li key={step.id} data-state={step.state}>
            <button type="button" aria-current={panel === step.id ? "step" : undefined} data-active={panel === step.id || undefined} onClick={() => show(step.id)}>
              <span className="job-step-icon"><StepIcon state={step.state}/></span>
              <span className="job-step-text">
                <span className="job-step-label">{step.label}</span>
                {(step.state === "current" || step.state === "blocked") && panel !== step.id ? <span className="job-step-summary">{step.summary}</span> : null}
              </span>
            </button>
          </li>)}
        </ol>
        <ul className="job-extras" aria-label="More on this job">
          {extras.map(([id, count]) => <li key={id}>
            <button type="button" aria-current={panel === id ? "page" : undefined} data-active={panel === id || undefined} onClick={() => show(id)}>
              {extraLabels[id]}{count ? <span className="ops-scope-count">{count}</span> : null}
            </button>
          </li>)}
        </ul>
      </nav>

      <div className="job-guide-body">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {selectedStep ? <StepHead step={selectedStep} current={currentStep} onOpen={show}/> : null}

        <div data-panel="pickup">
          <PickupControl reference={job.reference} pickup={pickup} stepDone={steps.find((step) => step.id === "pickup")?.state === "done"} onChanged={changed}/>
        </div>

        {clearance ? <div data-panel="customs">
          <OpsSurface title="Customs release" description={readiness.customs_release_required ? "This route needs a recorded customs release before final delivery." : "This route does not need a recorded release."}>
            <CustomsClearanceEditor row={{ reference: job.reference, clearance, release_required: readiness.customs_release_required }} agents={customsAgents}/>
          </OpsSurface>
        </div> : null}

        <div data-panel="transit">
          <MovementControl reference={job.reference} status={job.status} eta={job.eta} currentLocation={job.current_location} carrier={job.carrier} carrierReference={job.carrier_reference} onChanged={changed}/>
        </div>

        <div data-panel="transit">
          <OpsSurface title="Move the shipment" description={`Now: ${shipmentStatusLabels[job.status]}${job.current_location ? ` · ${job.current_location}` : ""}`}>
            {job.status === "delivered" ? <p className="job-panel-line">Delivered. Nothing more to move.</p>
              : <ShipmentStatusControl reference={job.reference} status={job.status} disabled={readiness.job_closed} onChanged={changed} onFix={show}/>}
            <Link className="job-panel-link" href={`/admin/visibility?shipment=${reference}`}>Carrier tracking feed<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>
          </OpsSurface>
        </div>

        <div data-panel="invoice">
          <OpsSurface title="Invoice">
            <p className="job-panel-line">{steps.find((step) => step.id === "invoice")?.summary}</p>
            {canManageFinance ? <div className="ops-inspector-actions mt-3">
              {readiness.invoice_count === 0 ? <Link className="ops-button" data-variant="primary" data-size="sm" href={`/admin/finance/new/${reference}`}>Create invoice<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link> : null}
              {readiness.invoice_count > 0 ? <Link className="ops-button" data-variant="secondary" data-size="sm" href={`/admin/finance?q=${reference}`}>Open invoices</Link> : null}
            </div> : <p className="ops-inspector-hint mt-2">Accounts raise invoices. You can carry on with the shipment meanwhile.</p>}
          </OpsSurface>
        </div>

        {job.can_view_costs ? <div data-panel="costs">
          <OpsSurface title="Margin" action={<Link href={`/admin/jobs/${reference}/profitability`} className="ops-button" data-variant="ghost" data-size="xs">Full breakdown<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>}>
            {marginFigures ? <dl className="job-stat-row">
              <div><dt>Revenue</dt><dd>{money(marginFigures.revenue, marginFigures.currency)}</dd></div>
              <div><dt>Cost</dt><dd>{money(marginFigures.cost, marginFigures.currency)}</dd></div>
              <div><dt>Margin</dt><dd>{money(marginFigures.profit, marginFigures.currency)}{typeof marginFigures.margin === "number" ? <span> · {marginFigures.margin.toFixed(1)}%</span> : null}</dd></div>
            </dl> : null}
            {combined?.kind === "converted" ? <p className="ops-inspector-hint mt-2">Before VAT. {currencies.filter((currency) => currency !== combined.currency).join(", ")} converted to {combined.currency} at Nepal Rastra Bank rates of {combined.rates_date}.</p>
              : combined?.kind === "unconverted" ? <p className="ops-inspector-hint">Revenue and costs are in {currencies.join(" and ")}. No Nepal Rastra Bank rate for {combined.missing.join(", ")} right now, so they can’t be combined. The full breakdown shows each currency.</p>
                : marginFigures ? <p className="ops-inspector-hint mt-2">Before VAT.</p>
                  : <p className="ops-inspector-hint">No revenue or costs recorded yet.</p>}
          </OpsSurface>
        </div> : null}

        {children}
      </div>
    </div>
  </div>;
}

function StepHead({ step, current, onOpen }: { step: JobStep; current: JobStep | null; onOpen: (panel: JobPanel) => void }) {
  // One line: the step's name is already the selected item in the list and
  // the panel's own title, so only its state and what it needs are said here.
  return <header className="job-step-head" data-state={step.state}>
    <h2 className="sr-only">{step.label}</h2>
    <p><span className="job-step-head-state">{stateLabels[step.state]}</span>{step.summary}</p>
    {current && current.id !== step.id ? <button type="button" className="job-panel-link" onClick={() => onOpen(current.id)}>Go to next step: {current.label}<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></button> : null}
  </header>;
}
