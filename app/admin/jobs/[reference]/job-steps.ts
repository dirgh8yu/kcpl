import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types.ts";
import { pickupAppointmentStatusLabels, type PickupAppointmentStatus } from "../../pickups/pickup-appointments.ts";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";

// The Job File is one checklist: the steps a shipment goes through, in order,
// with the first unfinished one open. Each step names the panel that does its
// work, so staff act where they read instead of hunting across desks.

export const jobStepIds = ["booking", "pickup", "documents", "customs", "transit", "delivery", "proof", "invoice", "close"] as const;
export type JobStepId = (typeof jobStepIds)[number];

/** Panels that are not steps: the job's supporting records. */
export const jobExtraPanels = ["tasks", "problems", "messages", "costs", "history"] as const;
export type JobExtraPanel = (typeof jobExtraPanels)[number];
export type JobPanel = JobStepId | JobExtraPanel;

export type JobStepState = "done" | "current" | "blocked" | "upcoming" | "skipped";

export type JobStep = {
  id: JobStepId;
  label: string;
  state: JobStepState;
  /** One plain sentence: what is true now, or what is needed. */
  summary: string;
};

export type JobStepInput = {
  status: ShipmentStatus;
  customerName: string | null;
  currentLocation: string | null;
  readiness: Pick<ShipmentWorkflowReadiness,
    | "customer_linked" | "documents" | "document_pack_ready"
    | "customs_required" | "customs_completed" | "customs_checklist_ready" | "customs_release_required"
    | "customs_clearance_status" | "customs_released" | "customs_ready"
    | "proof_of_delivery_present" | "invoice_count" | "issued_invoice_count" | "paid_invoice_count"
    | "job_closed" | "close_blockers" | "can_close">;
  pickupStatus: PickupAppointmentStatus | null;
  customsHoldReason?: string | null;
};

const afterPickup: ShipmentStatus[] = ["in_transit", "customs_clearance", "out_for_delivery", "delivered"];
const afterTransit: ShipmentStatus[] = ["out_for_delivery", "delivered"];

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function buildJobSteps(input: JobStepInput): JobStep[] {
  const { readiness: r, status } = input;
  const required = r.documents.filter((item) => item.required && item.document_type !== "proof_of_delivery");
  const verified = required.filter((item) => item.present).length;
  const missing = required.filter((item) => !item.present);
  const customsNotNeeded = !r.customs_release_required && r.customs_required === 0;
  const pickedUp = input.pickupStatus === "picked_up" || afterPickup.includes(status);

  type Draft = { id: JobStepId; label: string; done: boolean; skipped?: boolean; blocked?: boolean; summary: string };
  const drafts: Draft[] = [
    {
      id: "booking",
      label: "Booking",
      done: r.customer_linked,
      summary: r.customer_linked ? `Booked for ${input.customerName || "the customer"}.` : "Link this shipment to a customer before it can move.",
    },
    {
      id: "pickup",
      label: "Pickup",
      done: pickedUp,
      skipped: !pickedUp && input.pickupStatus === "cancelled",
      summary: pickedUp
        ? input.pickupStatus === "picked_up" ? "Cargo collected." : "Cargo is already moving."
        : input.pickupStatus ? pickupAppointmentStatusLabels[input.pickupStatus] + "." : "No pickup booked yet.",
    },
    {
      id: "documents",
      label: "Documents",
      done: r.document_pack_ready,
      summary: r.document_pack_ready
        ? required.length ? `All ${plural(required.length, "required document")} checked.` : "No documents are required."
        : `${verified} of ${required.length} checked. Still needed: ${missing.map((item) => item.uploaded_count > 0 ? `${item.label} (uploaded, needs checking)` : item.label).join(", ")}.`,
    },
    {
      id: "customs",
      label: "Customs",
      done: r.customs_ready,
      skipped: customsNotNeeded,
      blocked: r.customs_clearance_status === "held",
      summary: customsNotNeeded ? "Not needed on this route."
        : r.customs_clearance_status === "held" ? `Held by customs${input.customsHoldReason ? `: ${input.customsHoldReason}` : "."}`
          : r.customs_release_required && r.customs_required === 0 ? "Add the customs steps this shipment needs."
            : !r.customs_checklist_ready ? `${r.customs_completed} of ${plural(r.customs_required, "customs step")} done.`
              : r.customs_release_required && !r.customs_released ? "Checklist done. Record the customs release."
                : r.customs_released ? "Released by customs." : "Checklist done.",
    },
    {
      id: "transit",
      label: "In transit",
      done: afterTransit.includes(status),
      blocked: status === "exception",
      summary: afterTransit.includes(status) ? "Arrived for final delivery."
        : status === "exception" ? "Marked as a problem. Resolve it, then move the shipment on."
          : `${shipmentStatusLabels[status]}${input.currentLocation ? ` · ${input.currentLocation}` : ""}.`,
    },
    {
      id: "delivery",
      label: "Delivery",
      done: status === "delivered",
      summary: status === "delivered" ? "Delivered." : status === "out_for_delivery" ? "Out for delivery now." : "Not out for delivery yet.",
    },
    {
      id: "proof",
      label: "Proof of delivery",
      done: r.proof_of_delivery_present,
      summary: r.proof_of_delivery_present ? "Proof of delivery checked." : "Needs a checked proof of delivery.",
    },
    {
      id: "invoice",
      label: "Invoice",
      done: r.issued_invoice_count > 0,
      summary: r.paid_invoice_count > 0 ? `${plural(r.paid_invoice_count, "invoice")} paid.`
        : r.issued_invoice_count > 0 ? `${plural(r.issued_invoice_count, "invoice")} sent, awaiting payment.`
          : r.invoice_count > 0 ? "Invoice drafted but not sent." : "No invoice yet.",
    },
    {
      id: "close",
      label: "Close",
      done: r.job_closed,
      summary: r.job_closed ? "Job closed." : r.can_close ? "Everything is done. Close the job." : `${plural(r.close_blockers.length, "thing")} left before closing.`,
    },
  ];

  const currentIndex = drafts.findIndex((step) => !step.done && !step.skipped);
  return drafts.map((step, index) => ({
    id: step.id,
    label: step.label,
    summary: step.summary,
    state: step.done ? "done"
      : step.skipped ? "skipped"
        : index === currentIndex ? (step.blocked ? "blocked" : "current")
          : step.blocked ? "blocked" : "upcoming",
  }));
}

const panels = new Set<string>([...jobStepIds, ...jobExtraPanels]);

/** The panel the Job File opens on: the one asked for in the URL when it is
 * real, otherwise the first unfinished step, otherwise Close. */
export function initialJobPanel(steps: JobStep[], requested: string | null | undefined): JobPanel {
  if (requested && panels.has(requested)) return requested as JobPanel;
  return steps.find((step) => step.state === "current" || step.state === "blocked")?.id ?? "close";
}
