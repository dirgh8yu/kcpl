import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileWarning } from "lucide-react";
import type { ReactNode } from "react";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import {
  getShipmentDocumentChecklist,
  listDocumentChecklistAlerts,
} from "../document-checklist.server";
import { DocumentChecklistEditor } from "../document-checklist-editor";
import type { DocumentChecklistSeverity } from "../document-checklist";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document Checklists | KCPL Operations", robots: { index: false, follow: false } };

export default async function DocumentChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment?: string; q?: string }>;
}) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Document checklists are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const query = await searchParams;
  const shipment = query.shipment?.trim().toUpperCase() || "";
  const search = query.q?.trim() || "";
  const alertsResult = await listDocumentChecklistAlerts(staff, { search });
  if (alertsResult.kind !== "ready") return <Gate title="Document checklists unavailable" detail="Firebase is not available for this deployment."/>;

  const selectedResult = shipment ? await getShipmentDocumentChecklist(shipment, staff) : null;
  const selected = selectedResult?.kind === "ready" ? selectedResult.checklist : null;
  const rows = alertsResult.rows;
  const critical = rows.filter((row) => row.severity === "critical").length;
  const missingDocuments = rows.reduce((sum, row) => sum + row.missing_count, 0);

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#b78a3e]"><ClipboardCheck size={16}/><span className="text-[10px] font-black uppercase tracking-[.16em]">KCPL Document Control</span></div>
            <h1 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#10263f]">Document checklists & missing-document alerts</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-black/50">KCPL automatically compares each shipment document requirement with the current files in the private Document Vault. Uploading the right category clears the missing status automatically.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/documents" className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[.08em] text-[#30485e]">Open Vault</Link>
          </div>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-3">
          <Metric icon={<FileWarning size={14}/>} label="Shipments missing docs" value={String(rows.length)}/>
          <Metric icon={<AlertTriangle size={14}/>} label="Critical document alerts" value={String(critical)}/>
          <Metric icon={<CheckCircle2 size={14}/>} label="Required files missing" value={String(missingDocuments)}/>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-black text-[#10263f]">Active missing-document alerts</h2>
              <p className="mt-1 text-[10px] text-black/45">Critical when a shipment is in customs/exception/delivery stages or its ETA is close.</p>
            </div>
            <form action="/admin/documents/checklists" method="get" className="flex w-full gap-2 sm:w-auto">
              <input name="q" defaultValue={search} placeholder="Shipment, customer, branch or document" className="h-9 min-w-0 flex-1 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-xs outline-none focus:border-[#b78a3e] sm:w-80"/>
              <button type="submit" className="h-9 rounded-xl bg-[#10263f] px-4 text-[9px] font-black uppercase tracking-[.08em] text-white">Search</button>
            </form>
          </div>

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead className="bg-[#f8f8f6] text-[9px] font-black uppercase tracking-[.09em] text-black/40">
                  <tr><th className="px-5 py-3">Alert</th><th className="px-5 py-3">Shipment</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Mode / branch</th><th className="px-5 py-3">Missing</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.shipment_reference} className="border-t border-black/5 text-xs text-[#405467]">
                      <td className="px-5 py-3"><SeverityPill severity={row.severity}/></td>
                      <td className="px-5 py-3"><p className="font-black text-[#18324a]">{row.shipment_reference}</p><p className="mt-0.5 text-[9px] uppercase tracking-[.06em] text-black/40">{statusLabel(row.status)}{row.eta ? ` · ETA ${dateLabel(row.eta)}` : ""}</p></td>
                      <td className="px-5 py-3"><p className="font-semibold">{row.customer_name || row.customer_id || "Unlinked"}</p></td>
                      <td className="px-5 py-3"><p>{row.mode || "Freight"}</p><p className="mt-0.5 text-[9px] text-black/40">{row.branch}</p></td>
                      <td className="px-5 py-3"><p className="font-black text-amber-800">{row.missing_count} missing</p><p className="mt-0.5 max-w-[330px] truncate text-[9px] text-black/45" title={row.missing_labels.join(", ")}>{row.missing_labels.join(" · ")}</p></td>
                      <td className="px-5 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-[#b78a3e]" style={{ width: `${row.completion_percent}%` }}/></div><span className="text-[10px] font-black tabular-nums">{row.completion_percent}%</span></div></td>
                      <td className="px-5 py-3 text-right"><Link href={`/admin/documents/checklists?shipment=${encodeURIComponent(row.shipment_reference)}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className="inline-flex h-8 items-center rounded-lg border border-black/10 px-3 text-[9px] font-black uppercase tracking-[.07em] text-[#30485e]">Review checklist</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-12 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={24}/><p className="mt-3 text-sm font-black text-[#10263f]">No missing-document alerts</p><p className="mt-1 text-xs text-black/45">All matching shipments currently have their required document categories covered.</p></div>
          )}
        </section>

        {shipment && !selected ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900">That shipment could not be opened in your current branch scope.</div> : null}
        {selected ? <div className="mt-5"><DocumentChecklistEditor initialChecklist={selected} canManage={staff.permissions.canManageJobFile}/></div> : null}
      </div>
    </OperationsShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white px-5 py-4"><div className="flex items-center gap-2 text-[#b78a3e]">{icon}<p className="text-[9px] font-black uppercase tracking-[.1em] text-black/40">{label}</p></div><p className="mt-2 text-2xl font-black tabular-nums text-[#10263f]">{value}</p></div>;
}

function SeverityPill({ severity }: { severity: DocumentChecklistSeverity }) {
  const style = severity === "critical" ? "border-red-200 bg-red-50 text-red-800" : severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] ${style}`}>{severity}</span>;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Document Control</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1><p className="mt-4 text-sm leading-7 text-black/60">{detail}</p><Link href="/admin" className="mt-8 inline-block rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Back to Operations</Link></section></main>;
}
