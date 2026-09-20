import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../../../admin/shipment-access.server";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { freeTimeBearers, type FreeTimeBearer } from "../../../../../shipment-free-time";
import { readShipmentFreeTime } from "../../../../../shipment-free-time.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalNumber(value: unknown, label: string, max: number) {
  if (value === null || value === undefined || value === "") return { value: null as number | null };
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: `${label} must be zero or greater.` };
  if (parsed > max) return { error: `${label} is above the allowed maximum.` };
  return { value: parsed };
}

async function authorize(reference: string) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
  const staff = await getStaffContext(access.user);
  const normalized = reference.trim().toUpperCase();
  const branchAccess = await checkShipmentBranchAccess(normalized, staff);
  if (branchAccess.kind === "unavailable") return { response: json({ ok: false, error: "Shipment storage is unavailable." }, 503) };
  if (branchAccess.kind === "missing") return { response: json({ ok: false, error: "Shipment not found." }, 404) };
  if (branchAccess.kind === "forbidden") return { response: json({ ok: false, error: "This shipment is outside your branch access." }, 403) };
  return { access, staff, normalized };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await authorize(reference);
  if ("response" in auth) return auth.response;
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Shipment storage is unavailable." }, 503);

  try {
    const record = await readShipmentFreeTime(auth.normalized);
    if (!record) return json({ ok: false, error: "Shipment not found." }, 404);
    return json({
      ok: true,
      freeTime: record.freeTime,
      status: record.status,
      canEdit: auth.staff.permissions.canManageJobFile,
    });
  } catch (error) {
    console.error("KCPL free-time read failed", error);
    return json({ ok: false, error: "The free-time record could not be loaded." }, 500);
  }
}

/**
 * Record what the carrier granted on a shipment.
 *
 * This writes free-time fields and nothing else. It is namespaced away from
 * canonical shipment state on purpose: a demurrage clock is a commercial fact
 * KCPL keeps about a container, never an input to shipment status, delivery or
 * settlement, so nothing downstream can be moved by editing it.
 */
export async function PUT(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  const { reference } = await context.params;
  const auth = await authorize(reference);
  if ("response" in auth) return auth.response;
  const { access, staff, normalized } = auth;
  if (!staff.permissions.canManageJobFile) {
    return json({ ok: false, error: "Job File editing is not available for this account." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The change could not be read." }, 400);
  }

  const startedOn = clean(body.startedOn, 10);
  if (startedOn && !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
    return json({ ok: false, error: "Enter the start date as YYYY-MM-DD." }, 400);
  }
  const days = optionalNumber(body.days, "Free days", 365);
  if ("error" in days) return json({ ok: false, error: days.error }, 400);
  const dailyCharge = optionalNumber(body.dailyCharge, "Daily charge", 1_000_000);
  if ("error" in dailyCharge) return json({ ok: false, error: dailyCharge.error }, 400);
  // A countdown needs both halves: an allowance with no start cannot be counted.
  if ((days.value === null) !== (!startedOn)) {
    return json({ ok: false, error: "Record both the number of free days and the date the clock started, or clear both." }, 400);
  }

  const bearerInput = clean(body.bearer, 20);
  const bearer: FreeTimeBearer = freeTimeBearers.includes(bearerInput as FreeTimeBearer)
    ? bearerInput as FreeTimeBearer
    : "undecided";

  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  try {
    const now = new Date().toISOString();
    await firebaseAdminDb().collection("shipments").doc(normalized).update({
      free_time_location: clean(body.location) || null,
      free_time_days: days.value,
      free_time_started_on: startedOn || null,
      free_time_daily_charge: dailyCharge.value,
      free_time_charge_currency: clean(body.chargeCurrency, 3).toUpperCase() || null,
      free_time_bearer: bearer,
      free_time_note: clean(body.note, 500) || null,
      free_time_updated_at: now,
      free_time_updated_by: access.user.email,
      updated_at: now,
    });
    await firebaseAdminDb().collection("shipments").doc(normalized).collection("job_activity")
      .doc(`free-time-${Date.now()}`)
      .create({
        type: "free_time_updated",
        title: days.value === null ? "Free-time allowance cleared" : `Free time set to ${days.value} days`,
        detail: [clean(body.location), startedOn ? `from ${startedOn}` : ""].filter(Boolean).join(" · ") || null,
        actor_name: access.user.displayName,
        actor_email: access.user.email,
        created_at: now,
      })
      .catch(() => undefined);
    return json({ ok: true });
  } catch (error) {
    console.error("KCPL free-time update failed", error);
    return json({ ok: false, error: "The free-time record could not be saved." }, 500);
  }
}
