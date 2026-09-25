import { firebaseAdminDb } from "../firebase-admin.server";
import type { AdminUser } from "./admin-auth";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { addJobTask, getDigitalJobFile, updateDigitalJobFile } from "./job-file.server";
import { listStaffProfiles, staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";
import { closeShipmentJob } from "./workflow-guard.server";

/*
 * Job File changes made from a request: the web Job File and KCPL Ops share
 * these, so a task, a closeout or a new owner is decided one way whichever
 * screen it came from. Each returns a status and a body; the caller adds only
 * its own credential check.
 */

export type JobRequestResult = { status: number; body: Record<string, unknown> };

type Actor = { name: string; email: string };

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function refused(status: number, error: string, extra: Record<string, unknown> = {}): JobRequestResult {
  return { status, body: { ok: false, error, ...extra } };
}

export function jobResultError(kind: string): JobRequestResult {
  if (kind === "unavailable") return refused(503, "Job File storage is unavailable.");
  if (kind === "missing") return refused(404, "Shipment not found.");
  if (kind === "forbidden") return refused(403, "This shipment or work item is outside your branch access.");
  if (kind === "invalid_branch") return refused(400, "Choose a branch assigned to this job and within your staff access.");
  if (kind === "missing_child") return refused(404, "The requested Job File item was not found.");
  return refused(500, "The Job File action could not be completed.");
}

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** "2026-09-25T17:00" as Nepal wall-clock time, to an instant. Null when it
 * is not a real date and time; empty when none was given. */
export function normalizeNepalDateTime(value: string) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (!validDateParts(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - NEPAL_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

export async function touchShipment(reference: string) {
  await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).update({ updated_at: new Date().toISOString() });
}

export async function addJobTaskFromRequest(reference: string, body: Record<string, unknown>, actor: Actor, staff: KcplStaffContext): Promise<JobRequestResult> {
  const title = clean(body.title, 240);
  const branch = clean(body.branch, 80);
  const dueAt = normalizeNepalDateTime(clean(body.dueAt, 40));
  const assignedToEmail = clean(body.assignedToEmail, 240).toLowerCase();
  if (!title) return refused(400, "Add a task title.");
  if (!kcplBranches.includes(branch as KcplBranch)) return refused(400, "Choose a valid task branch.");
  if (!staffCanAccessBranch(staff, branch)) return refused(403, "You cannot create work for a branch outside your staff access.");
  if (dueAt === null) return refused(400, "Choose a real task due date and time.");
  if (assignedToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedToEmail)) return refused(400, "Enter a valid assignee email address.");
  const result = await addJobTask(reference, {
    title,
    detail: clean(body.detail, 5000),
    branch: branch as KcplBranch,
    dueAt,
    assignedToUid: clean(body.assignedToUid, 160),
    assignedToName: clean(body.assignedToName, 160),
    assignedToEmail,
    assignedToPhone: clean(body.assignedToPhone, 80),
  }, actor, staff);
  if (result.kind !== "created") return jobResultError(result.kind);
  await touchShipment(reference);
  return { status: 201, body: { ok: true, task: result.task } };
}

/** Closeout reads across branches, as the web gives it, once access to the
 * job itself was decided by the caller. */
export async function closeJobFromRequest(reference: string, body: Record<string, unknown>, actor: Actor, staff: KcplStaffContext): Promise<JobRequestResult> {
  const result = await closeShipmentJob(reference, actor, { ...staff, can_access_all_branches: true }, clean(body.overrideReason, 2000));
  if (result.kind === "closed" || result.kind === "already_closed") {
    return { status: 200, body: { ok: true, workflow: result.readiness, overrideUsed: result.kind === "closed" ? result.overrideUsed : false } };
  }
  if (result.kind === "blocked") {
    return refused(409, result.blockers.join(" "), {
      code: "CLOSEOUT_BLOCKED",
      blockers: result.blockers,
      canOverride: result.canOverride,
      workflow: result.readiness,
    });
  }
  return jobResultError(result.kind);
}

export type StaffOption = {
  uid: string;
  display_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: string;
  branch_scope: string;
  branches: string[];
};

/** Who a job can be given to: active staff who share a branch with the
 * person assigning, as the web's picker offers. */
export async function staffAssignmentOptions(
  staff: KcplStaffContext,
  loaded?: Awaited<ReturnType<typeof listStaffProfiles>>,
): Promise<StaffOption[] | null> {
  const profiles = loaded === undefined ? await listStaffProfiles() : loaded;
  if (profiles === null) return null;
  return profiles
    .filter((profile) => profile.active)
    .filter((profile) => staff.can_access_all_branches || profile.branch_scope === "all" || profile.branches.some((branch) => staff.branches.includes(branch)))
    .map((profile) => ({
      uid: profile.uid,
      display_name: profile.display_name,
      email: profile.email,
      phone: profile.phone ?? null,
      job_title: profile.job_title ?? null,
      role: profile.role,
      branch_scope: profile.branch_scope,
      branches: profile.branches,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/**
 * Gives the job to someone else. Only the owner changes: the Job File's other
 * fields are written back exactly as they were read, since the update writes
 * them all. The new owner must be one of the options the caller may choose.
 */
export async function reassignJob(reference: string, body: Record<string, unknown>, user: AdminUser, staff: KcplStaffContext): Promise<JobRequestResult> {
  const uid = clean(body.assignedToUid, 160);
  if (!uid) return refused(400, "Choose who the job goes to.");
  const [options, current] = await Promise.all([staffAssignmentOptions(staff), getDigitalJobFile(reference, staff)]);
  if (options === null) return refused(503, "Staff directory storage is unavailable.");
  if (current.kind !== "ready") return jobResultError(current.kind);
  const owner = options.find((option) => option.uid === uid);
  if (!owner) return refused(403, "That person is not available for jobs in your branches.");

  const job = current.job;
  const result = await updateDigitalJobFile(reference, {
    assignedToUid: owner.uid,
    assignedToName: owner.display_name,
    assignedToEmail: owner.email.toLowerCase(),
    assignedToPhone: owner.phone ?? "",
    priority: job.priority,
    internalReference: job.internal_reference ?? "",
    internalNotes: job.internal_notes ?? "",
  }, { name: user.displayName, email: user.email }, staff);
  if (result.kind !== "updated") return jobResultError(result.kind);
  return { status: 200, body: { ok: true, owner: { uid: owner.uid, name: owner.display_name, email: owner.email } } };
}

