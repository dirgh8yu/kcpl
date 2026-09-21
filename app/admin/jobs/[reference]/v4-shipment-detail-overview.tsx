"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { DigitalJobFile, JobTask } from "../../job-file";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { shipmentStatusLabels } from "../../../shipment-types";
import { OpsBadge, OpsFact, OpsFacts, OpsKpiRail, OpsPageHeader, OpsRailMetric, OpsSurface } from "../../operations-ui";
import { priorityTone, statusTone } from "../../shipments/shipments-views";

type RecordSection =
  | "summary" | "movement" | "tasks" | "customs" | "documents"
  | "exceptions" | "delivery" | "commercial" | "activity";

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
  const [section, setSection] = useState<RecordSection>("summary");
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
  const openTaskCount = job.tasks.filter((task) => !task.completed).length;

  // These were anchor links into one 7,000px page: the bar looked like tabs but
  // only jump-scrolled, so every section stayed mounted and the record could
  // never be read one concern at a time. They are real tabs now; the panels
  // themselves are hidden by CSS keyed on data-section, which keeps the
  // server-rendered sections exactly where they are in the tree.
  const navigation = [
    ["Summary", "summary"],
    ["Movement", "movement"],
    ["Tasks", "tasks"],
    ["Customs", "customs"],
    ["Documents", "documents"],
    ["Exceptions", "exceptions"],
    ["Delivery", "delivery"],
    ["Commercial", "commercial"],
    ["Activity", "activity"],
  ] as const;

  // Arrow keys move between record tabs (WAI-ARIA tabs pattern).
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const index = navigation.findIndex(([, key]) => key === section);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? navigation.length - 1
        : event.key === "ArrowRight" ? (index + 1) % navigation.length
          : (index - 1 + navigation.length) % navigation.length;
    event.preventDefault();
    setSection(navigation[nextIndex][1]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[nextIndex]?.focus();
  }

  const delivery = readiness.proof_of_delivery_present ? "POD on file" : job.status === "delivered" ? "POD missing" : "Not reached";

  return <div className="shipment-detail-v2 job-record" data-section={section} data-surface-density="compact">
    <OpsPageHeader
      eyebrow={<span className="ops-mono job-record-kicker">{job.reference}{job.quote_reference ? ` · ${job.quote_reference}` : ""}</span>}
      title={<span className="job-record-title">{job.origin || "Origin"} → {job.destination || "Destination"}<OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></span>}
      description={`${job.customer_name || "Customer not linked"} · ${job.carrier || "Carrier not set"} · ${job.mode || "Mode not set"}${job.carrier_reference ? ` · ${job.carrier_reference}` : ""}`}
      meta={<><span>ETA {shortDate(job.eta)}</span><span>Owner {owner}</span><span>{job.primary_branch}</span></>}
      actions={(
        <>
          <Link className="ops-button" data-variant="secondary" data-size="md" href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`}>Delivery & POD</Link>
          <Link className="ops-button" data-variant="primary" data-size="md" href={`/admin/notifications?shipment=${encodeURIComponent(job.reference)}`}>Customer update</Link>
        </>
      )}
    />

    <nav className="job-record-tabs" aria-label="Shipment record sections">
      <div className="job-record-tabs-inner" role="tablist" aria-label="Shipment record sections">
        {navigation.map(([label, key]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className="ops-scope-tab"
            aria-selected={section === key}
            tabIndex={section === key ? 0 : -1}
            data-active={section === key || undefined}
            onClick={() => setSection(key)}
            onKeyDown={onTabKeyDown}
          >
            {label}
            {key === "tasks" && openTaskCount ? <span className="ops-scope-count">{openTaskCount}</span> : null}
          </button>
        ))}
      </div>
    </nav>

    <div className="job-record-body">
      <section id="shipment-overview" className="shipment-detail-anchor job-summary" aria-label="Shipment summary">
        {/* Readiness as one rail, the same language as the registers. */}
        <OpsKpiRail label="Record readiness">
          <OpsRailMetric label="Open tasks" value={readiness.open_tasks} tone={readiness.open_tasks ? "warning" : "neutral"} onClick={() => setSection("tasks")} title="Open the Tasks tab"/>
          <OpsRailMetric label="Customs" value={customsValue(readiness)} tone={readiness.customs_ready ? "success" : readiness.customs_release_required ? "warning" : "neutral"} onClick={() => setSection("customs")} title="Open the Customs tab"/>
          <OpsRailMetric label="Documents" value={readiness.document_pack_ready ? "Ready" : `${verifiedDocuments}/${requiredDocuments.length} verified`} tone={readiness.document_pack_ready ? "success" : "warning"} onClick={() => setSection("documents")} title="Open the Documents tab"/>
          <OpsRailMetric label="Delivery" value={delivery} tone={readiness.proof_of_delivery_present ? "success" : job.status === "delivered" ? "danger" : "neutral"} onClick={() => setSection("delivery")} title="Open the Delivery tab"/>
          <OpsRailMetric label="Gates" value={readiness.blockers.length ? `${readiness.blockers.length} open` : "Clear"} tone={readiness.blockers.length ? "warning" : "success"}/>
        </OpsKpiRail>

        <div className="job-summary-grid">
          <div className="job-summary-main">
            <OpsSurface title="Workflow" description={currentStage ? <><strong>{currentStage.title}</strong> · {currentStage.detail}</> : shipmentStatusLabels[job.status]}>
              <ol className="job-stepper" aria-label="Shipment workflow">
                {readiness.stages.map((stage) => (
                  <li key={stage.id} data-state={stage.state}>
                    <Link href={stageHref(stage.id, job.reference)} aria-current={stage.state === "current" ? "step" : undefined}>
                      <span className="job-stepper-dot" aria-hidden="true"/>
                      {stage.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </OpsSurface>

            <OpsSurface title="Record details">
              <OpsFacts columns={2}>
                <OpsFact label="Current location">{job.current_location || "Not updated"}</OpsFact>
                <OpsFact label="Priority"><OpsBadge tone={priorityTone(job.priority)}>{job.priority}</OpsBadge></OpsFact>
                <OpsFact label="Internal ref">{job.internal_reference || "Not set"}</OpsFact>
                <OpsFact label="Branch">{job.primary_branch}</OpsFact>
              </OpsFacts>
            </OpsSurface>

            {job.can_view_costs ? (
              <OpsSurface title="Job economics" action={<Link href={`/admin/jobs/${encodeURIComponent(job.reference)}/profitability`} className="ops-button" data-variant="ghost" data-size="xs">Profitability<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>}>
                {firstCurrency ? (
                  <dl className="job-stat-row">
                    <div><dt>Revenue</dt><dd>{money(revenue, firstCurrency)}</dd></div>
                    <div><dt>Cost</dt><dd>{money(cost, firstCurrency)}</dd></div>
                    <div><dt>Margin</dt><dd>{money(profit, firstCurrency)}{typeof margin === "number" ? <span> · {margin.toFixed(1)}%</span> : null}</dd></div>
                  </dl>
                ) : <p className="ops-inspector-hint">No commercial totals recorded.</p>}
              </OpsSurface>
            ) : null}
          </div>

          <aside className="ops-inspector job-next" aria-label="Next action">
            <div className="ops-inspector-body">
              <section className="ops-inspector-section">
                <div className="ops-inspector-section-head"><h3>Next action</h3></div>
                <strong className="job-next-title">{next.title}</strong>
                <p className="ops-inspector-hint mt-1">{next.detail}</p>
                <a className="ops-button mt-3" data-variant="secondary" data-size="sm" href={next.href}>Open action<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></a>
              </section>
              <section className="ops-inspector-section">
                <OpsFacts>
                  <OpsFact label="Owner" warning={owner === "Unassigned"}>{owner}</OpsFact>
                  <OpsFact label="ETA">{shortDate(job.eta)}</OpsFact>
                  <OpsFact label="Current gates" warning={readiness.blockers.length > 0}>{readiness.blockers.length ? `${readiness.blockers.length} open` : "Clear"}</OpsFact>
                  <OpsFact label="Status">{shipmentStatusLabels[job.status]}</OpsFact>
                </OpsFacts>
              </section>
              <nav className="job-next-links" aria-label="Related workspaces">
                <Link href={`/admin/pickups?shipment=${encodeURIComponent(job.reference)}`}>Pickup</Link>
                <Link href={`/admin/visibility?shipment=${encodeURIComponent(job.reference)}`}>Tracking</Link>
                <Link href={`/admin/freight-documents?shipment=${encodeURIComponent(job.reference)}`}>Documents</Link>
              </nav>
            </div>
          </aside>
        </div>
      </section>

      {children}
    </div>
  </div>;
}
