"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Camera, CheckCircle2, FileCheck2, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsInspectorNote, OpsNotice, OpsSurface } from "../../operations-ui";
import { nepalInputToIso } from "../../nepal-time";
import { deliveryAttemptStatusLabels, podEvidenceKinds, type DeliveryAttempt, type DeliveryAttemptStatus, type PodEvidence, type PodEvidenceKind } from "../../delivery/delivery-control";

type DeliveryResponse = {
  ok: boolean;
  error?: string;
  attempts?: DeliveryAttempt[];
  evidence?: PodEvidence[];
  pod_status?: "not_received" | "received" | "rejected" | "verified";
  shipment_status?: string;
  external_observed_milestone?: string | null;
  external_observed_at?: string | null;
  external_observed_provider?: string | null;
  attempt?: DeliveryAttempt;
  attemptStatus?: string;
  canonicalStatus?: string | null;
  completionStatus?: string;
  blockerCodes?: string[];
  blockers?: string[];
  completionId?: string | null;
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date) + " NPT";
}
function statusTone(status: DeliveryAttemptStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "failed" || status === "refused") return "danger";
  if (status === "out_for_delivery") return "info";
  return "warning";
}
function pretty(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }

export function DeliveryPodControl({
  reference,
  initialAttempts,
  initialEvidence,
  initialPodStatus,
  initialShipmentStatus,
  initialExternalObservedMilestone,
  initialExternalObservedAt,
  initialExternalObservedProvider,
  canReview,
}: {
  reference: string;
  initialAttempts: DeliveryAttempt[];
  initialEvidence: PodEvidence[];
  initialPodStatus: "not_received" | "received" | "rejected" | "verified";
  initialShipmentStatus: string;
  initialExternalObservedMilestone: string | null;
  initialExternalObservedAt: string | null;
  initialExternalObservedProvider: string | null;
  canReview: boolean;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(initialAttempts);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [podStatus, setPodStatus] = useState(initialPodStatus);
  const [shipmentStatus, setShipmentStatus] = useState(initialShipmentStatus);
  const [externalObservedMilestone, setExternalObservedMilestone] = useState(initialExternalObservedMilestone);
  const [externalObservedAt, setExternalObservedAt] = useState(initialExternalObservedAt);
  const [externalObservedProvider, setExternalObservedProvider] = useState(initialExternalObservedProvider);
  const [completionBlockers, setCompletionBlockers] = useState<string[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(initialAttempts.find((item) => item.status === "scheduled" || item.status === "out_for_delivery")?.id ?? initialAttempts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [schedule, setSchedule] = useState({ scheduledFor: "", location: "", driverName: "", driverPhone: "", vehicleReference: "", notes: "" });
  const [outcome, setOutcome] = useState({ eventTime: "", location: "", recipientName: "", recipientPhone: "", recipientRelation: "", failureReason: "", notes: "" });
  const [evidenceKind, setEvidenceKind] = useState<PodEvidenceKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [customerSafe, setCustomerSafe] = useState(false);

  const selectedAttempt = attempts.find((item) => item.id === selectedAttemptId) ?? null;
  const deliveredAttempt = selectedAttempt?.status === "delivered" ? selectedAttempt : attempts.find((item) => item.status === "delivered") ?? null;
  const attemptEvidence = deliveredAttempt ? evidence.filter((item) => item.attempt_id === deliveredAttempt.id) : [];
  const externalDeliveredAvailable = shipmentStatus !== "delivered" && !deliveredAttempt && externalObservedMilestone === "delivered";

  function consumeCompletion(data: DeliveryResponse) {
    if (data.canonicalStatus) setShipmentStatus(data.canonicalStatus);
    setCompletionBlockers(data.blockers ?? []);
  }

  async function refresh() {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/delivery`, { cache: "no-store" });
    const data = await response.json() as DeliveryResponse;
    if (!response.ok || !data.ok || !data.attempts || !data.evidence || !data.pod_status) throw new Error(data.error || "Delivery Control could not be refreshed.");
    setAttempts(data.attempts);
    setEvidence(data.evidence);
    setPodStatus(data.pod_status);
    if (data.shipment_status) setShipmentStatus(data.shipment_status);
    setExternalObservedMilestone(data.external_observed_milestone ?? null);
    setExternalObservedAt(data.external_observed_at ?? null);
    setExternalObservedProvider(data.external_observed_provider ?? null);
    if (!data.attempts.some((item) => item.id === selectedAttemptId)) setSelectedAttemptId(data.attempts[0]?.id ?? "");
    // Delivery and proof are Job File steps; bring the step list up to date.
    router.refresh();
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/delivery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as DeliveryResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "Delivery action failed.");
    consumeCompletion(data);
    return data;
  }

  async function scheduleAttempt(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "schedule", ...schedule, scheduledFor: nepalInputToIso(schedule.scheduledFor) });
      await refresh();
      if (data.attempt) setSelectedAttemptId(data.attempt.id);
      setSchedule({ scheduledFor: "", location: "", driverName: "", driverPhone: "", vehicleReference: "", notes: "" });
      setNotice({ tone: "success", text: "Delivery attempt scheduled and written to the Job File audit trail." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Delivery attempt could not be scheduled." }); }
    finally { setBusy(false); }
  }

  async function adoptDelivered() {
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "adopt_delivered" });
      await refresh();
      if (data.attempt) setSelectedAttemptId(data.attempt.id);
      const pending = data.blockers?.length ? ` It can’t be marked Delivered yet: ${data.blockers.join(" ")}` : "";
      setNotice({ tone: data.completionStatus === "complete" ? "success" : "warning", text: `The carrier’s “delivered” update is now recorded as the delivery. Recipient details were left blank.${pending}` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "The carrier’s update couldn’t be recorded. Try again." }); }
    finally { setBusy(false); }
  }

  async function updateAttempt(status: DeliveryAttemptStatus) {
    if (!selectedAttempt) return;
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "update_attempt", attemptId: selectedAttempt.id, status, ...outcome, eventTime: nepalInputToIso(outcome.eventTime) });
      await refresh();
      if (status === "delivered") {
        const completed = data.completionStatus === "complete" || data.completionStatus === "already_complete";
        setNotice({
          tone: completed ? "success" : "warning",
          text: completed
            ? "Delivery recorded. The shipment is now Delivered."
            : `Delivery recorded. The shipment isn’t marked Delivered yet.${data.blockers?.length ? ` ${data.blockers.join(" ")}` : " Some checks are still open."}`,
        });
      } else {
        setNotice({ tone: status === "failed" || status === "refused" ? "warning" : "success", text: status === "failed" || status === "refused" ? "Delivery exception recorded and surfaced to Operations." : "Shipment moved to Out for delivery." });
      }
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Delivery attempt could not be updated." }); }
    finally { setBusy(false); }
  }

  async function reconcile() {
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "reconcile_delivery" });
      await refresh();
      const complete = data.completionStatus === "complete" || data.completionStatus === "already_complete";
      setNotice({ tone: complete ? "success" : "warning", text: complete ? "The shipment is now Delivered." : `Not Delivered yet.${data.blockers?.length ? ` ${data.blockers.join(" ")}` : ""}` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "The check couldn’t run. Try again." }); }
    finally { setBusy(false); }
  }

  async function uploadEvidence(event: FormEvent) {
    event.preventDefault();
    if (!deliveredAttempt || !file) return;
    setBusy(true); setNotice(null);
    try {
      const form = new FormData(); form.set("attemptId", deliveredAttempt.id); form.set("kind", evidenceKind); form.set("file", file); form.set("capturedAt", new Date().toISOString());
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/delivery/evidence`, { method: "POST", body: form });
      const data = await response.json() as DeliveryResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "The file didn’t upload. Try again.");
      setFile(null); await refresh();
      setNotice({ tone: "success", text: "File uploaded. It counts once someone checks it." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "The file didn’t upload. Try again." }); }
    finally { setBusy(false); }
  }

  async function review(decision: "verify" | "reject") {
    if (!deliveredAttempt) return;
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "review_pod", attemptId: deliveredAttempt.id, decision, note: reviewNote, customerSafe });
      await refresh();
      if (decision === "reject") {
        setNotice({ tone: "warning", text: "Proof rejected. The delivery stays recorded, but it can’t be marked Delivered until a correct proof is checked." });
      } else {
        const completed = data.completionStatus === "complete" || data.completionStatus === "already_complete";
        setNotice({
          tone: completed ? "success" : "warning",
          text: completed
            ? "Proof checked. The shipment is now Delivered."
            : `Proof checked. It can’t be marked Delivered yet.${data.blockers?.length ? ` ${data.blockers.join(" ")}` : ""}`,
        });
      }
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "POD review could not be completed." }); }
    finally { setBusy(false); }
  }

  const podTone = podStatus === "verified" ? "success" : podStatus === "rejected" ? "danger" : podStatus === "received" ? "warning" : "neutral";
  const physicalRecorded = Boolean(deliveredAttempt);
  const canonicalDelivered = shipmentStatus === "delivered";
  const completionText = canonicalDelivered
    ? "Nothing left — Delivered"
    : completionBlockers[0] ?? (physicalRecorded ? podStatus === "verified" ? "Other checks still open" : "Proof of delivery needs checking" : "Delivery not recorded yet");

  return <section id="delivery-pod" className="scroll-mt-20">
    <OpsSurface title="Delivery & proof" description="Record the delivery, upload the proof, then have someone check it. The shipment becomes Delivered once the proof is checked." action={<div className="flex items-center gap-1.5"><OpsBadge tone={canonicalDelivered ? "success" : "info"}>KCPL {pretty(shipmentStatus)}</OpsBadge><OpsButton size="xs" variant="ghost" onClick={() => { setBusy(true); refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false)); }} disabled={busy}><RefreshCw size={13} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton></div>}>
      {notice ? <div className="mb-3"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

      {/* Four controlled facts on one hairline rail instead of four cards. */}
      <dl className="job-state-rail">
        <div><dt>Physical delivery</dt><dd><OpsBadge tone={physicalRecorded ? "success" : "neutral"}>{physicalRecorded ? "Recorded" : "Not recorded"}</OpsBadge></dd>{deliveredAttempt ? <dd className="job-state-note">{dateTime(deliveredAttempt.event_time)}</dd> : null}</div>
        <div><dt>POD</dt><dd><OpsBadge tone={podTone}>{pretty(podStatus)}</OpsBadge></dd><dd className="job-state-note">Only checked proof counts.</dd></div>
        <div><dt>Shipment status</dt><dd><OpsBadge tone={canonicalDelivered ? "success" : "info"}>{pretty(shipmentStatus)}</OpsBadge></dd><dd className="job-state-note">Set automatically once everything is done.</dd></div>
        <div><dt>What’s left</dt><dd className="job-state-text">{completionText}</dd>{physicalRecorded && !canonicalDelivered ? <dd><OpsButton size="xs" variant="secondary" onClick={reconcile} disabled={busy}>Check again</OpsButton></dd> : null}</div>
      </dl>

      {externalDeliveredAvailable ? <div className="mt-3"><OpsNotice tone="warning"><div className="flex flex-wrap items-center justify-between gap-3"><span>The carrier says it’s delivered{externalObservedProvider ? ` by ${externalObservedProvider}` : ""}{externalObservedAt ? ` at ${dateTime(externalObservedAt)}` : ""}. Record it here to count it.</span><OpsButton size="xs" variant="secondary" onClick={adoptDelivered} disabled={busy}><PackageCheck size={13} strokeWidth={1.75} aria-hidden="true"/>Record delivery</OpsButton></div></OpsNotice></div> : null}

      <div className="job-delivery-grid">
        <div className="job-delivery-col">
          {canonicalDelivered ? <section className="job-subpanel"><h3>Delivered</h3><p className="ops-inspector-hint">This shipment is delivered. No more delivery attempts are needed.</p></section> : !externalDeliveredAvailable ? <section className="job-subpanel">
            <h3>Schedule delivery attempt</h3>
            <form onSubmit={scheduleAttempt} className="job-form">
              <div className="grid gap-3 sm:grid-cols-2"><OpsField label="Delivery date / time"><input className="ops-input" type="datetime-local" value={schedule.scheduledFor} onChange={(event) => setSchedule((current) => ({ ...current, scheduledFor: event.target.value }))} required/></OpsField><OpsField label="Delivery location"><input className="ops-input" value={schedule.location} onChange={(event) => setSchedule((current) => ({ ...current, location: event.target.value }))} placeholder="Consignee / delivery address"/></OpsField><OpsField label="Driver"><input className="ops-input" value={schedule.driverName} onChange={(event) => setSchedule((current) => ({ ...current, driverName: event.target.value }))}/></OpsField><OpsField label="Vehicle reference"><input className="ops-input" value={schedule.vehicleReference} onChange={(event) => setSchedule((current) => ({ ...current, vehicleReference: event.target.value }))}/></OpsField></div>
              <div className="mt-3"><OpsField label="Instructions / notes"><textarea className="ops-textarea" value={schedule.notes} onChange={(event) => setSchedule((current) => ({ ...current, notes: event.target.value }))}/></OpsField></div>
              <div className="mt-3 flex justify-end"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><Truck size={14} strokeWidth={1.75} aria-hidden="true"/>Schedule attempt</OpsButton></div>
            </form>
          </section> : null}

          <section className="job-subpanel">
            <h3>Attempt history</h3>
            {!attempts.length ? <OpsEmptyState compact title="No delivery attempts" description={externalDeliveredAvailable ? "The carrier says it’s delivered. Record that as the delivery." : "Schedule the delivery when the shipment is ready."}/> : <ul className="job-rows">{attempts.map((attempt) => <li key={attempt.id}><button type="button" onClick={() => setSelectedAttemptId(attempt.id)} className="job-select-row" data-selected={selectedAttemptId === attempt.id || undefined} aria-pressed={selectedAttemptId === attempt.id}><span className="job-row-head"><span className="job-row-title">Attempt {attempt.attempt_number}</span><OpsBadge tone={statusTone(attempt.status)}>{deliveryAttemptStatusLabels[attempt.status]}</OpsBadge></span><span className="job-row-meta"><span>{attempt.event_time ? dateTime(attempt.event_time) : attempt.scheduled_for ? `Scheduled ${dateTime(attempt.scheduled_for)}` : dateTime(attempt.updated_at)}</span>{attempt.location ? <span>{attempt.location}</span> : null}</span>{attempt.failure_reason ? <span className="job-row-detail job-row-danger">{attempt.failure_reason}</span> : null}</button></li>)}</ul>}
          </section>
        </div>

        <div className="job-delivery-col">
          {selectedAttempt && !canonicalDelivered && (selectedAttempt.status === "scheduled" || selectedAttempt.status === "out_for_delivery") ? <section className="job-subpanel">
            <div className="job-subpanel-head"><h3>Record attempt {selectedAttempt.attempt_number}</h3><OpsBadge tone={statusTone(selectedAttempt.status)}>{deliveryAttemptStatusLabels[selectedAttempt.status]}</OpsBadge></div>
            <p className="ops-inspector-hint">Recording physical delivery does not itself make the KCPL shipment Delivered.</p>
            <div className="job-form mt-2">
              <div className="grid gap-3 sm:grid-cols-2"><OpsField label="Event time"><input className="ops-input" type="datetime-local" value={outcome.eventTime} onChange={(event) => setOutcome((current) => ({ ...current, eventTime: event.target.value }))}/></OpsField><OpsField label="Location"><input className="ops-input" value={outcome.location} onChange={(event) => setOutcome((current) => ({ ...current, location: event.target.value }))}/></OpsField><OpsField label="Recipient name"><input className="ops-input" value={outcome.recipientName} onChange={(event) => setOutcome((current) => ({ ...current, recipientName: event.target.value }))}/></OpsField><OpsField label="Recipient relationship"><input className="ops-input" value={outcome.recipientRelation} onChange={(event) => setOutcome((current) => ({ ...current, recipientRelation: event.target.value }))} placeholder="Consignee / warehouse / agent"/></OpsField></div>
              <div className="mt-3"><OpsField label="Failure / refusal reason"><textarea className="ops-textarea" value={outcome.failureReason} onChange={(event) => setOutcome((current) => ({ ...current, failureReason: event.target.value }))}/></OpsField></div>
              <div className="mt-3 flex flex-wrap gap-2"><OpsButton size="sm" variant="secondary" onClick={() => updateAttempt("out_for_delivery")} disabled={busy || selectedAttempt.status === "out_for_delivery"}><Truck size={14} strokeWidth={1.75} aria-hidden="true"/>Out for delivery</OpsButton><OpsButton size="sm" variant="primary" onClick={() => updateAttempt("delivered")} disabled={busy}><PackageCheck size={14} strokeWidth={1.75} aria-hidden="true"/>Record physical delivery</OpsButton><OpsButton size="sm" variant="secondary" onClick={() => updateAttempt("failed")} disabled={busy}>Failed attempt</OpsButton><OpsButton size="sm" variant="danger" onClick={() => updateAttempt("refused")} disabled={busy}>Refused</OpsButton></div>
            </div>
          </section> : null}

          {deliveredAttempt ? <section className="job-subpanel">
            <div className="job-subpanel-head"><h3>Proof of Delivery</h3><OpsBadge tone={podTone}>{pretty(podStatus)}</OpsBadge></div>
            <p className="ops-inspector-hint">Physical delivery {dateTime(deliveredAttempt.event_time)} · {deliveredAttempt.recipient_name || "Recipient not given by the carrier"}</p>
            <form onSubmit={uploadEvidence} className="job-form job-upload mt-2"><OpsField label="Evidence type"><select className="ops-select" value={evidenceKind} onChange={(event) => setEvidenceKind(event.target.value as PodEvidenceKind)}>{podEvidenceKinds.map((kind) => <option key={kind} value={kind}>{kind[0].toUpperCase() + kind.slice(1)}</option>)}</select></OpsField><OpsField label="File"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="ops-input" disabled={podStatus === "verified"}/></OpsField><OpsButton type="submit" size="sm" variant="secondary" disabled={!file || busy || podStatus === "verified"}><Camera size={14} strokeWidth={1.75} aria-hidden="true"/>Upload</OpsButton></form>
            {!attemptEvidence.length ? <OpsEmptyState compact title="No proof uploaded yet" description="Upload a delivery photo, signature or proof of delivery. Files stay private to KCPL."/> : <ul className="job-rows mt-2">{attemptEvidence.map((item) => <li key={item.id} className="job-row"><div className="job-row-main"><span className="job-row-title">{item.filename}</span><span className="job-row-meta"><span>{item.kind}</span><span>{(item.size_bytes / 1024).toFixed(1)} KB</span><span>SHA-256 {item.sha256.slice(0, 12)}…</span></span></div><div className="job-row-actions"><OpsBadge tone={item.review_status === "verified" ? "success" : item.review_status === "rejected" ? "danger" : "warning"}>{pretty(item.review_status)}</OpsBadge><a href={`/api/admin/jobs/${encodeURIComponent(reference)}/delivery/evidence?evidenceId=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" className="ops-button" data-variant="ghost" data-size="xs">View</a></div></li>)}</ul>}
            {canReview && podStatus !== "verified" && attemptEvidence.length ? <div className="job-form mt-3"><div className="job-subpanel-head"><h4><ShieldCheck size={13} strokeWidth={1.75} aria-hidden="true"/>Check the proof</h4></div><OpsField label="Review note"><textarea className="ops-textarea" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Record any verification or rejection note."/></OpsField><label className="job-form-check mt-2"><input type="checkbox" checked={customerSafe} onChange={(event) => setCustomerSafe(event.target.checked)}/>This verified POD packet may be exposed to a future authenticated customer portal.</label><div className="mt-3 flex flex-wrap gap-2"><OpsButton size="sm" variant="primary" onClick={() => review("verify")} disabled={busy}><FileCheck2 size={14} strokeWidth={1.75} aria-hidden="true"/>Verify & reconcile</OpsButton><OpsButton size="sm" variant="danger" onClick={() => review("reject")} disabled={busy}>Reject evidence</OpsButton></div></div> : null}
            {podStatus === "verified" ? <div className="mt-3"><OpsInspectorNote tone="success" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Proof checked">The shipment becomes Delivered once the other checks are done.</OpsInspectorNote></div> : null}
          </section> : null}
        </div>
      </div>
    </OpsSurface>
  </section>;
}
