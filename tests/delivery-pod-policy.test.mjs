import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryAttemptTransitionAllowed,
  deliveryOutcomeValid,
  deriveDeliveryState,
  podFileAccepted,
  summarizeDelivery,
} from "../app/admin/delivery/delivery-control.ts";

test("delivery attempt lifecycle only allows controlled terminal transitions", () => {
  assert.equal(deliveryAttemptTransitionAllowed("scheduled", "out_for_delivery"), true);
  assert.equal(deliveryAttemptTransitionAllowed("scheduled", "delivered"), true);
  assert.equal(deliveryAttemptTransitionAllowed("out_for_delivery", "failed"), true);
  assert.equal(deliveryAttemptTransitionAllowed("out_for_delivery", "refused"), true);
  assert.equal(deliveryAttemptTransitionAllowed("delivered", "out_for_delivery"), false);
  assert.equal(deliveryAttemptTransitionAllowed("failed", "delivered"), false);
});

test("delivery outcomes require defensible recipient or failure detail", () => {
  assert.equal(deliveryOutcomeValid("scheduled", { scheduledFor: "2026-08-23T02:00:00.000Z" }), true);
  assert.equal(deliveryOutcomeValid("scheduled", { scheduledFor: "" }), false);
  assert.equal(deliveryOutcomeValid("delivered", { recipientName: "Ram" }), true);
  assert.equal(deliveryOutcomeValid("delivered", { recipientName: "R" }), false);
  assert.equal(deliveryOutcomeValid("failed", { failureReason: "Closed" }), true);
  assert.equal(deliveryOutcomeValid("refused", { failureReason: "No" }), false);
});

test("POD files are restricted to safe evidence types and twelve megabytes", () => {
  assert.equal(podFileAccepted("image/jpeg", 1000), true);
  assert.equal(podFileAccepted("image/png", 12 * 1024 * 1024), true);
  assert.equal(podFileAccepted("application/pdf", 5000), true);
  assert.equal(podFileAccepted("text/html", 5000), false);
  assert.equal(podFileAccepted("image/jpeg", 12 * 1024 * 1024 + 1), false);
  assert.equal(podFileAccepted("image/jpeg", 0), false);
});

test("delivery state distinguishes carrier delivery from verified POD", () => {
  assert.equal(deriveDeliveryState({ shipmentStatus: "out_for_delivery", attemptStatus: null, podStatus: "not_received" }), "delivery_active");
  assert.equal(deriveDeliveryState({ shipmentStatus: "out_for_delivery", attemptStatus: "failed", podStatus: "not_received" }), "delivery_failed");
  assert.equal(deriveDeliveryState({ shipmentStatus: "delivered", attemptStatus: "delivered", podStatus: "received" }), "delivered_pod_pending");
  assert.equal(deriveDeliveryState({ shipmentStatus: "delivered", attemptStatus: "delivered", podStatus: "verified" }), "pod_verified");
});

test("delivery summary keeps POD-pending work visible", () => {
  const base = {
    reference: "S1", quote_reference: "Q1", customer_id: null, customer_name: "Customer",
    origin: "Kathmandu", destination: "Birgunj", mode: "road", primary_branch: "Kathmandu",
    status: "out_for_delivery", attempt_count: 0, last_attempt_status: null, last_attempt_at: null,
    pod_status: "not_received", pod_evidence_count: 0, recipient_name: null, next_delivery_at: null,
    current_location: null, updated_at: "2026-08-22T00:00:00.000Z",
  };
  const summary = summarizeDelivery([
    { ...base, reference: "S1", delivery_state: "not_started" },
    { ...base, reference: "S2", delivery_state: "delivery_active" },
    { ...base, reference: "S3", delivery_state: "delivery_failed" },
    { ...base, reference: "S4", status: "delivered", delivery_state: "delivered_pod_pending", pod_status: "received" },
    { ...base, reference: "S5", status: "delivered", delivery_state: "pod_verified", pod_status: "verified" },
  ]);
  assert.deepEqual(summary, { ready: 1, out_for_delivery: 1, failed_or_refused: 1, delivered_pod_pending: 1, pod_verified: 1 });
});
