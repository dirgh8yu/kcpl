import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { getAdminAccess } from "../../admin-auth";
import { kcplBranches, type KcplBranch } from "../../crm/crm-data";
import { OperationsShell } from "../../operations-shell";
import { OpsKpiRail, OpsRailMetric } from "../../ops-register";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import {
  OpsBadge,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
} from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import { loadCommandCentre } from "../../command-centre/command-centre.server";
import type { CommandCentreJob } from "../../command-centre/command-centre-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Branch", robots: { index: false, follow: false } };

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

function ownerLabel(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function issueFor(job: CommandCentreJob) {
  if (job.status === "exception") return { tone: "danger" as const, title: "Shipment exception" };
  if (job.overdue_tasks > 0) return { tone: "danger" as const, title: `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}` };
  if (job.required_customs_open > 0) return { tone: "warning" as const, title: `${job.required_customs_open} customs step${job.required_customs_open === 1 ? "" : "s"} open` };
  if (!job.assigned_to_name && !job.assigned_to_email) return { tone: "warning" as const, title: "No shipment owner" };
  if (job.priority === "urgent" || job.priority === "high") return { tone: "warning" as const, title: `${job.priority === "urgent" ? "Urgent" : "High"} priority` };
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
  if (!data) return <Gate title="Branch didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/>;
  if (!data.accessible_branches.includes(decodedBranch)) return <Gate title="Outside your branch access" detail="Your staff profile does not include access to this KCPL branch."/>;

  const branch = decodedBranch;
  const jobs = data.jobs.filter((job) => job.primary_branch === branch || job.handling_branches.includes(branch));
  const openTasks = jobs.reduce((sum, job) => sum + job.open_tasks, 0);
  const overdueTasks = jobs.reduce((sum, job) => sum + job.overdue_tasks, 0);
  const customsOpen = jobs.reduce((sum, job) => sum + job.required_customs_open, 0);
  const unassigned = jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;
  const pressureJobs = jobs.filter((job) => issueFor(job));

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
      detailLabel={branch}
    >
      <OpsPage>
        <OpsPageHeader
          eyebrow="Branch"
          title={branch}
          actions={<div className="flex items-center gap-2"><Link href={`/admin/shipments?branch=${encodeURIComponent(branch)}`} className="ops-button" data-variant="secondary" data-size="md">Shipment queue<ArrowUpRight size={12}/></Link></div>}
        />

        <div className="ops-content ops-stack">
          <OpsKpiRail label="Branch at a glance">
            <OpsRailMetric label="Active shipments" value={jobs.length}/>
            <OpsRailMetric label="Unassigned" value={unassigned} tone={unassigned ? "warning" : "neutral"}/>
            <OpsRailMetric label="Open tasks" value={openTasks} detail={overdueTasks ? `${overdueTasks} overdue` : undefined} tone={overdueTasks ? "danger" : "neutral"}/>
            <OpsRailMetric label="Customs steps open" value={customsOpen} tone={customsOpen ? "warning" : "neutral"}/>
          </OpsKpiRail>
          <OpsSurface title="Active shipments" flush>
              {jobs.length ? (
                <div className="ops-scroll-x ops-table-wrap overflow-x-auto">
                  <table className="ops-table ops-register-table ops-stack-table min-w-[1050px] w-full">
                    <thead><tr><th>Route</th><th>Shipment</th><th>Status</th><th>Owner</th><th>ETA</th><th>Open tasks</th><th>Customs</th></tr></thead>
                    <tbody>{jobs.map((job) => (
                      <tr key={job.reference}>
                        <td><strong className="ops-route"><span>{job.origin || "Origin"}</span><ArrowRight size={11} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.customer_name}</span></td>
                        <td><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-cell-link"><OpsMono>{job.reference}</OpsMono></Link><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.current_location || branch}</span></td>
                        <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                        <td className={!job.assigned_to_name && !job.assigned_to_email ? "font-semibold text-[var(--admin-warning)]" : ""}>{ownerLabel(job)}</td>
                        <td>{dateOnly(job.eta)}</td>
                        <td className={job.overdue_tasks ? "font-bold text-[var(--admin-danger)]" : ""}>{job.open_tasks}{job.overdue_tasks ? <span className="ml-1 text-[length:var(--app-label-size)]">({job.overdue_tasks} overdue)</span> : null}</td>
                        <td className={job.required_customs_open ? "font-semibold text-[var(--admin-warning)]" : ""}>{job.required_customs_open}/{job.required_customs_total}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={16}/>} title="No active movements" description={`There are currently no active shipments connected to ${branch}.`}/>} 
          </OpsSurface>

          <OpsSurface title="Owners" flush>
                {owners.length ? <div className="ops-scroll-x ops-table-wrap overflow-x-auto"><table className="ops-table ops-register-table ops-stack-table w-full"><thead><tr><th>Owner</th><th>Jobs</th><th>Tasks</th><th>Customs</th><th>Exceptions</th></tr></thead><tbody>{owners.map((owner) => <tr key={owner.key}><td className={owner.key === "unassigned" ? "font-semibold text-[var(--admin-warning)]" : "font-semibold"}>{owner.name}</td><td>{owner.jobs}</td><td>{owner.openTasks}</td><td>{owner.customsOpen}</td><td className={owner.exceptions ? "font-bold text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}>{owner.exceptions}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact kind="healthy" icon={<UserRound size={15}/>} title="No ownership load" description="There are no active movements to distribute across staff."/>}
          </OpsSurface>

          <OpsSurface title="Exceptions & blockers" flush priority={pressureJobs.length ? "warning" : "success"}>
            {pressureJobs.length ? <div>{pressureJobs.map((job) => {
              const issue = issueFor(job)!;
              return <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-b-0 hover:bg-[var(--admin-surface-soft)]"><span className="ops-priority-rail" data-tone={issue.tone}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[length:var(--app-text-sm)] text-[var(--admin-ink)]">{issue.title}</strong><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></div><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.customer_name} · {job.origin || "Origin"} → {job.destination || "Destination"}</p></div><ArrowUpRight size={13} className="text-[var(--admin-muted)]"/></Link>;
            })}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={16}/>} title="Branch clear" description="Nothing overdue, blocked or unowned."/>} 
          </OpsSurface>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate eyebrow="Branch" title={title} detail={detail}/>;
}
