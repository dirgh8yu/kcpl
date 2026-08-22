"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, FileCheck2, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import { deliveryAttemptStatusLabels, podEvidenceKinds, type DeliveryAttempt, type DeliveryAttemptStatus, type PodEvidence, type PodEvidenceKind } from "../../delivery/delivery-control";

type DeliveryResponse = {
  ok: boolean;
  error?: string;
  attempts?: DeliveryAttempt[];
  evidence?: PodEvidence[];
  pod_status?: "not_received" | "received" | "rejected" | "verified";
  attempt?: DeliveryAttempt;
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date) + " NPT";
}
function toIso(value: string) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function statusTone(status: DeliveryAttemptStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "failed" || status === "refused") return "danger";
  if (status === "out_for_delivery") return "info";
  return "warning";
}

export function DeliveryPodControl({ reference, initialAttempts, initialEvidence, initialPodStatus, canReview }: {
  reference: string;
  initialAttempts: DeliveryAttempt[];
  initialEvidence: PodEvidence[];
  initialPodStatus: "not_received" | "received" | "rejected" | "verified";
  canReview: boolean;
}) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [podStatus, setPodStatus] = useState(initialPodStatus);
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

  async function refresh() {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/delivery`, { cache: "no-store" });
    const data = await response.json() as DeliveryResponse;
    if (!response.ok || !data.ok || !data.attempts || !data.evidence || !data.pod_status) throw new Error(data.error || "Delivery Control could not be refreshed.");
    setAttempts(data.attempts); setEvidence(data.evidence); setPodStatus(data.pod_status);
    if (!data.attempts.some((item) => item.id === selectedAttemptId)) setSelectedAttemptId(data.attempts[0]?.id ?? "");
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/delivery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as DeliveryResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "Delivery action failed.");
    return data;
  }

  async function scheduleAttempt(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "schedule", ...schedule, scheduledFor: toIso(schedule.scheduledFor) });
      await refresh();
      if (data.attempt) setSelectedAttemptId(data.attempt.id);
      setSchedule({ scheduledFor: "", location: "", driverName: "", driverPhone: "", vehicleReference: "", notes: "" });
      setNotice({ tone: "success", text: "Delivery attempt scheduled and written to the Job File audit trail." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Delivery attempt could not be scheduled." }); }
    finally { setBusy(false); }
  }

  async function updateAttempt(status: DeliveryAttemptStatus) {
    if (!selectedAttempt) return;
    setBusy(true); setNotice(null);
    try {
      await post({ action: "update_attempt", attemptId: selectedAttempt.id, status, ...outcome, eventTime: toIso(outcome.eventTime) });
      await refresh();
      setNotice({ tone: status === "delivered" ? "success" : status === "failed" || status === "refused" ? "warning" : "success", text: status === "delivered" ? "Delivery recorded. POD evidence is now required for closeout." : status === "failed" || status === "refused" ? "Delivery exception recorded and surfaced to Operations." : "Shipment moved to Out for delivery." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Delivery attempt could not be updated." }); }
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
      if (!response.ok || !data.ok) throw new Error(data.error || "POD evidence upload failed.");
      setFile(null); await refresh();
      setNotice({ tone: "success", text: "POD evidence stored privately in Firebase Storage and hash-tracked in the Job File." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "POD evidence could not be uploaded." }); }
    finally { setBusy(false); }
  }

  async function review(decision: "verify" | "reject") {
    if (!deliveredAttempt) return;
    setBusy(true); setNotice(null);
    try {
      await post({ action: "review_pod", attemptId: deliveredAttempt.id, decision, note: reviewNote, customerSafe });
      await refresh();
      setNotice({ tone: decision === "verify" ? "success" : "warning", text: decision === "verify" ? "POD verified. A sealed POD manifest is now a verified Document Vault record and the Job File closeout gate can use it." : "POD rejected. New evidence can be uploaded for another review." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "POD review could not be completed." }); }
    finally { setBusy(false); }
  }

  const podTone = podStatus === "verified" ? "success" : podStatus === "rejected" ? "danger" : podStatus === "received" ? "warning" : "neutral";

  return <section id="delivery-pod" className="ops-content ops-stack scroll-mt-20">
    <OpsSurface eyebrow="Final mile" title="Delivery & POD Control" description="Delivery attempts, consignee outcomes and private proof-of-delivery evidence. Verified POD is sealed into Document Vault and becomes part of controlled Job File closeout." action={<div className="flex items-center gap-2"><OpsBadge tone={podTone}>POD {podStatus.replaceAll("_", " ")}</OpsBadge><OpsButton size="sm" variant="ghost" onClick={() => { setBusy(true); refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false)); }} disabled={busy}><RefreshCw size={12}/>Refresh</OpsButton></div>}>
      {notice ? <OpsNotice tone={notice.tone}>{notice.text}</OpsNotice> : null}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <form onSubmit={scheduleAttempt} className="rounded-[12px] border border-[#e7dfd8] bg-[#fcfaf8] p-4">
            <div className="mb-3 flex items-center gap-2"><Truck size={14}/><h3 className="text-[12px] font-bold text-[#4d453f]">Schedule delivery attempt</h3></div>
            <div className="grid gap-3 sm:grid-cols-2"><OpsField label="Delivery date / time"><input className="ops-input" type="datetime-local" value={schedule.scheduledFor} onChange={(event) => setSchedule((current) => ({ ...current, scheduledFor: event.target.value }))} required/></OpsField><OpsField label="Delivery location"><input className="ops-input" value={schedule.location} onChange={(event) => setSchedule((current) => ({ ...current, location: event.target.value }))} placeholder="Consignee / delivery address"/></OpsField><OpsField label="Driver"><input className="ops-input" value={schedule.driverName} onChange={(event) => setSchedule((current) => ({ ...current, driverName: event.target.value }))}/></OpsField><OpsField label="Vehicle reference"><input className="ops-input" value={schedule.vehicleReference} onChange={(event) => setSchedule((current) => ({ ...current, vehicleReference: event.target.value }))}/></OpsField></div>
            <OpsField label="Instructions / notes"><textarea className="ops-textarea" value={schedule.notes} onChange={(event) => setSchedule((current) => ({ ...current, notes: event.target.value }))}/></OpsField>
            <div className="mt-3 flex justify-end"><OpsButton type="submit" variant="primary" disabled={busy}><Truck size={12}/>Schedule attempt</OpsButton></div>
          </form>

          <div className="rounded-[12px] border border-[#e7dfd8] bg-white p-4">
            <h3 className="text-[12px] font-bold text-[#4d453f]">Attempt history</h3>
            {!attempts.length ? <div className="mt-3"><OpsEmptyState icon={<Truck size={16}/>} title="No delivery attempts" description="Schedule the first final-mile attempt when the shipment is ready."/></div> : <div className="mt-3 space-y-2">{attempts.map((attempt) => <button key={attempt.id} type="button" onClick={() => setSelectedAttemptId(attempt.id)} className={`w-full rounded-[10px] border p-3 text-left ${selectedAttemptId === attempt.id ? "border-[#d9aa96] bg-[#fff8f4]" : "border-[#ebe4de] bg-[#fdfcfb]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-[#4f4741]">Attempt {attempt.attempt_number}</span><OpsBadge tone={statusTone(attempt.status)}>{deliveryAttemptStatusLabels[attempt.status]}</OpsBadge></div><div className="mt-1 text-[10px] text-[#8c827a]">{attempt.event_time ? dateTime(attempt.event_time) : attempt.scheduled_for ? `Scheduled ${dateTime(attempt.scheduled_for)}` : dateTime(attempt.updated_at)}{attempt.location ? ` · ${attempt.location}` : ""}</div>{attempt.failure_reason ? <div className="mt-2 text-[10px] text-[#9c594d]">{attempt.failure_reason}</div> : null}</button>)}</div>}
          </div>
        </div>

        <div className="space-y-4">
          {selectedAttempt && (selectedAttempt.status === "scheduled" || selectedAttempt.status === "out_for_delivery") ? <div className="rounded-[12px] border border-[#e7dfd8] bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-[12px] font-bold text-[#4d453f]">Record attempt {selectedAttempt.attempt_number}</h3><OpsBadge tone={statusTone(selectedAttempt.status)}>{deliveryAttemptStatusLabels[selectedAttempt.status]}</OpsBadge></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><OpsField label="Event time"><input className="ops-input" type="datetime-local" value={outcome.eventTime} onChange={(event) => setOutcome((current) => ({ ...current, eventTime: event.target.value }))}/></OpsField><OpsField label="Location"><input className="ops-input" value={outcome.location} onChange={(event) => setOutcome((current) => ({ ...current, location: event.target.value }))}/></OpsField><OpsField label="Recipient name"><input className="ops-input" value={outcome.recipientName} onChange={(event) => setOutcome((current) => ({ ...current, recipientName: event.target.value }))}/></OpsField><OpsField label="Recipient relationship"><input className="ops-input" value={outcome.recipientRelation} onChange={(event) => setOutcome((current) => ({ ...current, recipientRelation: event.target.value }))} placeholder="Consignee / warehouse / agent"/></OpsField></div><OpsField label="Failure / refusal reason"><textarea className="ops-textarea" value={outcome.failureReason} onChange={(event) => setOutcome((current) => ({ ...current, failureReason: event.target.value }))}/></OpsField><div className="mt-3 flex flex-wrap gap-2"><OpsButton variant="secondary" onClick={() => updateAttempt("out_for_delivery")} disabled={busy || selectedAttempt.status === "out_for_delivery"}><Truck size={12}/>Out for delivery</OpsButton><OpsButton variant="primary" onClick={() => updateAttempt("delivered")} disabled={busy}><PackageCheck size={12}/>Delivered</OpsButton><OpsButton variant="secondary" onClick={() => updateAttempt("failed")} disabled={busy}>Failed attempt</OpsButton><OpsButton variant="danger" onClick={() => updateAttempt("refused")} disabled={busy}>Refused</OpsButton></div></div> : null}

          {deliveredAttempt ? <div className="rounded-[12px] border border-[#e7dfd8] bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="text-[12px] font-bold text-[#4d453f]">Proof of Delivery</h3><p className="mt-1 text-[10px] text-[#8b8179]">Delivered {dateTime(deliveredAttempt.event_time)} · {deliveredAttempt.recipient_name || "Recipient not recorded"}</p></div><OpsBadge tone={podTone}>{podStatus.replaceAll("_", " ")}</OpsBadge></div>
            <form onSubmit={uploadEvidence} className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_auto]"><select className="ops-select" value={evidenceKind} onChange={(event) => setEvidenceKind(event.target.value as PodEvidenceKind)}>{podEvidenceKinds.map((kind) => <option key={kind} value={kind}>{kind[0].toUpperCase() + kind.slice(1)}</option>)}</select><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="ops-input" disabled={podStatus === "verified"}/><OpsButton type="submit" variant="secondary" disabled={!file || busy || podStatus === "verified"}><Camera size={12}/>Upload</OpsButton></form>
            <div className="mt-4 space-y-2">{!attemptEvidence.length ? <OpsEmptyState icon={<Camera size={16}/>} title="No POD evidence yet" description="Upload a delivery photo, signature or POD document. Files remain private in Firebase Storage."/> : attemptEvidence.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#ece5df] bg-[#fcfaf8] p-3"><div><div className="text-[11px] font-bold text-[#514943]">{item.filename}</div><div className="mt-1 text-[10px] text-[#91877f]">{item.kind} · {(item.size_bytes / 1024).toFixed(1)} KB · SHA-256 {item.sha256.slice(0, 12)}…</div></div><div className="flex items-center gap-2"><OpsBadge tone={item.review_status === "verified" ? "success" : item.review_status === "rejected" ? "danger" : "warning"}>{item.review_status}</OpsBadge><a href={`/api/admin/jobs/${encodeURIComponent(reference)}/delivery/evidence?evidenceId=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" className="ops-button" data-variant="ghost" data-size="sm">View</a></div></div>)}</div>
            {canReview && podStatus !== "verified" && attemptEvidence.length ? <div className="mt-4 border-t border-[#eee6e0] pt-4"><div className="flex items-center gap-2"><ShieldCheck size={13}/><h4 className="text-[11px] font-bold text-[#514943]">POD verification</h4></div><OpsField label="Review note"><textarea className="ops-textarea" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Record any verification or rejection note."/></OpsField><label className="mt-2 flex items-center gap-2 text-[10px] text-[#6f665f]"><input type="checkbox" checked={customerSafe} onChange={(event) => setCustomerSafe(event.target.checked)}/>This verified POD packet may be exposed to a future authenticated customer portal.</label><div className="mt-3 flex flex-wrap gap-2"><OpsButton variant="primary" onClick={() => review("verify")} disabled={busy}><FileCheck2 size={12}/>Verify & seal POD</OpsButton><OpsButton variant="danger" onClick={() => review("reject")} disabled={busy}>Reject evidence</OpsButton></div></div> : null}
            {podStatus === "verified" ? <div className="mt-4"><OpsNotice tone="success"><span className="inline-flex items-center gap-2"><CheckCircle2 size={13}/>Verified POD is immutable and is now part of Document Vault closeout evidence.</span></OpsNotice></div> : null}
          </div> : null}
        </div>
      </div>
    </OpsSurface>
  </section>;
}
