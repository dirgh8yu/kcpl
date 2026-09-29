import type { CommandCentreJob } from "../command-centre/command-centre-data";
import type { JobStepId } from "../jobs/[reference]/job-steps.ts";

// Presentation priority only. Canonical workflow guards still authorize every mutation.

/** What each Job File step asks of staff, as a short instruction. */
const stepActions: Record<JobStepId, string> = {
  booking: "Link the customer",
  pickup: "Book the pickup",
  documents: "Check documents",
  customs: "Finish customs",
  transit: "Move the shipment on",
  delivery: "Deliver",
  proof: "Check proof of delivery",
  invoice: "Raise the invoice",
  close: "Close the job",
};

/**
 * The one next action for a shipment row. Problems that need someone now
 * (an exception, overdue tasks, a stuck step) come first; otherwise the row
 * says exactly what the Job File's checklist says, and links to that step.
 * Rows whose Job File has not been opened since this was added fall back to
 * what the list itself knows.
 */
export function shipmentNextAction(job: CommandCentreJob) {
  const base = `/admin/jobs/${encodeURIComponent(job.reference)}`;
  const at = (step: string) => `${base}?step=${step}`;
  const step = job.workflow_step && job.workflow_step.state !== "done" ? job.workflow_step : null;
  const fromStep = step ? { title: stepActions[step.id], detail: step.summary, href: at(step.id) } : null;

  if (job.status === "exception") return { rank: 600, label: "Problem", tone: "danger" as const, title: "Sort out the problem", detail: "This shipment is marked as a problem.", href: at("problems") };
  if (job.overdue_tasks > 0) return { rank: 500, label: "Overdue", tone: "danger" as const, title: `Finish ${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Work on this shipment is past its due time.", href: at("tasks") };
  if (step?.state === "blocked") return { rank: 450, label: "Stuck", tone: "danger" as const, ...fromStep! };
  if (step && (step.id === "documents" || step.id === "customs")) return { rank: 400, label: step.label, tone: "warning" as const, ...fromStep! };
  if (!step && job.required_customs_open > 0) return { rank: 400, label: "Customs", tone: "warning" as const, title: "Finish customs", detail: `${job.required_customs_open} customs step${job.required_customs_open === 1 ? " is" : "s are"} still open.`, href: at("customs") };
  // A delivered shipment is never advertised as an ownership gap.
  if (job.status === "delivered") return { rank: 0, label: "Delivered", tone: "success" as const, ...(fromStep ?? { title: "Close the job", detail: "Check the proof of delivery and anything left before closing.", href: at("close") }) };
  if (!job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email) return { rank: 300, label: "No owner", tone: "violet" as const, title: "Give it an owner", detail: "Nobody owns this shipment yet.", href: at("booking") };
  if (job.priority === "urgent" || job.priority === "high") return { rank: job.priority === "urgent" ? 200 : 100, label: job.priority === "urgent" ? "Urgent" : "High priority", tone: "warning" as const, ...(fromStep ?? { title: "Check the next step", detail: "A raised-priority shipment: confirm what happens next and who does it.", href: base }) };
  if (fromStep) return { rank: 0, label: step!.label, tone: "info" as const, ...fromStep };
  if (job.status === "out_for_delivery") return { rank: 0, label: "Delivery", tone: "info" as const, title: "Record the delivery", detail: "Record how the delivery went and upload the proof.", href: at("delivery") };
  if (job.open_tasks > 0) return { rank: 0, label: "Open tasks", tone: "info" as const, title: `Finish ${job.open_tasks} open task${job.open_tasks === 1 ? "" : "s"}`, detail: "Open the shipment for its checklist.", href: at("tasks") };
  return { rank: 0, label: "Active", tone: "info" as const, title: "Open the checklist", detail: "Open the shipment to see its next step.", href: base };
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
