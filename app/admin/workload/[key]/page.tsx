import { loadShipmentChildren } from "../../operational-shipments.server";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  } from "lucide-react";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { getAdminAccess } from "../../admin-auth";
import { loadCommandCentre } from "../../command-centre/command-centre.server";
import type { CommandCentreJob } from "../../command-centre/command-centre-data";
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
import { getStaffContext, listStaffProfiles } from "../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../staff-permissions";
import { mockOpenJobTasks, qaMockDataEnabled } from "../../qa-fixtures";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workload", robots: { index: false, follow: false } };

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

export default async function StaffWorkloadPage({ params }: { params: Promise<{ key: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff workload is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  // Gates past this point keep the navigation shell.
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, isManagement: staff.permissions.role === "management" };
  const shellGate = (title: string, detail: string) => <OperationsShell {...shellProps}><Gate title={title} detail={detail} embedded/></OperationsShell>;
  if (!staff.permissions.canManageJobFile) return shellGate("Operations access required", "Your current role does not include operational Job File access.");
  const preview = qaMockDataEnabled();
  if (!preview && !firebaseRuntimeConfigured()) return shellGate("Workload can’t be shown right now", "The records service isn’t responding. Try again in a minute.");

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

  // The tasks of the jobs this person can see, read per job; a collection-group
  // read kept the oldest 8,000 tasks and missed new work.
  const taskRows = qaMockDataEnabled() ? mockOpenJobTasks(data.jobs, now).map((row) => ({ id: row.id, shipmentReference: row.shipment_reference, row: row as Record<string, unknown> }))
    : (await loadShipmentChildren(firebaseAdminDb(), [...accessibleReferences], "job_tasks")).map((doc) => ({ id: doc.id, shipmentReference: shipmentIdFromTask(doc.ref), row: doc.data() as Record<string, unknown> }));
  const tasks: StaffTask[] = taskRows.flatMap(({ id, shipmentReference, row }) => {
    if (row.completed === true) return [];
    if (!shipmentReference || !accessibleReferences.has(shipmentReference)) return [];

    const email = text(row.assigned_to_email).trim().toLowerCase();
    const name = text(row.assigned_to_name).trim().toLowerCase();
    const matches = targetEmail ? email === targetEmail : !email && name === targetName.toLowerCase();
    if (!matches) return [];

    const dueAt = nullable(row.due_at);
    const dueTime = dueAt ? Date.parse(dueAt) : Number.NaN;
    return [{
      id,
      shipmentReference,
      title: text(row.title, "Operational task"),
      detail: nullable(row.detail),
      branch: text(row.branch, "Branch not set"),
      dueAt,
      overdue: Number.isFinite(dueTime) && dueTime < now,
    }];
  }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt || "9999").localeCompare(b.dueAt || "9999") || a.title.localeCompare(b.title));

  const overdueTasks = tasks.filter((task) => task.overdue).length;
  const urgentJobs = assignedJobs.filter((job) => job.priority === "urgent" || job.status === "exception").length;
  const customsOpen = assignedJobs.reduce((sum, job) => sum + job.required_customs_open, 0);

  return (
    <OperationsShell {...shellProps} detailLabel={targetName}>
      <OpsPage>
        <OpsPageHeader
          eyebrow="Workload"
          title={targetName}
          description="The shipments this person owns, their open tasks and what needs attention first."
          meta={<span>{profile?.job_title || (profile ? kcplStaffRoleLabels[profile.role] : "Operational owner")}</span>}
          actions={staff.permissions.canManageStaff && profile ? <Link href="/admin/staff" className="ops-button" data-variant="secondary" data-size="md">People & branches<ArrowUpRight size={12}/></Link> : null}
        />

        <div className="ops-content ops-stack">
          <OpsKpiRail label="Workload at a glance">
            <OpsRailMetric label="Assigned shipments" value={assignedJobs.length}/>
            <OpsRailMetric label="Open tasks" value={tasks.length} detail={overdueTasks ? `${overdueTasks} overdue` : undefined} tone={overdueTasks ? "danger" : "neutral"}/>
            <OpsRailMetric label="Urgent or exception" value={urgentJobs} tone={urgentJobs ? "warning" : "neutral"}/>
            <OpsRailMetric label="Customs steps open" value={customsOpen} tone={customsOpen ? "warning" : "neutral"}/>
          </OpsKpiRail>
          <OpsSurface title="Assigned shipments" flush>
              {assignedJobs.length ? <div className="ops-scroll-x ops-table-wrap overflow-x-auto"><table className="ops-table ops-register-table ops-stack-table min-w-[980px] w-full"><thead><tr><th>Route</th><th>Shipment</th><th>Status</th><th>Branch</th><th>ETA</th><th>Tasks</th><th>Customs</th></tr></thead><tbody>{assignedJobs.map((job) => <tr key={job.reference}>
                <td><strong className="ops-route"><span>{job.origin || "Origin"}</span><ArrowRight size={11} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.customer_name}</span></td>
                <td><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-cell-link"><OpsMono>{job.reference}</OpsMono></Link><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.current_location || job.primary_branch}</span></td>
                <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                <td><Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`} className="font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-crimson)] hover:underline">{job.primary_branch}</Link></td>
                <td>{dateOnly(job.eta)}</td>
                <td className={job.overdue_tasks ? "font-bold text-[var(--admin-danger)]" : ""}>{job.open_tasks}{job.overdue_tasks ? <span className="ml-1 text-[length:var(--app-label-size)]">({job.overdue_tasks} overdue)</span> : null}</td>
                <td className={job.required_customs_open ? "font-semibold text-[var(--admin-warning)]" : ""}>{job.required_customs_open}/{job.required_customs_total}</td>
              </tr>)}</tbody></table></div> : <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={16}/>} title="No assigned shipments" description={`${targetName} does not currently own an active movement.`}/>} 
          </OpsSurface>

          <OpsSurface title="Open tasks" flush priority={overdueTasks ? "danger" : tasks.length ? "info" : "success"}>
            {tasks.length ? <div className="ops-scroll-x ops-table-wrap overflow-x-auto"><table className="ops-table ops-register-table ops-stack-table min-w-[900px] w-full"><thead><tr><th>Task</th><th>Shipment</th><th>Branch</th><th>Due</th><th>State</th></tr></thead><tbody>{tasks.map((task) => <tr key={`${task.shipmentReference}:${task.id}`}>
              <td><strong className="block max-w-[360px] text-[var(--admin-ink)]">{task.title}</strong>{task.detail ? <span className="mt-1 block max-w-[420px] truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{task.detail}</span> : null}</td>
              <td><Link href={`/admin/jobs/${encodeURIComponent(task.shipmentReference)}`} className="ops-cell-link"><OpsMono>{task.shipmentReference}</OpsMono></Link></td>
              <td>{task.branch}</td>
              <td className={task.overdue ? "font-bold text-[var(--admin-danger)]" : ""}>{task.dueAt ? dateTimeNepal(task.dueAt) : "No due date"}</td>
              <td>{task.overdue ? <OpsBadge tone="danger" dot>Overdue</OpsBadge> : <OpsBadge tone={task.dueAt ? "info" : "neutral"}>{task.dueAt ? "Open" : "Unscheduled"}</OpsBadge>}</td>
            </tr>)}</tbody></table></div> : <OpsEmptyState compact kind="healthy" icon={<Clock3 size={15}/>} title="No open tasks" description={`${targetName} has no accessible open operational tasks assigned right now.`}/>} 
          </OpsSurface>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Workload" title={title} detail={detail} embedded={embedded}/>;
}
