import { trackerCsv } from "../../../quotes/quote-tracker.ts";
import { nepalOperationalDate } from "../../../../invoice-effective-status.ts";

/*
 * The tracker download, with its session check, role check and record read
 * injected: `route.ts` supplies the real ones, and a test can drive this exact
 * handler — 401, 403, the CSV body and the 503 — without a Firebase session.
 *
 * The setter is test-only; nothing in the application calls it.
 */

export type TrackerEndpointDeps = {
  access: () => Promise<{ kind: string; user?: unknown }>;
  roleFor: (user: unknown) => Promise<string>;
  records: () => Promise<Array<Record<string, unknown>> | null>;
  /** Defaults to the wall clock; the filename day is always Nepal's. */
  now?: () => Date;
};

type TrackerEndpointTestHooks = Partial<TrackerEndpointDeps>;

const noHooks: TrackerEndpointTestHooks = {};
let testHooks: TrackerEndpointTestHooks = noHooks;

/** Test-only: replace the endpoint's I/O for this process. Not used by the app. */
export function setTrackerEndpointTestHooks(hooks: TrackerEndpointTestHooks) {
  testHooks = hooks;
}

/** Test-only: put the real wiring back. */
export function clearTrackerEndpointTestHooks() {
  testHooks = noHooks;
}

export function createTrackerEndpoint(deps: TrackerEndpointDeps) {
  return async function GET(): Promise<Response> {
    const access = await (testHooks.access ?? deps.access)();
    if (access.kind !== "authorized") {
      return Response.json({ ok: false, error: "Sign in is required." }, { status: 401 });
    }

    const role = await (testHooks.roleFor ?? deps.roleFor)(access.user);
    if (role !== "management") {
      return Response.json({ ok: false, error: "Management access is required." }, { status: 403 });
    }

    const records = await (testHooks.records ?? deps.records)();
    if (!records) {
      return Response.json({ ok: false, error: "Quote records are unavailable." }, { status: 503 });
    }

    const today = nepalOperationalDate((testHooks.now ?? deps.now ?? (() => new Date()))());
    return new Response(`\uFEFF${trackerCsv(records)}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kcpl-quote-tracker-${today}.csv"`,
        "cache-control": "no-store",
      },
    });
  };
}
