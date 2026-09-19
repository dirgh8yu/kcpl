import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Landmark,
  ListTodo,
  PackageCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { getAdminAccess } from "../../admin-auth";
import { loadCommandCentre } from "../../command-centre/command-centre.server";
import type { CommandCentreJob } from "../../command-centre/command-centre-data";
import { kcplBranches, type KcplBranch } from "../../crm/crm-data";
import { OperationsShell } from "../../operations-shell";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import {
  OpsBadge,
  OpsEmptyState,
  OpsKpiCard,
  OpsKpiStrip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
} from "../../operations-ui";
import { getStaffContext, listStaffProfiles } from "../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../staff-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff Workload | KCPL Operations", robots: { index: false, follow: false } };

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

type StaffTask = {
  id: string;
  shipmentReference: string;
  title: string;
  detail: string | null;
  branch: string;
  dueAt: string | null;
  overdue: boolean;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const result = text(value).trim();
  return result || null;
}

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

function dateTimeNepal(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function shipmentIdFromTask(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

function assignedTo(job: CommandCentreJob, email: string, name: string) {
  const jobEmail = job.assigned_to_email?.trim().toLowerCase() ?? "";
  if (email) return jobEmail === email;
  return !jobEmail && (job.assigned_to_name?.trim().toLowerCase() ?? "") === name.trim().toLowerCase();
}

function branchSetForJob(job: CommandCentreJob) {
  return [job.primary_branch, ...job.handling_branches];
}

export default async function StaffWorkloadPage({ params }: { params: Promise<{ key: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff workload is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  // Gates past this point keep the navigation shell.
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, isManagement: staff.permissions.role === "management" };
  const shellGate = (title: string, detail: string) => <OperationsShell {...shellProps}><Gate title={title} detail={detail} embedded/></OperationsShell>;
  if (!staff.permissions.canManageJobFile) return shellGate("Operations access required", "Your current role does not include operational Job File access.");
  if (!firebaseRuntimeConfigured()) return shellGate("Workload data unavailable", "Firebase operational data is unavailable for this deployment.");

  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey).trim().toLowerCase();
  const [data, profiles] = await Promise.all([loadCommandCentre(staff), listStaffProfiles()]);
  if (!data) return shellGate("Workload data unavailable", "KCPL operational data could not be loaded.");

  const load = data.staff_load.find((item) => item.key.toLowerCase() === key || item.email.toLowerCase() === key);
  if (!load) return shellGate("Staff workload not found", "This staff member is not visible within your current branch-access scope.");

  const targetEmail = load.email.trim().toLowerCase();
  const targetName = load.name.trim();
  const profile = (profiles ?? []).find((item) =>
    (targetEmail && item.email.toLowerCase() === targetEmail) || item.uid.toLowerCase() === key,
  );
  const assignedJobs = data.jobs.filter((job) => assignedTo(job, targetEmail, targetName));
  const accessibleReferences = new Set(data.jobs.map((job) => job.reference));
  const now = Date.parse(data.generated_at);

  const taskSnapshot = await firebaseAdminDb().collectionGroup("job_tasks").limit(8000).get();
  const tasks: StaffTask[] = taskSnapshot.docs.flatMap((doc) => {
    const row = doc.data() as Record<string, unknown>;
    if (row.completed === true) return [];
    const shipmentReference = shipmentIdFromTask(doc.ref);
    if (!shipmentReference || !accessibleReferences.has(shipmentReference)) return [];

    const email = text(row.assigned_to_email).trim().toLowerCase();
    const name = text(row.assigned_to_name).trim().toLowerCase();
    const matches = targetEmail ? email === targetEmail : !email && name === targetName.toLowerCase();
    if (!matches) return [];

    const dueAt = nullable(row.due_at);
    const dueTime = dueAt ? Date.parse(dueAt) : Number.NaN;
    return [{
      id: doc.id,
      shipmentReference,
      title: text(row.title, "Operational task"),
      detail: nullable(row.detail),
      branch: text(row.branch, "Branch not set"),
      dueAt,
      overdue: Number.isFinite(dueTime) && dueTime < now,
    }];
  }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt || "9999").localeCompare(b.dueAt || "9999") || a.title.localeCompare(b.title));

  const responsibilitySource: KcplBranch[] = profile
    ? (profile.branch_scope === "all" || profile.role === "management" ? [...kcplBranches] : profile.branches)
    : [...new Set(assignedJobs.flatMap(branchSetForJob))];
  const responsibility = responsibilitySource.filter((branch) => data.accessible_branches.includes(branch));

  const overdueTasks = tasks.filter((task) => task.overdue).length;
  const urgentJobs = assignedJobs.filter((job) => job.priority === "urgent" || job.status === "exception").length;
  const exceptionJobs = assignedJobs.filter((job) => job.status === "exception").length;
  const customsOpen = assignedJobs.reduce((sum, job) => sum + job.required_customs_open, 0);
  const dueToday = assignedJobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const attentionJobs = assignedJobs.filter((job) => job.status === "exception" || job.priority === "urgent" || job.overdue_tasks > 0 || job.required_customs_open > 0);

  return (
    <OperationsShell {...shellProps}>
      <OpsPage>
        <OpsPageHeader
          eyebrow="Staff workload"
          title={<span className="inline-flex items-center gap-2"><UserRound size={24}/>{targetName}</span>}
          description="A live view of this staff member’s assigned movements, operational tasks, overdue work, urgent jobs and branch responsibility."
          meta={<>
            {profile?.job_title ? <span>{profile.job_title}</span> : null}
            {targetEmail ? <span>{targetEmail}</span> : null}
            <span>{profile ? kcplStaffRoleLabels[profile.role] : "Operational owner"}</span>
            <span>Snapshot {dateTimeNepal(data.generated_at)} NPT</span>
          </>}
          actions={<div className="flex items-center gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md"><ArrowLeft size={13}/>Operations home</Link>{staff.permissions.canManageStaff && profile ? <Link href="/admin/staff" className="ops-button" data-variant="secondary" data-size="md">Staff directory<ArrowUpRight size={12}/></Link> : null}</div>}
        >
          <OpsKpiStrip>
            <OpsKpiCard label="Assigned shipments" value={assignedJobs.length} detail={assignedJobs.length === 1 ? "active movement" : "active movements"} icon={<PackageCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone="info"/>
            <OpsKpiCard label="Open tasks" value={tasks.length} detail={overdueTasks ? `${overdueTasks} overdue` : "no overdue work"} icon={<ListTodo size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={overdueTasks ? "danger" : tasks.length ? "info" : "success"}/>
            <OpsKpiCard label="Urgent jobs" value={urgentJobs} detail={urgentJobs ? "priority or exception work" : "no urgent movement"} icon={<CircleAlert size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={urgentJobs ? "warning" : "success"}/>
            <OpsKpiCard label="Customs work" value={customsOpen} detail={customsOpen ? "required steps open" : "no customs blockers"} icon={<ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={customsOpen ? "warning" : "success"}/>
            <OpsKpiCard label="Exceptions" value={exceptionJobs} detail={exceptionJobs ? "shipment exception state" : "no critical exceptions"} icon={<CircleAlert size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={exceptionJobs ? "danger" : "success"}/>
            <OpsKpiCard label="Due today" value={dueToday} detail={dueToday ? "ETA falls today" : "nothing due today"} icon={<CalendarDays size={18} strokeWidth={1.9} aria-hidden="true"/>} tone="neutral"/>
          </OpsKpiStrip>
        </OpsPageHeader>

        <div className="ops-content ops-stack">
          <div className="ops-grid-main">
            <OpsSurface eyebrow="Ownership" title="Assigned shipments" description={`${assignedJobs.length} active movement${assignedJobs.length === 1 ? "" : "s"} currently owned by ${targetName}.`} flush>
              {assignedJobs.length ? <div className="ops-scroll-x ops-table-wrap overflow-x-auto"><table className="ops-table min-w-[980px] w-full"><thead><tr><th>Route</th><th>Shipment</th><th>Status</th><th>Branch</th><th>ETA</th><th>Tasks</th><th>Customs</th><th></th></tr></thead><tbody>{assignedJobs.map((job) => <tr key={job.reference}>
                <td><strong className="ops-route"><span>{job.origin || "Origin"}</span><ArrowRight size={11} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.customer_name}</span></td>
                <td><OpsMono>{job.reference}</OpsMono><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.current_location || job.primary_branch}</span></td>
                <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                <td><Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`} className="font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-crimson)] hover:underline">{job.primary_branch}</Link></td>
                <td>{dateOnly(job.eta)}</td>
                <td className={job.overdue_tasks ? "font-bold text-[var(--admin-danger)]" : ""}>{job.open_tasks}{job.overdue_tasks ? <span className="ml-1 text-[length:var(--app-label-size)]">({job.overdue_tasks} overdue)</span> : null}</td>
                <td className={job.required_customs_open ? "font-semibold text-[var(--admin-warning)]" : ""}>{job.required_customs_open}/{job.required_customs_total}</td>
                <td><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open job<ArrowUpRight size={11}/></Link></td>
              </tr>)}</tbody></table></div> : <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={16}/>} title="No assigned shipments" description={`${targetName} does not currently own an active movement.`}/>} 
            </OpsSurface>

            <div className="ops-stack">
              <OpsSurface eyebrow="Responsibility" title="Branch access" description={profile ? "Branches assigned to this staff profile within your own accessible scope." : "Branches inferred from currently assigned movements."} flush>
                {responsibility.length ? <div className="divide-y divide-[var(--admin-line)]">{responsibility.map((branch) => {
                  const jobsAtBranch = assignedJobs.filter((job) => job.primary_branch === branch || job.handling_branches.includes(branch)).length;
                  return <Link key={branch} href={`/admin/branches/${encodeURIComponent(branch)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--admin-surface-soft)]"><span className="flex items-center gap-2 text-[11px] font-semibold text-[var(--admin-ink)]"><Landmark size={12} className="text-[var(--admin-muted)]"/>{branch}</span><span className="flex items-center gap-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{jobsAtBranch} active<ArrowUpRight size={11}/></span></Link>;
                })}</div> : <OpsEmptyState compact kind="neutral" icon={<Landmark size={15}/>} title="No branch responsibility recorded" description="No branch scope is currently available for this operational owner."/>}
              </OpsSurface>

              <OpsSurface eyebrow="Attention" title="Priority movements" description="Assigned shipments with an exception, urgent priority, overdue task or customs blocker." flush priority={attentionJobs.length ? "warning" : "success"}>
                {attentionJobs.length ? <div className="divide-y divide-[var(--admin-line)]">{attentionJobs.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--admin-surface-soft)]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-[11px] text-[var(--admin-ink)]">{job.origin || "Origin"} → {job.destination || "Destination"}</strong><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></div><span className="mt-1 block truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.overdue_tasks ? `${job.overdue_tasks} overdue · ` : ""}{job.required_customs_open ? `${job.required_customs_open} customs open · ` : ""}{job.priority} priority</span></div><ArrowUpRight size={12} className="shrink-0 text-[var(--admin-muted)]"/></Link>)}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={15}/>} title="No priority pressure" description="No assigned movement currently has an exception, overdue work, urgent priority or customs blocker."/>}
              </OpsSurface>
            </div>
          </div>

          <OpsSurface eyebrow="Task queue" title="Open tasks" description={`Operational tasks specifically assigned to ${targetName}, including work on shipments they may not directly own.`} flush priority={overdueTasks ? "danger" : tasks.length ? "info" : "success"}>
            {tasks.length ? <div className="ops-scroll-x ops-table-wrap overflow-x-auto"><table className="ops-table min-w-[900px] w-full"><thead><tr><th>Task</th><th>Shipment</th><th>Branch</th><th>Due</th><th>State</th><th></th></tr></thead><tbody>{tasks.map((task) => <tr key={`${task.shipmentReference}:${task.id}`}>
              <td><strong className="block max-w-[360px] text-[var(--admin-ink)]">{task.title}</strong>{task.detail ? <span className="mt-1 block max-w-[420px] truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{task.detail}</span> : null}</td>
              <td><OpsMono>{task.shipmentReference}</OpsMono></td>
              <td>{task.branch}</td>
              <td className={task.overdue ? "font-bold text-[var(--admin-danger)]" : ""}>{task.dueAt ? dateTimeNepal(task.dueAt) : "No due date"}</td>
              <td>{task.overdue ? <OpsBadge tone="danger" dot>Overdue</OpsBadge> : <OpsBadge tone={task.dueAt ? "info" : "neutral"}>{task.dueAt ? "Open" : "Unscheduled"}</OpsBadge>}</td>
              <td><Link href={`/admin/jobs/${encodeURIComponent(task.shipmentReference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open job<ArrowUpRight size={11}/></Link></td>
            </tr>)}</tbody></table></div> : <OpsEmptyState compact kind="healthy" icon={<Clock3 size={15}/>} title="No open tasks" description={`${targetName} has no accessible open operational tasks assigned right now.`}/>} 
          </OpsSurface>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Staff workload" title={title} detail={detail} embedded={embedded}/>;
}
