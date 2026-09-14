import type { CommandCentreJob } from "../command-centre/command-centre-data";

/** Presentation priority only. Canonical workflow guards still authorize every mutation. */
export function shipmentNextAction(job: CommandCentreJob) {
  const href = `/admin/jobs/${encodeURIComponent(job.reference)}`;
  if (job.status === "exception") return { rank: 600, label: "Exception", tone: "danger" as const, title: "Review shipment exception", detail: "Review the active exception and its resolution requirements.", href: `${href}#shipment-exceptions` };
  if (job.overdue_tasks > 0) return { rank: 500, label: "Overdue", tone: "danger" as const, title: `Resolve ${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Operational work is past its due time.", href: `${href}#shipment-work` };
  if (job.required_customs_open > 0) return { rank: 400, label: "Customs", tone: "warning" as const, title: "Complete customs requirements", detail: `${job.required_customs_open} required customs item${job.required_customs_open === 1 ? " is" : "s are"} still open.`, href: `${href}#shipment-work` };
  // A completed movement must never be advertised as an active ownership gap.
  if (job.status === "delivered") return { rank: 0, label: "Delivered", tone: "success" as const, title: "Review delivery record", detail: "Review proof of delivery and remaining close-out work in the Job File.", href: `${href}#shipment-delivery` };
  if (!job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email) return { rank: 300, label: "Unassigned", tone: "violet" as const, title: "Assign shipment owner", detail: "This movement has no assigned operational owner.", href: `${href}#shipment-work` };
  if (job.priority === "urgent" || job.priority === "high") return { rank: job.priority === "urgent" ? 200 : 100, label: job.priority === "urgent" ? "Urgent" : "High priority", tone: "warning" as const, title: `Review ${job.priority}-priority shipment`, detail: "Confirm the next milestone, owner and movement commitment.", href: `${href}#shipment-work` };
  if (job.status === "out_for_delivery") return { rank: 0, label: "Delivery", tone: "info" as const, title: "Review delivery and POD", detail: "Record the delivery outcome and submit its supporting evidence.", href: `${href}#shipment-delivery` };
  if (job.open_tasks > 0) return { rank: 0, label: "Open work", tone: "info" as const, title: `Complete ${job.open_tasks} open task${job.open_tasks === 1 ? "" : "s"}`, detail: "Open the Job File for the current operational checklist.", href: `${href}#shipment-work` };
  return { rank: 0, label: "Active", tone: "info" as const, title: "Review shipment record", detail: "No blocking task is exposed in this register. Check the Job File for full readiness.", href };
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareShipmentPriority(a: CommandCentreJob, b: CommandCentreJob) {
  return shipmentNextAction(b).rank - shipmentNextAction(a).rank ||
    b.overdue_tasks - a.overdue_tasks ||
    b.required_customs_open - a.required_customs_open ||
    timestamp(b.updated_at) - timestamp(a.updated_at) || a.reference.localeCompare(b.reference);
}

export function shipmentNeedsAttention(job: CommandCentreJob) { return shipmentNextAction(job).rank > 0; }
