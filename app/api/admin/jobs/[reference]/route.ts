import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { kcplBranches, crmCurrencies, type KcplBranch, type CrmCurrency } from "../../../../admin/crm/crm-data";
import {
  addCustomsStep,
  addJobCost,
  addJobTask,
  getDigitalJobFile,
  toggleCustomsStep,
  toggleJobTask,
  updateDigitalJobFile,
} from "../../../../admin/job-file.server";
import { jobCostCategories, jobPriorities, type JobCostCategory, type JobPriority } from "../../../../admin/job-file";
import { closeShipmentJob, getShipmentWorkflowReadiness, reopenShipmentJob } from "../../../../admin/workflow-guard.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Job File access is not available for this account." }, 403) };
  return { user: access.user, staff };
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function resultError(kind: string) {
  if (kind === "unavailable") return json({ ok: false, error: "Job File storage is unavailable." }, 503);
  if (kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (kind === "invalid_branch") return json({ ok: false, error: "Choose a branch assigned to this job." }, 400);
  if (kind === "missing_child") return json({ ok: false, error: "The requested Job File item was not found." }, 404);
  return json({ ok: false, error: "The Job File action could not be completed." }, 500);
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const [result, workflow] = await Promise.all([
    getDigitalJobFile(reference, auth.staff),
    getShipmentWorkflowReadiness(reference, auth.staff),
  ]);
  if (result.kind !== "ready") return resultError(result.kind);
  if (workflow.kind !== "ready") return resultError(workflow.kind);
  return json({ ok: true, job: result.job, workflow: workflow.readiness, role: auth.staff.permissions.role, canManageBranches: auth.staff.permissions.role === "management" });
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin Job File updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The Job File update could not be read." }, 400); }

  const priority = clean(body.priority, 20);
  if (!jobPriorities.includes(priority as JobPriority)) return json({ ok: false, error: "Choose a valid job priority." }, 400);
  const primaryBranch = clean(body.primaryBranch, 80);
  const handlingBranches = Array.isArray(body.handlingBranches)
    ? body.handlingBranches.filter((branch): branch is KcplBranch => typeof branch === "string" && kcplBranches.includes(branch as KcplBranch))
    : undefined;
  if (primaryBranch && !kcplBranches.includes(primaryBranch as KcplBranch)) return json({ ok: false, error: "Choose a valid primary branch." }, 400);

  const result = await updateDigitalJobFile(reference, {
    primaryBranch: primaryBranch ? primaryBranch as KcplBranch : undefined,
    handlingBranches,
    assignedToName: clean(body.assignedToName, 160),
    assignedToEmail: clean(body.assignedToEmail, 240),
    priority: priority as JobPriority,
    internalReference: clean(body.internalReference, 160),
    internalNotes: clean(body.internalNotes, 8000),
  }, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind !== "updated") return resultError(result.kind);
  const workflow = await getShipmentWorkflowReadiness(reference, auth.staff);
  return json({ ok: true, workflow: workflow.kind === "ready" ? workflow.readiness : null });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin Job File updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The Job File action could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: auth.user.displayName, email: auth.user.email };

  if (action === "close_job") {
    const result = await closeShipmentJob(reference, actor, auth.staff, clean(body.overrideReason, 2000));
    if (result.kind === "closed" || result.kind === "already_closed") return json({ ok: true, workflow: result.readiness, overrideUsed: result.kind === "closed" ? result.overrideUsed : false });
    if (result.kind === "blocked") return json({ ok: false, error: result.blockers.join(" "), code: "CLOSEOUT_BLOCKED", blockers: result.blockers, canOverride: result.canOverride, workflow: result.readiness }, 409);
    return resultError(result.kind);
  }

  if (action === "reopen_job") {
    const result = await reopenShipmentJob(reference, actor, auth.staff, clean(body.reason, 2000));
    if (result.kind === "reopened") return json({ ok: true, workflow: result.readiness });
    if (result.kind === "reason_required") return json({ ok: false, error: "Management must record a reopening reason of at least 8 characters." }, 400);
    if (result.kind === "not_closed") return json({ ok: false, error: "This Job File is not closed." }, 409);
    return resultError(result.kind);
  }

  if (action === "add_task") {
    const title = clean(body.title, 240);
    const branch = clean(body.branch, 80);
    if (!title) return json({ ok: false, error: "Add a task title." }, 400);
    if (!kcplBranches.includes(branch as KcplBranch)) return json({ ok: false, error: "Choose a valid task branch." }, 400);
    const result = await addJobTask(reference, {
      title,
      detail: clean(body.detail, 5000),
      branch: branch as KcplBranch,
      dueAt: clean(body.dueAt, 40),
      assignedToName: clean(body.assignedToName, 160),
      assignedToEmail: clean(body.assignedToEmail, 240),
    }, actor, auth.staff);
    if (result.kind !== "created") return resultError(result.kind);
    return json({ ok: true, task: result.task }, 201);
  }

  if (action === "toggle_task") {
    const taskId = clean(body.taskId, 180);
    if (!taskId) return json({ ok: false, error: "Task not found." }, 404);
    const result = await toggleJobTask(reference, taskId, body.completed === true, actor, auth.staff);
    if (result.kind !== "updated") return resultError(result.kind);
    return json({ ok: true });
  }

  if (action === "add_customs") {
    const title = clean(body.title, 240);
    const branch = clean(body.branch, 80);
    if (!title) return json({ ok: false, error: "Add a customs step title." }, 400);
    if (!kcplBranches.includes(branch as KcplBranch)) return json({ ok: false, error: "Choose a valid customs branch." }, 400);
    const result = await addCustomsStep(reference, {
      title,
      detail: clean(body.detail, 5000),
      branch: branch as KcplBranch,
      required: body.required !== false,
    }, actor, auth.staff);
    if (result.kind !== "created") return resultError(result.kind);
    return json({ ok: true, step: result.step }, 201);
  }

  if (action === "toggle_customs") {
    const stepId = clean(body.stepId, 180);
    if (!stepId) return json({ ok: false, error: "Customs step not found." }, 404);
    const result = await toggleCustomsStep(reference, stepId, body.completed === true, actor, auth.staff);
    if (result.kind !== "updated") return resultError(result.kind);
    return json({ ok: true });
  }

  if (action === "add_cost") {
    if (!auth.staff.permissions.canManageJobCosts) return json({ ok: false, error: "Commercial cost access is required." }, 403);
    const category = clean(body.category, 40);
    const currency = clean(body.currency, 10).toUpperCase();
    const amount = Number(body.amount);
    const label = clean(body.label, 240);
    if (!jobCostCategories.includes(category as JobCostCategory)) return json({ ok: false, error: "Choose a valid cost category." }, 400);
    if (!crmCurrencies.includes(currency as CrmCurrency)) return json({ ok: false, error: "Choose a supported currency." }, 400);
    if (!Number.isFinite(amount) || amount < 0) return json({ ok: false, error: "Enter a valid non-negative cost amount." }, 400);
    if (!label) return json({ ok: false, error: "Add a cost description." }, 400);
    const result = await addJobCost(reference, {
      category: category as JobCostCategory,
      label,
      vendor: clean(body.vendor, 240),
      amount,
      currency: currency as CrmCurrency,
      notes: clean(body.notes, 5000),
    }, actor, auth.staff);
    if (result.kind !== "created") return resultError(result.kind);
    return json({ ok: true, cost: result.cost }, 201);
  }

  return json({ ok: false, error: "Choose a valid Job File action." }, 400);
}
