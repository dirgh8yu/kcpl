/*
 * Local render fixtures for the staff product.
 *
 * WHY: the Overview only renders its real surface when Firebase is configured.
 * Without it every card falls back to "data unavailable", which makes the page
 * impossible to design against or screenshot. These fixtures fill that gap for
 * local QA and visual iteration (see scripts/qa-render-inventory.mjs, which has
 * the same problem).
 *
 * SAFETY: this is strictly a subset of QA-preview mode. It requires
 * qaAuthBypassEnabled() -- which can never be true in a production runtime, and
 * is pinned by tests/qa-auth-bypass.test.mjs -- AND its own explicit flag. Two
 * independent switches, both off by default, so fabricated operational numbers
 * can never reach a real deployment. Nothing here is imported by a code path
 * that runs without the flag.
 *
 * The data is deterministic: no Math.random and no wall-clock formatting beyond
 * offsets from a single `now`, so two screenshots of an unchanged page are
 * pixel-identical and diffable.
 */

import type { KcplBranch } from "./crm/crm-data";
import type { KcplStaffContext } from "./staff-directory.server";
import { qaAuthBypassEnabled } from "./qa-auth-bypass.ts";
import type { CommandCentreData, CommandCentreJob } from "./command-centre/command-centre-data";
import type { OperationalNote } from "./command-centre/operational-notes.server";
import type { OverviewFinanceSnapshot } from "./command-centre/overview-finance.server";
import type { OverviewActivity, OverviewMovement, WorkflowOverview } from "./command-centre/workflow-overview.server";

type RuntimeEnv = Record<string, string | undefined>;

export function qaMockDataEnabled(env: RuntimeEnv = process.env) {
  if (env.KCPL_QA_MOCK_DATA !== "true") return false;
  return qaAuthBypassEnabled(env);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(now: number, offsetMs: number) {
  return new Date(now + offsetMs).toISOString();
}

/** Nepal is UTC+05:45; the Overview labels its date in that zone. */
function nepalDay(now: number, dayOffset = 0) {
  return new Date(now + dayOffset * DAY + 5.75 * HOUR).toISOString().slice(0, 10);
}

type JobSeed = {
  ref: string;
  customer: string;
  origin: string;
  destination: string;
  mode: CommandCentreJob["mode"];
  status: CommandCentreJob["status"];
  branch: KcplBranch;
  owner: [string, string] | null;
  priority: CommandCentreJob["priority"];
  etaHours: number | null;
  location: string | null;
  carrier: string | null;
  openTasks: number;
  overdueTasks: number;
  customsOpen: number;
  customsTotal: number;
  updatedMinutesAgo: number;
};

/* A deliberately uneven spread: overdue work, customs blockers and unassigned
 * files all appear, because an Overview that only shows healthy rows hides the
 * states the page exists to surface. */
const JOB_SEEDS: JobSeed[] = [
  { ref: "KCPL-2609-0142", customer: "Himalaya Textiles Pvt. Ltd.", origin: "Shanghai", destination: "Kathmandu", mode: "ocean", status: "customs_clearance", branch: "Birgunj", owner: ["Sunita Shrestha", "sunita.shrestha@kcpl.com.np"], priority: "urgent", etaHours: 26, location: "Kolkata Port", carrier: "Maersk", openTasks: 6, overdueTasks: 3, customsOpen: 2, customsTotal: 5, updatedMinutesAgo: 24 },
  { ref: "KCPL-2609-0139", customer: "Everest Pharmaceuticals", origin: "Mumbai", destination: "Kathmandu", mode: "road", status: "in_transit", branch: "Raxaul", owner: ["Bikash Thapa", "bikash.thapa@kcpl.com.np"], priority: "high", etaHours: 9, location: "Raxaul Border", carrier: "TCI Freight", openTasks: 3, overdueTasks: 1, customsOpen: 1, customsTotal: 4, updatedMinutesAgo: 52 },
  { ref: "KCPL-2609-0137", customer: "Nepal Hydro Equipment", origin: "Guangzhou", destination: "Birgunj", mode: "ocean", status: "in_transit", branch: "Birgunj", owner: ["Sunita Shrestha", "sunita.shrestha@kcpl.com.np"], priority: "standard", etaHours: 96, location: "Bay of Bengal", carrier: "COSCO", openTasks: 2, overdueTasks: 0, customsOpen: 0, customsTotal: 3, updatedMinutesAgo: 140 },
  { ref: "KCPL-2609-0136", customer: "Sagarmatha Trading House", origin: "Singapore", destination: "Kathmandu", mode: "air", status: "out_for_delivery", branch: "Kathmandu", owner: ["Anjali Gurung", "anjali.gurung@kcpl.com.np"], priority: "high", etaHours: 3, location: "Kathmandu TIA", carrier: "Nepal Airlines", openTasks: 1, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 16 },
  { ref: "KCPL-2609-0134", customer: "Annapurna Agro Industries", origin: "Kolkata", destination: "Nepalgunj", mode: "road", status: "exception", branch: "Nepalgunj", owner: null, priority: "urgent", etaHours: null, location: "Held at Kolkata", carrier: "Delhivery", openTasks: 5, overdueTasks: 4, customsOpen: 3, customsTotal: 4, updatedMinutesAgo: 8 },
  { ref: "KCPL-2609-0131", customer: "Chandragiri Cement", origin: "Vizag", destination: "Birgunj", mode: "rail", status: "in_transit", branch: "Birgunj", owner: ["Bikash Thapa", "bikash.thapa@kcpl.com.np"], priority: "standard", etaHours: 54, location: "Patna Junction", carrier: "Concor", openTasks: 2, overdueTasks: 0, customsOpen: 1, customsTotal: 3, updatedMinutesAgo: 210 },
  { ref: "KCPL-2609-0129", customer: "Gorkha Brewery", origin: "Rotterdam", destination: "Kathmandu", mode: "ocean", status: "customs_clearance", branch: "Kolkata", owner: ["Prakash Adhikari", "prakash.adhikari@kcpl.com.np"], priority: "high", etaHours: 44, location: "Kolkata Port", carrier: "Hapag-Lloyd", openTasks: 4, overdueTasks: 2, customsOpen: 2, customsTotal: 6, updatedMinutesAgo: 75 },
  { ref: "KCPL-2609-0126", customer: "Surya Nepal", origin: "Delhi", destination: "Surkhet", mode: "road", status: "preparing", branch: "Surkhet", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "standard", etaHours: 120, location: null, carrier: null, openTasks: 3, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 320 },
  { ref: "KCPL-2609-0124", customer: "Himalaya Textiles Pvt. Ltd.", origin: "Dhaka", destination: "Birgunj", mode: "road", status: "booking_confirmed", branch: "Birgunj", owner: null, priority: "standard", etaHours: 150, location: null, carrier: null, openTasks: 2, overdueTasks: 0, customsOpen: 0, customsTotal: 1, updatedMinutesAgo: 400 },
  { ref: "KCPL-2609-0121", customer: "Nepal Telecom", origin: "Shenzhen", destination: "Kathmandu", mode: "air", status: "in_transit", branch: "Kathmandu", owner: ["Anjali Gurung", "anjali.gurung@kcpl.com.np"], priority: "urgent", etaHours: 14, location: "Guangzhou Hub", carrier: "China Southern", openTasks: 3, overdueTasks: 2, customsOpen: 1, customsTotal: 3, updatedMinutesAgo: 35 },
  { ref: "KCPL-2609-0118", customer: "Buddha Air", origin: "Toulouse", destination: "Kathmandu", mode: "air", status: "customs_clearance", branch: "Kathmandu", owner: ["Prakash Adhikari", "prakash.adhikari@kcpl.com.np"], priority: "high", etaHours: 30, location: "Kathmandu TIA", carrier: "Qatar Cargo", openTasks: 4, overdueTasks: 1, customsOpen: 2, customsTotal: 5, updatedMinutesAgo: 90 },
  { ref: "KCPL-2609-0115", customer: "Chaudhary Group", origin: "Bangkok", destination: "Kathmandu", mode: "ocean", status: "in_transit", branch: "Kolkata", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "standard", etaHours: 190, location: "Andaman Sea", carrier: "ONE", openTasks: 1, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 480 },
  { ref: "KCPL-2609-0112", customer: "Dabur Nepal", origin: "Kanpur", destination: "Birgunj", mode: "road", status: "out_for_delivery", branch: "Raxaul", owner: ["Bikash Thapa", "bikash.thapa@kcpl.com.np"], priority: "standard", etaHours: 5, location: "Birgunj ICD", carrier: "VRL Logistics", openTasks: 1, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 44 },
  { ref: "KCPL-2609-0108", customer: "Nepal Hydro Equipment", origin: "Busan", destination: "Birgunj", mode: "ocean", status: "exception", branch: "Birgunj", owner: ["Sunita Shrestha", "sunita.shrestha@kcpl.com.np"], priority: "urgent", etaHours: null, location: "Documentation hold", carrier: "HMM", openTasks: 7, overdueTasks: 5, customsOpen: 4, customsTotal: 6, updatedMinutesAgo: 12 },
  { ref: "KCPL-2609-0104", customer: "Sipradi Trading", origin: "Chennai", destination: "Kathmandu", mode: "road", status: "in_transit", branch: "Raxaul", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "high", etaHours: 38, location: "Muzaffarpur", carrier: "TCI Freight", openTasks: 2, overdueTasks: 1, customsOpen: 1, customsTotal: 3, updatedMinutesAgo: 160 },
  { ref: "KCPL-2609-0101", customer: "Laxmi Intercontinental", origin: "Yokohama", destination: "Kathmandu", mode: "ocean", status: "preparing", branch: "Kathmandu", owner: null, priority: "standard", etaHours: 260, location: null, carrier: null, openTasks: 2, overdueTasks: 0, customsOpen: 0, customsTotal: 1, updatedMinutesAgo: 600 },
  { ref: "KCPL-2609-0097", customer: "Gorkha Brewery", origin: "Antwerp", destination: "Birgunj", mode: "ocean", status: "delivered", branch: "Birgunj", owner: ["Prakash Adhikari", "prakash.adhikari@kcpl.com.np"], priority: "standard", etaHours: -6, location: "Delivered", carrier: "MSC", openTasks: 0, overdueTasks: 0, customsOpen: 0, customsTotal: 4, updatedMinutesAgo: 300 },
  { ref: "KCPL-2609-0094", customer: "Surya Nepal", origin: "Kolkata", destination: "Nepalgunj", mode: "road", status: "delivered", branch: "Nepalgunj", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "standard", etaHours: -20, location: "Delivered", carrier: "Delhivery", openTasks: 0, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 720 },
  /* Kathmandu is head office and carries the most volume; the Overview opens
   * scoped to a single branch, so a thin Kathmandu book made the default view
   * look emptier than the product actually is. */
  { ref: "KCPL-2609-0091", customer: "Vishal Group", origin: "Hamburg", destination: "Kathmandu", mode: "ocean", status: "customs_clearance", branch: "Kathmandu", owner: ["Prakash Adhikari", "prakash.adhikari@kcpl.com.np"], priority: "urgent", etaHours: 20, location: "Kolkata Port", carrier: "MSC", openTasks: 5, overdueTasks: 3, customsOpen: 3, customsTotal: 5, updatedMinutesAgo: 30 },
  { ref: "KCPL-2609-0089", customer: "Nepal Telecom", origin: "Helsinki", destination: "Kathmandu", mode: "air", status: "in_transit", branch: "Kathmandu", owner: null, priority: "high", etaHours: 18, location: "Doha Hub", carrier: "Qatar Cargo", openTasks: 3, overdueTasks: 2, customsOpen: 1, customsTotal: 3, updatedMinutesAgo: 46 },
  { ref: "KCPL-2609-0086", customer: "Himalayan Java", origin: "Sao Paulo", destination: "Kathmandu", mode: "ocean", status: "exception", branch: "Kathmandu", owner: ["Anjali Gurung", "anjali.gurung@kcpl.com.np"], priority: "urgent", etaHours: null, location: "Missing phytosanitary certificate", carrier: "Hapag-Lloyd", openTasks: 6, overdueTasks: 4, customsOpen: 2, customsTotal: 4, updatedMinutesAgo: 18 },
  { ref: "KCPL-2609-0083", customer: "CG Electronics", origin: "Seoul", destination: "Kathmandu", mode: "air", status: "in_transit", branch: "Kathmandu", owner: ["Anjali Gurung", "anjali.gurung@kcpl.com.np"], priority: "standard", etaHours: 40, location: "Incheon", carrier: "Korean Air", openTasks: 2, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 175 },
  { ref: "KCPL-2609-0079", customer: "Sagarmatha Trading House", origin: "Dubai", destination: "Kathmandu", mode: "air", status: "out_for_delivery", branch: "Kathmandu", owner: ["Prakash Adhikari", "prakash.adhikari@kcpl.com.np"], priority: "high", etaHours: 2, location: "Kathmandu metro", carrier: "Emirates SkyCargo", openTasks: 1, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 22 },
  { ref: "KCPL-2609-0075", customer: "Bhat-Bhateni Supermarket", origin: "Bangkok", destination: "Kathmandu", mode: "road", status: "preparing", branch: "Kathmandu", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "standard", etaHours: 112, location: null, carrier: null, openTasks: 2, overdueTasks: 0, customsOpen: 0, customsTotal: 1, updatedMinutesAgo: 260 },
  { ref: "KCPL-2609-0072", customer: "Laxmi Intercontinental", origin: "Osaka", destination: "Kathmandu", mode: "ocean", status: "in_transit", branch: "Kathmandu", owner: ["Bikash Thapa", "bikash.thapa@kcpl.com.np"], priority: "standard", etaHours: 210, location: "East China Sea", carrier: "ONE", openTasks: 1, overdueTasks: 0, customsOpen: 0, customsTotal: 2, updatedMinutesAgo: 520 },
  { ref: "KCPL-2609-0068", customer: "Gorkha Brewery", origin: "Melbourne", destination: "Kathmandu", mode: "ocean", status: "delivered", branch: "Kathmandu", owner: ["Meera Karki", "meera.karki@kcpl.com.np"], priority: "standard", etaHours: -30, location: "Delivered", carrier: "Maersk", openTasks: 0, overdueTasks: 0, customsOpen: 0, customsTotal: 3, updatedMinutesAgo: 840 },
];

function buildJob(seed: JobSeed, now: number, index: number): CommandCentreJob {
  const [ownerName, ownerEmail] = seed.owner ?? [null, null];
  return {
    reference: seed.ref,
    quote_reference: `QT-${seed.ref.slice(5)}`,
    customer_id: `cust-${index + 1}`,
    customer_name: seed.customer,
    origin: seed.origin,
    destination: seed.destination,
    mode: seed.mode,
    status: seed.status,
    primary_branch: seed.branch,
    handling_branches: [seed.branch],
    assigned_to_uid: ownerEmail ? `uid-${ownerEmail.split("@")[0]}` : null,
    assigned_to_name: ownerName,
    assigned_to_email: ownerEmail,
    assigned_to_phone: ownerEmail ? "+977 1 4000000" : null,
    priority: seed.priority,
    eta: seed.etaHours === null ? null : iso(now, seed.etaHours * HOUR),
    current_location: seed.location,
    carrier: seed.carrier,
    open_tasks: seed.openTasks,
    overdue_tasks: seed.overdueTasks,
    required_customs_open: seed.customsOpen,
    required_customs_total: seed.customsTotal,
    updated_at: iso(now, -seed.updatedMinutesAgo * MINUTE),
  };
}

const STAFF_SEEDS: { name: string; email: string }[] = [
  { name: "Sunita Shrestha", email: "sunita.shrestha@kcpl.com.np" },
  { name: "Bikash Thapa", email: "bikash.thapa@kcpl.com.np" },
  { name: "Anjali Gurung", email: "anjali.gurung@kcpl.com.np" },
  { name: "Prakash Adhikari", email: "prakash.adhikari@kcpl.com.np" },
  { name: "Meera Karki", email: "meera.karki@kcpl.com.np" },
];

export function mockCommandCentre(staff: KcplStaffContext, now = Date.now()): CommandCentreData {
  const accessible = staff.can_access_all_branches || staff.branches.length === 0
    ? ([...new Set(JOB_SEEDS.map((seed) => seed.branch))] as KcplBranch[])
    : staff.branches;
  const scoped = JOB_SEEDS.filter((seed) => accessible.includes(seed.branch));
  const jobs = scoped.map((seed, index) => buildJob(seed, now, index));
  const active = jobs.filter((job) => job.status !== "delivered");

  const branchLoad = accessible.map((branch) => {
    const rows = active.filter((job) => job.primary_branch === branch);
    return {
      branch,
      active_jobs: rows.length,
      urgent_jobs: rows.filter((job) => job.priority === "urgent").length,
      overdue_tasks: rows.reduce((total, job) => total + job.overdue_tasks, 0),
      customs_blockers: rows.filter((job) => job.required_customs_open > 0).length,
      deliveries_today: rows.filter((job) => job.status === "out_for_delivery").length,
    };
  });

  const staffLoad = STAFF_SEEDS.map((person) => {
    const rows = active.filter((job) => job.assigned_to_email === person.email);
    return {
      key: person.email,
      uid: `uid-${person.email.split("@")[0]}`,
      name: person.name,
      email: person.email,
      phone: "+977 1 4000000",
      active_jobs: rows.length,
      urgent_jobs: rows.filter((job) => job.priority === "urgent").length,
      open_tasks: rows.reduce((total, job) => total + job.open_tasks, 0),
      overdue_tasks: rows.reduce((total, job) => total + job.overdue_tasks, 0),
    };
  }).filter((row) => row.active_jobs > 0);

  return {
    generated_at: iso(now, 0),
    operational_date: nepalDay(now),
    accessible_branches: accessible,
    totals: {
      active_jobs: active.length,
      urgent_jobs: active.filter((job) => job.priority === "urgent").length,
      overdue_tasks: active.reduce((total, job) => total + job.overdue_tasks, 0),
      customs_blockers: active.filter((job) => job.required_customs_open > 0).length,
      deliveries_today: active.filter((job) => job.status === "out_for_delivery").length,
      unassigned_jobs: active.filter((job) => !job.assigned_to_email).length,
      exception_jobs: active.filter((job) => job.status === "exception").length,
    },
    jobs,
    branch_load: branchLoad,
    staff_load: staffLoad,
  };
}

const MOVEMENT_SEEDS: { ref: string; customer: string; from: string; to: string; mode: string; status: string; at: string | null; etaHours: number; milestone: string; eventHoursAgo: number }[] = [
  { ref: "KCPL-2609-0142", customer: "Himalaya Textiles Pvt. Ltd.", from: "Shanghai", to: "Kathmandu", mode: "ocean", status: "customs_clearance", at: "Kolkata Port", etaHours: 26, milestone: "Customs entry filed", eventHoursAgo: 2 },
  { ref: "KCPL-2609-0139", customer: "Everest Pharmaceuticals", from: "Mumbai", to: "Kathmandu", mode: "road", status: "in_transit", at: "Raxaul Border", etaHours: 9, milestone: "Border crossing started", eventHoursAgo: 1 },
  { ref: "KCPL-2609-0136", customer: "Sagarmatha Trading House", from: "Singapore", to: "Kathmandu", mode: "air", status: "out_for_delivery", at: "Kathmandu TIA", etaHours: 3, milestone: "Out for delivery", eventHoursAgo: 1 },
  { ref: "KCPL-2609-0121", customer: "Nepal Telecom", from: "Shenzhen", to: "Kathmandu", mode: "air", status: "in_transit", at: "Guangzhou Hub", etaHours: 14, milestone: "Departed origin hub", eventHoursAgo: 4 },
  { ref: "KCPL-2609-0131", customer: "Chandragiri Cement", from: "Vizag", to: "Birgunj", mode: "rail", status: "in_transit", at: "Patna Junction", etaHours: 54, milestone: "Rake departed", eventHoursAgo: 7 },
  { ref: "KCPL-2609-0112", customer: "Dabur Nepal", from: "Kanpur", to: "Birgunj", mode: "road", status: "out_for_delivery", at: "Birgunj ICD", etaHours: 5, milestone: "Arrived at ICD", eventHoursAgo: 3 },
];

const ACTIVITY_SEEDS: { ref: string; title: string; detail: string | null; actor: string | null; type: string; tone: OverviewActivity["tone"]; minutesAgo: number }[] = [
  { ref: "KCPL-2609-0108", title: "Shipment moved to exception", detail: "Documentation hold at origin", actor: "Sunita Shrestha", type: "status", tone: "danger", minutesAgo: 12 },
  { ref: "KCPL-2609-0136", title: "Out for delivery", detail: "Kathmandu metro", actor: "Anjali Gurung", type: "status", tone: "success", minutesAgo: 16 },
  { ref: "KCPL-2609-0142", title: "Customs entry filed", detail: "Bill of entry submitted", actor: "Prakash Adhikari", type: "customs", tone: "info", minutesAgo: 24 },
  { ref: "KCPL-2609-0134", title: "Pickup missed", detail: "Carrier did not arrive", actor: null, type: "pickup", tone: "warning", minutesAgo: 38 },
  { ref: "KCPL-2609-0139", title: "Border crossing started", detail: "Raxaul", actor: "Bikash Thapa", type: "milestone", tone: "info", minutesAgo: 52 },
  { ref: "KCPL-2609-0118", title: "Document uploaded", detail: "Airway bill", actor: "Prakash Adhikari", type: "document", tone: "neutral", minutesAgo: 90 },
  { ref: "KCPL-2609-0121", title: "Priority raised to urgent", detail: "Customer escalation", actor: "Anjali Gurung", type: "priority", tone: "warning", minutesAgo: 118 },
  { ref: "KCPL-2609-0097", title: "Proof of delivery verified", detail: "Signed by consignee", actor: "Meera Karki", type: "delivery", tone: "success", minutesAgo: 300 },
];

export function mockWorkflowOverview(now = Date.now()): WorkflowOverview {
  const movements: OverviewMovement[] = MOVEMENT_SEEDS.map((seed) => ({
    reference: seed.ref,
    customer_name: seed.customer,
    origin: seed.from,
    destination: seed.to,
    mode: seed.mode,
    status: seed.status,
    current_location: seed.at,
    eta: iso(now, seed.etaHours * HOUR),
    last_milestone: seed.milestone,
    last_event_at: iso(now, -seed.eventHoursAgo * HOUR),
  }));

  const recent: OverviewActivity[] = ACTIVITY_SEEDS.map((seed, index) => ({
    id: `activity-${index + 1}`,
    reference: seed.ref,
    title: seed.title,
    detail: seed.detail,
    occurred_at: iso(now, -seed.minutesAgo * MINUTE),
    actor_name: seed.actor,
    type: seed.type,
    tone: seed.tone,
  }));

  return {
    planning: { needs_rate_or_selection: 7, selected_for_procurement: 4, booked_orders: 11 },
    tendering: { active: 6, accepted_or_countered: 3, booked: 9 },
    pickup: { unscheduled: 4, requested: 6, confirmed: 12, missed: 1, picked_up_today: 5 },
    documents: { missing_primary: 5, review_pending: 3, generated_current: 42 },
    visibility: { active: 16, delayed: 4, stale: 2, customs: 4, out_for_delivery: 2, departing_today: 3, delivered_today: 2 },
    delivery: { failed_or_refused: 1, pod_pending: 6, pod_overdue: 2, active: 16, verified: 28 },
    finance: { payment_blocked: 2, review_required: 5, disputed: 1, approved_variance: 14 },
    critical_blockers: 3,
    movements,
    recent_activity: recent,
  };
}

function trend(now: number, base: number, margin: number) {
  /* Fourteen points with a fixed wobble -- deterministic, but not a straight line. */
  const wobble = [0.94, 0.97, 1.03, 0.99, 1.08, 1.02, 0.96, 1.05, 1.11, 1.04, 0.98, 1.07, 1.13, 1.09];
  return wobble.map((factor, index) => {
    const revenue = Math.round(base * factor);
    const cost = Math.round(revenue * (1 - margin));
    return {
      date: nepalDay(now, index - (wobble.length - 1)),
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
}

export function mockFinanceSnapshot(now = Date.now()): OverviewFinanceSnapshot {
  const npr = trend(now, 4_850_000, 0.186);
  const usd = trend(now, 36_400, 0.213);
  const sum = (rows: ReturnType<typeof trend>, key: "revenue" | "cost" | "profit") =>
    rows.reduce((total, row) => total + row[key], 0);

  return {
    generated_at: iso(now, 0),
    period_label: "Last 14 days",
    currencies: [
      {
        currency: "NPR",
        revenue: sum(npr, "revenue"),
        cost: sum(npr, "cost"),
        profit: sum(npr, "profit"),
        margin_percent: 18.6,
        revenue_change_percent: 7.4,
        cost_change_percent: 4.1,
        profit_change_percent: 12.8,
        margin_change_points: 1.6,
        trend: npr,
      },
      {
        currency: "USD",
        revenue: sum(usd, "revenue"),
        cost: sum(usd, "cost"),
        profit: sum(usd, "profit"),
        margin_percent: 21.3,
        revenue_change_percent: -2.2,
        cost_change_percent: 1.9,
        profit_change_percent: -9.6,
        margin_change_points: -2.4,
        trend: usd,
      },
    ],
  };
}

export function mockOperationalNote(branch: KcplBranch | null, now = Date.now()): OperationalNote {
  return {
    id: "note-mock-1",
    message: "Raxaul border closes 14:00-16:00 today for a scheduled customs system upgrade. Move any time-critical road clearances to the morning window.",
    branch,
    created_at: iso(now, -3 * HOUR),
    created_by_name: "Sunita Shrestha",
    created_by_email: "sunita.shrestha@kcpl.com.np",
  };
}

/* ----------------------------------------------------------------------------
 * Workspace fixtures.
 *
 * These derive from mockCommandCentre's jobs rather than inventing their own
 * rows, so the pickup queue, the visibility board and the Overview all describe
 * the same shipments. A QA environment where /admin/shipments and
 * /admin/visibility disagree about KCPL-2609-0142 is worse than no fixture.
 *
 * Each returns the shape its real loader returns, and calls that module's own
 * summarize function rather than hand-writing the counts -- so the aggregates
 * are computed by production code and cannot drift from the rows.
 * -------------------------------------------------------------------------- */

import { summarizePickups, type PickupAppointmentStatus, type PickupQueueRow } from "./pickups/pickup-appointments.ts";
import { summarizeVisibility, type TrackingMilestone, type VisibilityShipment } from "./visibility/tracking-visibility.ts";

const PICKUP_STAGE: Record<CommandCentreJob["status"], PickupAppointmentStatus> = {
  booking_confirmed: "unscheduled",
  preparing: "requested",
  in_transit: "picked_up",
  customs_clearance: "picked_up",
  out_for_delivery: "picked_up",
  delivered: "picked_up",
  exception: "missed",
};

const MILESTONE: Record<CommandCentreJob["status"], TrackingMilestone> = {
  booking_confirmed: "booked",
  preparing: "pickup_scheduled",
  in_transit: "departed",
  customs_clearance: "import_customs",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  exception: "exception",
};

export function mockPickupWorkspace(staff: KcplStaffContext, now = Date.now()) {
  const nowIso = iso(now, 0);
  const rows: PickupQueueRow[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    // An unowned file has not been scheduled by anyone yet, which is the state
    // the pickup desk exists to clear.
    const status: PickupAppointmentStatus = job.assigned_to_email ? PICKUP_STAGE[job.status] : "unscheduled";
    const scheduled = status !== "unscheduled";
    const confirmed = status === "confirmed" || status === "driver_assigned" || status === "picked_up";
    return {
      id: `pickup-${index + 1}`,
      shipment_reference: job.reference,
      transport_order_id: `TO-${job.reference.slice(5)}`,
      tender_id: null,
      booking_reference: `BK-${job.reference.slice(5)}`,
      branch: job.primary_branch,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      partner_id: null,
      partner_name: job.carrier,
      origin: job.origin,
      destination: job.destination,
      status,
      channel: index % 3 === 0 ? "carrier_api" : "manual",
      requested_window_start: scheduled ? iso(now, -(index + 2) * HOUR) : null,
      requested_window_end: scheduled ? iso(now, -(index + 1) * HOUR) : null,
      confirmed_window_start: confirmed ? iso(now, -(index + 2) * HOUR) : null,
      confirmed_window_end: confirmed ? iso(now, -(index + 1) * HOUR) : null,
      pickup_location: job.current_location,
      contact_name: job.assigned_to_name,
      contact_phone: job.assigned_to_phone,
      provider_reference: null,
      driver_name: status === "driver_assigned" || status === "picked_up" ? "Ram Bahadur" : null,
      driver_phone: status === "driver_assigned" || status === "picked_up" ? "+977 98 0000000" : null,
      vehicle_reference: status === "picked_up" ? `BA-${2000 + index} KHA` : null,
      attempt_count: status === "missed" ? 2 : 0,
      picked_up_at: status === "picked_up" ? iso(now, -(index + 1) * HOUR) : null,
      missed_at: status === "missed" ? iso(now, -3 * HOUR) : null,
      missed_reason: status === "missed" ? "Carrier vehicle did not arrive" : null,
      notes: null,
      created_at: iso(now, -(index + 6) * HOUR),
      updated_at: job.updated_at,
      shipment_status: job.status,
      current_location: job.current_location,
    };
  });
  return { kind: "ready" as const, rows, summary: summarizePickups(rows, nowIso), generated_at: nowIso };
}

export function mockVisibilityWorkspace(staff: KcplStaffContext, now = Date.now()) {
  const nowIso = iso(now, 0);
  const rows: VisibilityShipment[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    // Every third active file has slipped against its original ETA, so the
    // delayed and stale columns are exercised rather than always reading zero.
    const slipped = job.status !== "delivered" && index % 3 === 1;
    const lastEventHoursAgo = job.status === "exception" ? 26 : (index % 5) + 1;
    return {
      reference: job.reference,
      quote_reference: job.quote_reference,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      primary_branch: job.primary_branch,
      handling_branches: job.handling_branches,
      status: job.status,
      carrier: job.carrier,
      carrier_reference: job.carrier ? `${job.carrier.slice(0, 3).toUpperCase()}-${job.reference.slice(-4)}` : null,
      eta: job.eta,
      original_eta: slipped && job.eta ? iso(Date.parse(job.eta), -14 * HOUR) : job.eta,
      current_location: job.current_location,
      last_milestone: MILESTONE[job.status],
      last_event_at: iso(now, -lastEventHoursAgo * HOUR),
      last_received_at: iso(now, -lastEventHoursAgo * HOUR),
      last_source: index % 3 === 0 ? "carrier_api" : "manual",
      last_provider: job.carrier,
      observed_external_milestone: null,
      observed_external_at: null,
      observed_external_provider: null,
      external_reconciliation_status: null,
      external_promotion_blocker: null,
      stale_after: iso(now, (12 - lastEventHoursAgo) * HOUR),
      stale: lastEventHoursAgo > 12,
      eta_delta_hours: slipped ? 14 : null,
      updated_at: job.updated_at,
    };
  });
  return { kind: "ready" as const, rows, summary: summarizeVisibility(rows, nowIso), generated_at: nowIso };
}

import {
  primaryCarriageDocumentKind,
  recommendedGeneratedDocumentKinds,
  type FreightDocumentQueueRow,
  type GeneratedFreightDocumentKind,
  type GeneratedFreightDocumentRow,
} from "./freight-documents/freight-documents.ts";
import { summarizeDelivery, type DeliveryAttemptStatus, type DeliveryPodState, type DeliveryQueueRow } from "./delivery/delivery-control.ts";
import type { ShipmentDocumentType } from "../shipment-document-types";

const DOCUMENT_TYPE: Record<GeneratedFreightDocumentKind, ShipmentDocumentType> = {
  house_bill_of_lading: "bill_of_lading",
  house_air_waybill: "air_waybill",
  road_consignment_note: "road_consignment_note",
  shipping_instruction: "shipping_instruction",
  cargo_manifest: "cargo_manifest",
  pickup_order: "pickup_order",
  delivery_order: "delivery_order",
};

export function mockFreightDocumentWorkspace(staff: KcplStaffContext, now = Date.now()) {
  const rows: FreightDocumentQueueRow[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    const primary = primaryCarriageDocumentKind(job.mode);
    // Every third file is missing its primary carriage document, which is the
    // queue's whole reason to exist -- if all of them had one the screen would
    // always read zero.
    const hasPrimary = Boolean(primary) && index % 3 !== 0;
    const kinds: GeneratedFreightDocumentKind[] = hasPrimary && primary ? [primary, "cargo_manifest"] : ["cargo_manifest"];
    const generated: GeneratedFreightDocumentRow[] = kinds.map((kind, position) => ({
      document_id: `doc-${index + 1}-${position + 1}`,
      shipment_reference: job.reference,
      kind,
      label: kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      filename: `${job.reference}-${kind}.pdf`,
      document_type: DOCUMENT_TYPE[kind],
      revision: 1,
      review_status: index % 4 === 1 ? "under_review" : "approved",
      customer_safe: kind !== "cargo_manifest",
      sha256: `${index}`.padStart(64, "0"),
      generated_at: iso(now, -(index + 2) * HOUR),
      generated_by_name: job.assigned_to_name,
      superseded: false,
    }));
    return {
      reference: job.reference,
      branch: job.primary_branch,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      booking_reference: `BK-${job.reference.slice(5)}`,
      carrier_name: job.carrier,
      transport_order_id: `TO-${job.reference.slice(5)}`,
      pieces: 12 + index * 3,
      weight_kg: 850 + index * 145,
      volume_cbm: 4 + index,
      container_count: job.mode === "ocean" ? 1 : 0,
      equipment: job.mode === "ocean" ? "40HC" : null,
      pickup_date: nepalDay(now, -2),
      delivery_date: job.eta ? job.eta.slice(0, 10) : null,
      cargo_description: `${job.customer_name} consignment`,
      updated_at: job.updated_at,
      recommended_kinds: recommendedGeneratedDocumentKinds(job.mode),
      generated_documents: generated,
      current_generated_count: generated.filter((doc) => !doc.superseded).length,
      missing_primary_carriage_document: Boolean(primary && !generated.some((doc) => doc.kind === primary && !doc.superseded)),
    };
  });
  // Mirrors the production derivation in freight-documents.server.ts rather than
  // stating the counts, so the summary cannot disagree with the table.
  const summary = {
    eligible: rows.length,
    missing_primary: rows.filter((row) => row.missing_primary_carriage_document).length,
    generated_current: rows.reduce((sum, row) => sum + row.current_generated_count, 0),
    review_pending: rows.reduce((sum, row) => sum + row.generated_documents.filter((doc) => !doc.superseded && ["received", "under_review"].includes(doc.review_status)).length, 0),
  };
  return { kind: "ready" as const, rows, summary, generated_at: iso(now, 0) };
}

const DELIVERY_STATE: Record<CommandCentreJob["status"], DeliveryPodState> = {
  booking_confirmed: "not_started",
  preparing: "not_started",
  in_transit: "not_started",
  customs_clearance: "not_started",
  out_for_delivery: "delivery_active",
  delivered: "delivered_pod_pending",
  exception: "delivery_failed",
};

export function mockDeliveryWorkspace(staff: KcplStaffContext, now = Date.now()) {
  const rows: DeliveryQueueRow[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    const state = DELIVERY_STATE[job.status];
    // One delivered file per pair has a verified POD, so the queue shows both
    // outstanding and cleared proof rather than a single state.
    const verified = state === "delivered_pod_pending" && index % 2 === 0;
    const attempted = state !== "not_started";
    const lastAttempt: DeliveryAttemptStatus | null = state === "delivery_failed"
      ? "failed"
      : state === "delivery_active"
        ? "out_for_delivery"
        : state === "delivered_pod_pending"
          ? "delivered"
          : null;
    return {
      reference: job.reference,
      quote_reference: job.quote_reference,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      primary_branch: job.primary_branch,
      status: job.status,
      delivery_state: verified ? "pod_verified" : state,
      attempt_count: state === "delivery_failed" ? 2 : attempted ? 1 : 0,
      last_attempt_status: lastAttempt,
      last_attempt_at: attempted ? iso(now, -(index + 1) * HOUR) : null,
      pod_status: verified ? "verified" : state === "delivered_pod_pending" ? "received" : "not_received",
      pod_evidence_count: verified ? 2 : state === "delivered_pod_pending" ? 1 : 0,
      recipient_name: verified || state === "delivered_pod_pending" ? "Warehouse supervisor" : null,
      next_delivery_at: state === "delivery_failed" ? iso(now, 18 * HOUR) : job.eta,
      current_location: job.current_location,
      updated_at: job.updated_at,
    };
  });
  return { kind: "ready" as const, rows, summary: summarizeDelivery(rows), generated_at: iso(now, 0) };
}

import type { AutomationAlert, AutomationAlertSeverity, AutomationAlertType } from "./alerts/alert-data.ts";

/* Alerts are not independent data: every one of them is a shipment problem the
 * Overview already knows about. Deriving them from the same jobs means the
 * alert list and the attention queue never contradict each other. */
export function mockAutomationAlerts(staff: KcplStaffContext, now = Date.now()): AutomationAlert[] {
  const jobs = mockCommandCentre(staff, now).jobs.filter((job) => job.status !== "delivered");
  const alerts: AutomationAlert[] = [];
  const push = (
    job: CommandCentreJob,
    type: AutomationAlertType,
    severity: AutomationAlertSeverity,
    title: string,
    detail: string,
    hoursAgo: number,
  ) => {
    const index = alerts.length + 1;
    alerts.push({
      id: `alert-${index}`,
      fingerprint: `${type}:${job.reference}`,
      type,
      severity,
      status: index % 5 === 0 ? "acknowledged" : "open",
      title,
      detail,
      entity_type: "shipment",
      entity_id: job.reference,
      parent_reference: job.reference,
      branch: job.primary_branch,
      assigned_to_name: job.assigned_to_name,
      assigned_to_email: job.assigned_to_email,
      target_roles: ["operations"],
      action_path: `/admin/jobs/${encodeURIComponent(job.reference)}`,
      first_triggered_at: iso(now, -(hoursAgo + 6) * HOUR),
      last_triggered_at: iso(now, -hoursAgo * HOUR),
      escalated_at: severity === "critical" ? iso(now, -hoursAgo * HOUR) : null,
      acknowledged_at: index % 5 === 0 ? iso(now, -1 * HOUR) : null,
      acknowledged_by_name: index % 5 === 0 ? "Sunita Shrestha" : null,
      acknowledged_by_email: index % 5 === 0 ? "sunita.shrestha@kcpl.com.np" : null,
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
    });
  };

  for (const job of jobs) {
    if (job.status === "exception") {
      push(job, "shipment_exception", "critical", "Shipment exception", job.current_location ?? "Exception raised at origin", 1);
    }
    if (job.overdue_tasks > 0) {
      push(job, "job_task_overdue", job.overdue_tasks >= 3 ? "critical" : "warning", `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, `${job.customer_name} · ${job.origin} to ${job.destination}`, 2);
    }
    if (job.required_customs_open > 0) {
      push(job, "customs_open", "warning", `${job.required_customs_open} customs step${job.required_customs_open === 1 ? "" : "s"} open`, `Required before clearance at ${job.destination}`, 3);
    }
    if (!job.assigned_to_email) {
      push(job, "shipment_unassigned", "warning", "Shipment unassigned", `${job.customer_name} has no owner`, 4);
    }
  }
  return alerts;
}

import {
  DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT,
  DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT,
  summarizeFreightAudits,
  type FreightAuditQueueRow,
  type FreightAuditStatus,
} from "./freight-audit/freight-audit.ts";

/* One supplier bill per shipment that has a carrier. The variance is what the
 * audit desk is for, so a third of the bills disagree with the booked cost --
 * a queue where every invoice matches never exercises its own screen. */
export function mockFreightAuditQueue(staff: KcplStaffContext, now = Date.now()) {
  const rows: FreightAuditQueueRow[] = mockCommandCentre(staff, now).jobs
    .filter((job) => job.carrier)
    .map((job, index) => {
      const booked = 42_000 + index * 3_500;
      const variance = index % 3 === 0 ? Math.round(booked * 0.085) : index % 3 === 1 ? Math.round(booked * 0.004) : 0;
      const invoiceTotal = booked + variance;
      const variancePercent = booked ? Number(((variance / booked) * 100).toFixed(2)) : 0;
      const withinTolerance = Math.abs(variancePercent) <= 1;
      const status: FreightAuditStatus = variance === 0
        ? "matched"
        : withinTolerance
          ? "approved_variance"
          : index % 6 === 0
            ? "disputed"
            : "review_required";
      return {
        payable_reference: `AP-${job.reference.slice(5)}`,
        shipment_reference: job.reference,
        supplier_id: null,
        supplier_name: job.carrier ?? "Unknown carrier",
        supplier_bill_reference: `INV-${job.reference.slice(-4)}`,
        branch: job.primary_branch,
        status,
        invoice_currency: "NPR",
        invoice_subtotal: invoiceTotal,
        invoice_tax: 0,
        invoice_total: invoiceTotal,
        booked_partner_id: null,
        booked_partner_name: job.carrier,
        booked_currency: "NPR",
        booked_cost: booked,
        booked_commercial_version_id: `cv-${index + 1}`,
        booked_commercial_fingerprint: `fp-${index + 1}`,
        commercial_lineage_status: "versioned",
        expected_linehaul: booked,
        expected_fuel_surcharge: 0,
        expected_accessorials: 0,
        expected_rate_unit: job.mode === "ocean" ? "per_container" : "per_shipment",
        expected_quantity: 1,
        minimum_applied: false,
        variance_amount: variance || null,
        variance_percent: variance ? variancePercent : null,
        tolerance_amount: DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT,
        tolerance_percent: DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT,
        within_tolerance: withinTolerance,
        duplicate_of: null,
        issues: variance && !withinTolerance
          ? [{ code: "amount_variance" as const, severity: "blocking" as const, title: "Invoice exceeds booked cost", detail: `Billed ${invoiceTotal} against a booked ${booked}` }]
          : [],
        dispute_note: status === "disputed" ? "Raised with the carrier for re-issue" : null,
        resolution_note: null,
        audited_at: status === "matched" ? iso(now, -(index + 1) * HOUR) : null,
        audited_by_name: status === "matched" ? "Prakash Adhikari" : null,
        audited_by_email: status === "matched" ? "prakash.adhikari@kcpl.com.np" : null,
        approved_at: status === "approved_variance" ? iso(now, -(index + 2) * HOUR) : null,
        approved_by_name: status === "approved_variance" ? "Prakash Adhikari" : null,
        approved_by_email: status === "approved_variance" ? "prakash.adhikari@kcpl.com.np" : null,
        updated_at: job.updated_at,
        payable_status: status === "disputed" ? "on_hold" : "open",
        customer_name: job.customer_name,
        carrier_reference: job.carrier ? `${job.carrier.slice(0, 3).toUpperCase()}-${job.reference.slice(-4)}` : null,
      };
    });
  return { kind: "ready" as const, rows, summary: summarizeFreightAudits(rows), generated_at: iso(now, 0) };
}

import type { CustomsDeskRow, CustomsDeskStep } from "./customs/customs-data.server.ts";
import { customsDeskRisk, customsDeskState } from "./customs/customs-policy.ts";

/* The desk's state and risk are not restated here -- customsDeskState and
 * customsDeskRisk classify the rows, so the badges come from the same policy
 * the real page runs. */
export function mockCustomsDeskRows(staff: KcplStaffContext, now = Date.now()): CustomsDeskRow[] {
  return mockCommandCentre(staff, now).jobs
    .filter((job) => job.required_customs_total > 0 && job.status !== "delivered")
    .map((job, index) => {
      const completed = job.required_customs_total - job.required_customs_open;
      const steps: CustomsDeskStep[] = Array.from({ length: job.required_customs_total }, (_, position) => ({
        id: `${job.reference}-step-${position + 1}`,
        title: ["Bill of entry", "Duty assessment", "Physical inspection", "Release order", "Gate pass", "Transit permit"][position % 6],
        detail: position < completed ? "Completed" : "Awaiting customs broker",
        branch: job.primary_branch,
        completed: position < completed,
      }));
      const openSteps = steps.filter((step) => !step.completed);
      // Every fourth file is short a document, which is what blocks a desk.
      const missing = index % 4 === 0 && job.required_customs_open > 0
        ? [{ type: "commercial_invoice" as ShipmentDocumentType, label: "Commercial invoice", reason: "Required for duty assessment", uploaded: false }]
        : [];
      const clearanceStatus = job.status === "customs_clearance"
        ? (index % 5 === 0 ? "held" as const : "lodged" as const)
        : job.required_customs_open === 0 ? "released" as const : "preparing" as const;
      const etaDays = job.eta ? Math.round((Date.parse(job.eta) - now) / DAY) : null;
      const releaseRequired = job.mode === "ocean" || job.mode === "air";
      return {
        reference: job.reference,
        quote_reference: job.quote_reference,
        customer_name: job.customer_name,
        origin: job.origin,
        destination: job.destination,
        mode: job.mode,
        status: job.status,
        eta: job.eta,
        current_location: job.current_location,
        branch: job.primary_branch,
        handling_branches: job.handling_branches,
        assigned_to_name: job.assigned_to_name,
        assigned_to_email: job.assigned_to_email,
        customs_required: job.required_customs_total,
        customs_completed: completed,
        customs_open: job.required_customs_open,
        customs_other_branch_open: 0,
        open_steps: openSteps,
        customs_integrity_warnings: [],
        missing_documents: missing,
        document_required: 3,
        document_present: 3 - missing.length,
        document_direction: "import",
        document_advisories: [],
        release_required: releaseRequired,
        clearance: {
          status: clearanceStatus,
          entry_point: job.primary_branch === "Birgunj" ? "Birgunj ICD" : "Tribhuvan Customs",
          declaration_reference: `DEC-${job.reference.slice(-4)}`,
          agent_partner_id: null,
          agent_name: "Himal Clearing Agency",
          hold_reason: clearanceStatus === "held" ? "Valuation query raised by customs" : null,
          release_evidence: clearanceStatus === "released" ? `REL-${job.reference.slice(-4)}` : null,
          released_at: clearanceStatus === "released" ? iso(now, -6 * HOUR) : null,
          updated_at: job.updated_at,
          updated_by_name: job.assigned_to_name,
          updated_by_email: job.assigned_to_email,
        },
        state: customsDeskState({
          requiredSteps: job.required_customs_total,
          openSteps: openSteps.length,
          missingDocuments: missing.length,
          integrityIssues: 0,
          shipmentInCustoms: job.status === "customs_clearance",
          releaseRequired,
          clearanceStatus,
        }),
        risk: customsDeskRisk({
          status: job.status,
          openSteps: openSteps.length,
          missingDocuments: missing.length,
          integrityIssues: 0,
          etaDays,
          releaseRequired,
        }),
      };
    });
}
