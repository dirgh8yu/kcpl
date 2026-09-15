import Link from "next/link";
import type { ReactNode } from "react";
import type { DigitalJobFile, JobTask } from "../../job-file";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { shipmentStatusLabels } from "../../../shipment-types";

function statusClass(status: DigitalJobFile["status"]) {
  if (status === "delivered") return "is-success";
  if (status === "exception") return "is-danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "is-warning";
  if (status === "in_transit" || status === "booking_confirmed") return "is-info";
  return "is-neutral";
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

function taskTime(task: JobTask) {
  if (!task.due_at) return Number.POSITIVE_INFINITY;
  const value = new Date(task.due_at).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function stageHref(stage: ShipmentWorkflowReadiness["stages"][number]["id"], reference: string) {
  const shipment = encodeURIComponent(reference);
  if (stage === "customs") return `/admin/customs?shipment=${shipment}`;
  if (stage === "documents") return `/admin/freight-documents?shipment=${shipment}`;
  if (stage === "transit") return `/admin/visibility?shipment=${shipment}`;
  if (stage === "delivery" || stage === "pod") return `/admin/delivery?shipment=${shipment}`;
  if (stage === "won") return "#shipment-overview";
  return "#shipment-work";
}

function customsNeedsSetup(readiness: ShipmentWorkflowReadiness) {
  return readiness.customs_release_required && readiness.customs_required === 0;
}

function nextAction(job: DigitalJobFile, readiness: ShipmentWorkflowReadiness) {
  const shipment = encodeURIComponent(job.reference);
  const openTask = [...job.tasks.filter((task) => !task.completed)].sort((a, b) => taskTime(a) - taskTime(b))[0];

  if (customsNeedsSetup(readiness)) {
    return {
      title: "Set customs requirements",
      detail: "This international movement has no controlled customs checklist. Add only the clearance steps that apply before release.",
      href: `/admin/customs?shipment=${shipment}`,
    };
  }
  if (!readiness.customs_checklist_ready) {
    return {
      title: "Complete customs checklist",
      detail: `${readiness.customs_completed} of ${readiness.customs_required} required steps complete.`,
      href: `/admin/customs?shipment=${shipment}`,
    };
  }
  if (readiness.customs_release_required && !readiness.customs_released) {
    return {
      title: "Record customs release",
      detail: "The required checklist is complete; explicit customs release is still required.",
      href: `/admin/customs?shipment=${shipment}`,
    };
  }
  if (!readiness.document_pack_ready) {
    return {
      title: "Verify required documents",
      detail: "Required shipment documents are missing, unverified or expired.",
      href: `/admin/freight-documents?shipment=${shipment}`,
    };
  }
  if (openTask) {
    return {
      title: openTask.title,
      detail: openTask.detail || (openTask.due_at ? `Due ${shortDate(openTask.due_at)}` : "Open operational task"),
      href: "#shipment-work",
    };
  }
  if ((job.status === "out_for_delivery" || job.status === "delivered") && !readiness.proof_of_delivery_present) {
    return {
      title: "Record proof of delivery",
      detail: "Delivery cannot be closed without verified POD evidence.",
      href: `/admin/delivery?shipment=${shipment}`,
    };
  }
  if (readiness.can_close && !readiness.job_closed) {
    return { title: "Close shipment", detail: "Operational close requirements are satisfied.", href: "#shipment-work" };
  }
  return {
    title: "No immediate action",
    detail: readiness.warnings[0] || `${shipmentStatusLabels[job.status]} · monitor the next movement update.`,
    href: "#shipment-activity",
  };
}

function customsValue(readiness: ShipmentWorkflowReadiness) {
  if (!readiness.customs_release_required) return "Not required";
  if (customsNeedsSetup(readiness)) return "Setup required";
  if (readiness.customs_released) return "Released";
  if (readiness.customs_checklist_ready) return "Release pending";
  return `${readiness.customs_completed}/${readiness.customs_required} complete`;
}

function currentStageCopy(readiness: ShipmentWorkflowReadiness) {
  const stage = readiness.stages.find((item) => item.state === "current" || item.state === "blocked");
  if (!stage) return null;
  if (stage.id === "customs" && customsNeedsSetup(readiness)) {
    return {
      title: "Customs setup",
      detail: "International lane: required customs steps have not been configured yet.",
    };
  }
  return { title: stage.label, detail: stage.detail };
}

export function V4ShipmentDetailOverview({
  job,
  readiness,
  children,
}: {
  job: DigitalJobFile;
  readiness: ShipmentWorkflowReadiness;
  children?: ReactNode;
}) {
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const requiredDocuments = readiness.documents.filter((document) => document.required);
  const verifiedDocuments = requiredDocuments.filter((document) => document.verified_count > 0).length;
  const currentStage = currentStageCopy(readiness);
  const next = nextAction(job, readiness);
  const currencies = [...new Set([...Object.keys(job.revenue_totals), ...Object.keys(job.cost_totals)])];
  const firstCurrency = currencies[0];
  const revenue = firstCurrency ? job.revenue_totals[firstCurrency as keyof typeof job.revenue_totals] ?? 0 : 0;
  const cost = firstCurrency ? job.cost_totals[firstCurrency as keyof typeof job.cost_totals] ?? 0 : 0;
  const profit = firstCurrency ? job.profit_totals[firstCurrency as keyof typeof job.profit_totals] ?? revenue - cost : revenue - cost;
  const margin = firstCurrency ? job.margin_percent[firstCurrency as keyof typeof job.margin_percent] : undefined;

  const navigation = [
    ["Summary", "#shipment-overview"],
    ["Work & file", "#shipment-work"],
    ["Exceptions", "#shipment-exceptions"],
    ["Delivery", "#shipment-delivery"],
    ["Activity", "#shipment-activity"],
  ] as const;

  return <div className="shipment-detail-v2">
    <section className="shipment-detail-summary">
      <div className="shipment-detail-inner">
        <header className="shipment-detail-header">
          <div className="shipment-detail-heading">
            <p className="shipment-detail-eyebrow">Digital job file · {job.reference}</p>
            <div className="shipment-detail-title-row">
              <h1>{job.origin || "Origin"} → {job.destination || "Destination"}</h1>
              <span className={`shipment-status ${statusClass(job.status)}`}>{shipmentStatusLabels[job.status]}</span>
            </div>
            <p className="shipment-detail-subline">{job.customer_name || "Customer not linked"} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}{job.carrier_reference ? ` · ${job.carrier_reference}` : ""}</p>
            <p className="shipment-detail-meta">ETA {shortDate(job.eta)} · Owner {owner} · {job.primary_branch}</p>
          </div>
          <div className="shipment-detail-actions">
            <Link href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`}>Delivery & POD</Link>
            <Link data-primary href={`/admin/notifications?shipment=${encodeURIComponent(job.reference)}`}>Customer update</Link>
          </div>
        </header>
      </div>
    </section>

    <nav className="shipment-record-nav" aria-label="Shipment record sections">
      <div className="shipment-detail-inner shipment-record-nav-inner">
        {navigation.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
      </div>
    </nav>

    <section className="shipment-detail-summary">
      <div id="shipment-overview" className="shipment-detail-inner shipment-overview-layout shipment-detail-anchor">
        <div className="shipment-overview-main">
          <section className="shipment-summary-section shipment-flow-section">
            <div className="shipment-section-heading">
              <p>Shipment flow</p>
              <h2>{currentStage ? currentStage.title : shipmentStatusLabels[job.status]}</h2>
              {currentStage ? <span>{currentStage.detail}</span> : null}
            </div>
            <div className="shipment-stage-line" aria-label="Shipment workflow">
              {readiness.stages.map((stage) => <Link key={stage.id} href={stageHref(stage.id, job.reference)} data-state={stage.state}>{stage.label}</Link>)}
            </div>
          </section>

          <div className="shipment-summary-grid">
            <section className="shipment-summary-section">
              <div className="shipment-section-heading"><p>Key details</p><h2>Shipment</h2></div>
              <div className="shipment-detail-register">
                <DetailRow label="Mode" value={job.mode || "Not set"}/>
                <DetailRow label="Current location" value={job.current_location || "Not updated"}/>
                <DetailRow label="Carrier" value={job.carrier || "Not set"}/>
                <DetailRow label="Carrier reference" value={job.carrier_reference || "Not set"}/>
                <DetailRow label="Priority" value={job.priority}/>
                <DetailRow label="Internal reference" value={job.internal_reference || "Not set"}/>
              </div>
            </section>

            <section className="shipment-summary-section">
              <div className="shipment-section-heading"><p>Readiness</p><h2>Open work</h2></div>
              <div className="shipment-detail-register">
                <ControlRow label="Tasks" value={readiness.open_tasks ? `${readiness.open_tasks} open` : "Clear"} tone={readiness.open_tasks ? "warning" : "success"}/>
                <ControlRow label="Customs" value={customsValue(readiness)} tone={readiness.customs_ready ? "success" : readiness.customs_release_required ? "warning" : "neutral"}/>
                <ControlRow label="Documents" value={readiness.document_pack_ready ? "Ready" : `${verifiedDocuments}/${requiredDocuments.length} verified`} tone={readiness.document_pack_ready ? "success" : "warning"}/>
                <ControlRow label="Delivery" value={readiness.proof_of_delivery_present ? "POD on file" : job.status === "delivered" ? "POD missing" : "Not reached"} tone={readiness.proof_of_delivery_present ? "success" : job.status === "delivered" ? "danger" : "neutral"}/>
              </div>
            </section>
          </div>

          {job.can_view_costs ? <section className="shipment-summary-section shipment-financial-summary">
            <div className="shipment-section-heading"><p>Financial snapshot</p><h2>Job economics</h2></div>
            {firstCurrency ? <div className="shipment-financial-grid"><Metric label="Revenue" value={money(revenue, firstCurrency)}/><Metric label="Cost" value={money(cost, firstCurrency)}/><Metric label="Margin" value={`${money(profit, firstCurrency)}${typeof margin === "number" ? ` · ${margin.toFixed(1)}%` : ""}`}/></div> : <p className="shipment-empty-line">No commercial totals recorded.</p>}
          </section> : null}
        </div>

        <aside className="shipment-next-rail">
          <p className="shipment-detail-eyebrow">Next</p>
          <h2>{next.title}</h2>
          <p className="shipment-next-detail">{next.detail}</p>
          <a className="shipment-next-link" href={next.href}>Open action →</a>
          <dl>
            <RailItem label="Owner" value={owner}/>
            <RailItem label="ETA" value={shortDate(job.eta)}/>
            <RailItem label="Current gates" value={readiness.blockers.length ? `${readiness.blockers.length} open` : "Clear"} tone={readiness.blockers.length ? "warning" : "success"}/>
            <RailItem label="Status" value={shipmentStatusLabels[job.status]}/>
          </dl>
          <div className="shipment-next-links">
            <Link href={`/admin/pickups?shipment=${encodeURIComponent(job.reference)}`}>Pickup</Link>
            <Link href={`/admin/visibility?shipment=${encodeURIComponent(job.reference)}`}>Tracking</Link>
            <Link href={`/admin/freight-documents?shipment=${encodeURIComponent(job.reference)}`}>Documents</Link>
          </div>
        </aside>
      </div>
    </section>

    <div className="shipment-detail-record">{children}</div>
  </div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="shipment-register-row"><span>{label}</span><strong>{value}</strong></div>;
}

function ControlRow({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "warning" | "danger" }) {
  return <div className="shipment-register-row" data-tone={tone}><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function RailItem({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  return <div data-tone={tone}><dt>{label}</dt><dd>{value}</dd></div>;
}
