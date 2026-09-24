import { firebaseAdminDb } from "../firebase-admin.server";
import { toggleCustomsStep, toggleJobTask } from "./job-file.server";
import { checkShipmentBranchAccess } from "./shipment-access.server";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";

type Actor = { name: string; email: string };

export type JobChildToggleResult =
  | { kind: "updated" }
  | { kind: "unavailable" | "missing" | "forbidden" | "missing_child" | "forbidden_child" };

/**
 * Ticks a Job File task or customs step, with every check the Job File
 * applies: the shipment is within the caller's branch access, and so is the
 * work item itself, which can belong to a different branch than the job.
 * Shared by the web Job File and the staff app so there is one way in.
 */
export async function toggleJobChild(
  reference: string,
  collection: "job_tasks" | "customs_steps",
  childId: string,
  completed: boolean,
  actor: Actor,
  staff: KcplStaffContext,
): Promise<JobChildToggleResult> {
  const access = await checkShipmentBranchAccess(reference, staff);
  if (access.kind !== "allowed") return { kind: access.kind === "unavailable" ? "unavailable" : access.kind === "missing" ? "missing" : "forbidden" };

  const normalized = reference.trim().toUpperCase();
  const shipment = firebaseAdminDb().collection("shipments").doc(normalized);
  const child = await shipment.collection(collection).doc(childId).get();
  if (!child.exists) return { kind: "missing_child" };
  const branch = typeof child.get("branch") === "string" ? child.get("branch") as string : "";
  if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden_child" };

  const result = collection === "job_tasks"
    ? await toggleJobTask(normalized, childId, completed, actor, staff)
    : await toggleCustomsStep(normalized, childId, completed, actor, staff);
  if (result.kind !== "updated") return { kind: result.kind };

  await shipment.update({ updated_at: new Date().toISOString() });
  return { kind: "updated" };
}
