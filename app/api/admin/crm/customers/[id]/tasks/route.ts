import { crmTaskPriorities, type CrmTaskPriority } from "../../../../../../admin/crm/crm-data";
import { addCrmTask, setCrmTaskCompleted } from "../../../../../../admin/crm/crm-data.server";
import { authorizeCrm, cleanCrmText, crmJson, protectCrmWrite, validEmail } from "../../../crm-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const blocked = protectCrmWrite(request);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The follow-up could not be read." }, 400);
  }

  const title = cleanCrmText(body.title, 180);
  const detail = cleanCrmText(body.detail, 3000);
  const dueAt = cleanCrmText(body.dueAt, 40);
  const priority = cleanCrmText(body.priority, 20) || "normal";
  const assignedToName = cleanCrmText(body.assignedToName, 120);
  const assignedToEmail = cleanCrmText(body.assignedToEmail, 240).toLowerCase();

  if (!title) return crmJson({ ok: false, error: "Enter a follow-up title." }, 400);
  if (!crmTaskPriorities.includes(priority as CrmTaskPriority)) return crmJson({ ok: false, error: "Choose a valid priority." }, 400);
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) return crmJson({ ok: false, error: "Choose a valid due date/time." }, 400);
  if (!validEmail(assignedToEmail)) return crmJson({ ok: false, error: "Enter a valid assignee email." }, 400);

  const { id } = await context.params;
  try {
    const result = await addCrmTask(id, {
      title,
      detail,
      dueAt,
      priority: priority as CrmTaskPriority,
      assignedToName,
      assignedToEmail,
    }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, task: result.task }, 201);
  } catch (error) {
    console.error("Failed to add KCPL CRM task", id, error);
    return crmJson({ ok: false, error: "The follow-up could not be saved." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const blocked = protectCrmWrite(request);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return crmJson({ ok: false, error: "The follow-up update could not be read." }, 400);
  }

  const taskId = cleanCrmText(body.taskId, 160);
  if (!taskId) return crmJson({ ok: false, error: "Choose a follow-up task." }, 400);
  if (typeof body.completed !== "boolean") return crmJson({ ok: false, error: "Choose whether the follow-up is complete." }, 400);

  const { id } = await context.params;
  try {
    const result = await setCrmTaskCompleted(id, taskId, body.completed, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "CRM storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    if (result.kind === "task_missing") return crmJson({ ok: false, error: "Follow-up task not found." }, 404);
    return crmJson({ ok: true, task: result.task });
  } catch (error) {
    console.error("Failed to update KCPL CRM task", id, taskId, error);
    return crmJson({ ok: false, error: "The follow-up could not be updated." }, 500);
  }
}
