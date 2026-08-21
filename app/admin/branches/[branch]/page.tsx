import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Landmark,
  ListTodo,
  PackageCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { getAdminAccess } from "../../admin-auth";
import { kcplBranches, type KcplBranch } from "../../crm/crm-data";
import { OperationsShell } from "../../operations-shell";
import {
  OpsBadge,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsStat,
  OpsStatStrip,
  OpsSurface,
} from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../staff-permissions";
import { loadCommandCentre } from "../../command-centre/command-centre.server";
import type { CommandCentreJob } from "../../command-centre/command-centre-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Branch Operations | KCPL", robots: { index: false, follow: false } };

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

function statusTone(status: ShipmentStatus): Tone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "preparing" || status === "customs_clearance") return "warning";
  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : NEPAL_TIME_ZONE }).format(date);
}

function dateTimeNepal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function ownerLabel(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function issueFor(job: CommandCentreJob) {
  if (job.status === "exception") return { tone: "danger" as const, title: "Shipment exception", detail: "Movement is in exception status." };
  if (job.overdue_tasks > 0) return { tone: "danger" as const, title: `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Operational work is past due." };
  if (job.required_customs_open > 0) return { tone: "warning" as const, title: `${job.required_customs_open} customs step${job.required_customs_open === 1 ? "" : "s"} open`, detail: "Required customs work remains incomplete." };
  if (!job.assigned_to_name && !job.assigned_to_email) return { tone: "warning" as const, title: "No shipment owner", detail: "This movement has not been assigned." };
  if (job.priority === "urgent" || job.priority === "high") return { tone: "warning" as const, title: `${job.priority === "urgent" ? "Urgent" : "High"} priority`, detail: "This shipment has elevated operational priority." };
  return null;
}

function isKcplBranch(value: string): value is KcplBranch {
  return kcplBranches.includes(value as KcplBranch);
}

export default async function BranchOperationsPage({ params }: { params: Promise<{ branch: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Branch operations are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return <Gate title="Operations access required" detail="Your current role does not include operational Job File access."/>;

  const { branch: rawBranch } = await params;
  const decodedBranch = decodeURIComponent(rawBranch);
  if (!isKcplBranch(decodedBranch)) return <Gate title="Branch not found" detail="This location is not registered as a KCPL operating branch."/>;

  const data = await loadCommandCentre(staff);
  if (!data) return <Gate title="Branch data unavailable" detail="Firebase operational data is unavailable for this deployment."/>;
  if (!data.accessible_branches.includes(decodedBranch)) return <Gate title="Outside your branch access" detail="Your staff profile does not include access to this KCPL branch."/>;

  const branch = decodedBranch;
  const jobs = data.jobs.filter((job) => job.primary_branch === branch || job.handling_branches.includes(branch));
  const branchLoad = data.branch_load.find((item) => item.branch === branch);
  const openTasks = jobs.reduce((sum, job) => sum + job.open_tasks, 0);
  const overdueTasks = jobs.reduce((sum, job) => sum + job.overdue_tasks, 0);
  const customsOpen = jobs.reduce((sum, job) => sum + job.required_customs_open, 0);
  const exceptions = jobs.filter((job) => job.status === "exception").length;
  const unassigned = jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;
  const pressureJobs = jobs.filter((job) => issueFor(job));

  const upcomingEtas = [...jobs]
    .filter((job) => job.eta && job.eta.slice(0, 10) >= data.operational_date)
    .sort((a, b) => (a.eta || "9999").localeCompare(b.eta || "9999"))
    .slice(0, 8);

  const ownerMap = new Map<string, { key: string; name: string; jobs: number; openTasks: number; customsOpen: number; exceptions: number }>();
  for (const job of jobs) {
    const name = ownerLabel(job);
    const key = (job.assigned_to_email || job.assigned_to_name || "unassigned").toLowerCase();
    const row = ownerMap.get(key) ?? { key, name, jobs: 0, openTasks: 0, customsOpen: 0, exceptions: 0 };
    row.jobs += 1;
    row.openTasks += job.open_tasks;
    row.customsOpen += job.required_customs_open;
    if (job.status === "exception") row.exceptions += 1;
    ownerMap.set(key, row);
  }
  const owners = [...ownerMap.values()].sort((a, b) => b.exceptions - a.exceptions || b.openTasks - a.openTasks || b.jobs - a.jobs || a.name.localeCompare(b.name));

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <OpsPage>
        <OpsPageHeader
          eyebrow="Branch operations"
          title={<span className="inline-flex items-center gap-2"><Landmark size={24}/>{branch}</span>}
          description="A live branch-level drill-down of active movements, ownership, ETAs, tasks, customs work and exceptions."
          meta={<><span>{kcplStaffRoleLabels[staff.permissions.role]}</span><span>Operational date {dateOnly(data.operational_date)}</span><span>Snapshot {dateTimeNepal(data.generated_at)} NPT</span></>}
          actions={<div className="flex items-center gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md"><ArrowLeft size={13}/>Operations home</Link><Link href={`/admin/shipments?branch=${encodeURIComponent(branch)}`} className="ops-button" data-variant="primary" data-size="md">Shipment queue<ArrowUpRight size={12}/></Link></div>}
        >
          <OpsStatStrip>
            <OpsStat label="Active shipments" value={jobs.length} detail={jobs.length === 1 ? "movement at this branch" : "movements at this branch"} icon={<PackageCheck size={13}/>} tone="info"/>
            <OpsStat label="Unassigned" value={unassigned} detail={unassigned ? "owner required" : "all movements owned"} icon={<UserRound size={13}/>} tone={unassigned ? "warning" : "success"}/>
            <OpsStat label="Open tasks" value={openTasks} detail={overdueTasks ? `${overdueTasks} overdue` : "no overdue work"} icon={<ListTodo size={13}/>} tone={overdueTasks ? "danger" : openTasks ? "info" : "success"}/>
            <OpsStat label="Customs work" value={customsOpen} detail={customsOpen ? "required steps open" : "no customs blockers"} icon={<ShieldCheck size={13}/>} tone={customsOpen ? "warning" : "success"}/>
            <OpsStat label="Exceptions" value={exceptions} detail={exceptions ? "shipment exception state" : "no critical exceptions"} icon={<CircleAlert size={13}/>} tone={exceptions ? "danger" : "success"}/>
            <OpsStat label="Due today" value={branchLoad?.deliveries_today ?? 0} detail={(branchLoad?.deliveries_today ?? 0) ? "ETA falls today" : "nothing due today"} icon={<CalendarDays size={13}/>} tone="neutral"/>
          </OpsStatStrip>
        </OpsPageHeader>

        <div className="ops-content ops-stack">
          <div className="ops-grid-main">
            <OpsSurface eyebrow="Live movements" title="Active shipments" description={`${jobs.length} active movement${jobs.length === 1 ? "" : "s"} connected to ${branch}.`} flush>
              {jobs.length ? (
                <div className="ops-table-wrap overflow-x-auto">
                  <table className="ops-table min-w-[1050px] w-full">
                    <thead><tr><th>Route</th><th>Shipment</th><th>Status</th><th>Owner</th><th>ETA</th><th>Open tasks</th><th>Customs</th><th></th></tr></thead>
                    <tbody>{jobs.map((job) => (
                      <tr key={job.reference}>
                        <td><strong className="ops-route"><span>{job.origin || "Origin"}</span><ArrowRight size={11} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><span className="mt-1 block text-[10px] text-[#817a73]">{job.customer_name}</span></td>
                        <td><OpsMono>{job.reference}</OpsMono><span className="mt-1 block text-[10px] text-[#817a73]">{job.current_location || branch}</span></td>
                        <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                        <td className={!job.assigned_to_name && !job.assigned_to_email ? "font-semibold text-[#9b682b]" : ""}>{ownerLabel(job)}</td>
                        <td>{dateOnly(job.eta)}</td>
                        <td className={job.overdue_tasks ? "font-bold text-[#ae434a]" : ""}>{job.open_tasks}{job.overdue_tasks ? <span className="ml-1 text-[10px]">({job.overdue_tasks} overdue)</span> : null}</td>
                        <td className={job.required_customs_open ? "font-semibold text-[#9b682b]" : ""}>{job.required_customs_open}/{job.required_customs_total}</td>
                        <td><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open job<ArrowUpRight size={11}/></Link></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={16}/>} title="No active movements" description={`There are currently no active shipments connected to ${branch}.`}/>} 
            </OpsSurface>

            <div className="ops-stack">
              <OpsSurface eyebrow="ETA watch" title="Upcoming ETAs" description="Next scheduled arrivals or deliveries for this branch." flush>
                {upcomingEtas.length ? <div>{upcomingEtas.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-center justify-between gap-3 border-b border-[#e9e5e0] px-4 py-3 last:border-b-0 hover:bg-[#faf9f7]"><div className="min-w-0"><strong className="block truncate text-[12px] text-[#403a36]">{job.origin || "Origin"} → {job.destination || "Destination"}</strong><span className="mt-1 block truncate text-[10px] text-[#817a73]">{job.customer_name} · {ownerLabel(job)}</span></div><div className="shrink-0 text-right"><strong className="text-[11px] text-[#3f7295]">{dateOnly(job.eta)}</strong><span className="mt-1 block text-[10px] text-[#817a73]">{shipmentStatusLabels[job.status]}</span></div></Link>)}</div> : <OpsEmptyState compact kind="healthy" icon={<CalendarDays size={15}/>} title="No upcoming ETA set" description="Active shipments at this branch do not currently have a future ETA recorded."/>}
              </OpsSurface>

              <OpsSurface eyebrow="Ownership" title="Owners" description="Active movement load by current shipment owner." flush>
                {owners.length ? <div className="ops-table-wrap overflow-x-auto"><table className="ops-table min-w-[520px] w-full"><thead><tr><th>Owner</th><th>Jobs</th><th>Tasks</th><th>Customs</th><th>Exceptions</th></tr></thead><tbody>{owners.map((owner) => <tr key={owner.key}><td className={owner.key === "unassigned" ? "font-semibold text-[#9b682b]" : "font-semibold"}>{owner.name}</td><td>{owner.jobs}</td><td>{owner.openTasks}</td><td>{owner.customsOpen}</td><td className={owner.exceptions ? "font-bold text-[#ae434a]" : "text-[#817a73]"}>{owner.exceptions}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact kind="healthy" icon={<UserRound size={15}/>} title="No ownership load" description="There are no active movements to distribute across staff."/>}
              </OpsSurface>
            </div>
          </div>

          <OpsSurface eyebrow="Attention" title="Exceptions & blockers" description="Movements at this branch with exceptions, overdue work, customs blockers, missing ownership or elevated priority." flush priority={pressureJobs.length ? "warning" : "success"}>
            {pressureJobs.length ? <div>{pressureJobs.map((job) => {
              const issue = issueFor(job)!;
              return <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e9e5e0] px-4 py-3 last:border-b-0 hover:bg-[#faf9f7]"><span className="ops-priority-rail" data-tone={issue.tone}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[12px] text-[#403a36]">{issue.title}</strong><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></div><p className="mt-1 text-[10px] text-[#817a73]">{job.customer_name} · {job.origin || "Origin"} → {job.destination || "Destination"} · {issue.detail}</p></div><ArrowUpRight size={13} className="text-[#817a73]"/></Link>;
            })}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={16}/>} title="Branch clear" description={`${branch} has no active exceptions, overdue tasks, customs blockers, unassigned movements or elevated-priority work.`}/>} 
          </OpsSurface>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f3f1ee] p-6 text-[#26221f]"><section className="w-full max-w-xl rounded-[16px] border border-[#ddd8d2] bg-white p-8 shadow-[0_12px_36px_rgba(54,43,34,.06)]"><p className="text-[10px] font-bold text-[#8f8179]">KCPL Operations</p><h1 className="mt-2 text-[28px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#736d67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations home</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Shipments</Link></div></section></main>;
}
