import { getAdminAccess } from "../../../admin/admin-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";
import {
  readStaffArrangement,
  writeStaffArrangement,
} from "../../../admin/staff-arrangement-store.server";
import { normalizeArrangementFor } from "../../../admin/operations-arrangeable";

export const runtime = "nodejs";

const WORKSPACES = new Set(["overview", "shipments", "customs", "delivery", "freight-documents", "pickups", "alerts", "finance", "payables"] as const);
type WorkspaceParam = "overview" | "shipments" | "customs" | "delivery" | "freight-documents" | "pickups" | "alerts" | "finance" | "payables";

function resolveWorkspace(request: Request): WorkspaceParam | null {
  const url = new URL(request.url);
  const requested = url.searchParams.get("workspace");
  if (!requested) return "overview";
  return WORKSPACES.has(requested as WorkspaceParam) ? (requested as WorkspaceParam) : null;
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const workspace = resolveWorkspace(request);
  if (!workspace) {
    return Response.json({ error: "unknown workspace" }, { status: 400 });
  }
  const document = await readStaffArrangement(access.user.uid, workspace);
  return Response.json({
    order: document.arrangement.order,
    hidden: document.arrangement.hidden,
    saved: document.saved,
  });
}

export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const workspace = resolveWorkspace(request);
  if (!workspace) {
    return Response.json({ error: "unknown workspace" }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const raw = (payload ?? {}) as {
    order?: unknown;
    hidden?: unknown;
    saved?: unknown;
  };
  const normalized = normalizeArrangementFor(workspace, { order: raw.order, hidden: raw.hidden });
  const result = await writeStaffArrangement(access.user.uid, workspace, normalized, raw.saved as never);
  return Response.json({
    order: result.arrangement.order,
    hidden: result.arrangement.hidden,
    saved: result.saved,
  });
}
