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
    // Mock activity mirror: the newest job_activity entry is the invoice at
    // -2h for seeded jobs, so a couple of them land inside the register's
    // 15-minute live-activity window and demonstrate the badge.
    latest_activity_at: index < 2 ? iso(now, -(5 + index * 3) * MINUTE) : iso(now, -2 * HOUR),
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
import { suggestChecklist, type ChecklistEvidence } from "./customs/checklist-recommender.ts";
import { laneDwellBaseline, dwellWarning, type DwellEvidenceItem } from "./customs/lane-dwell-baseline.ts";

/* The desk's state and risk are not restated here -- customsDeskState and
 * customsDeskRisk classify the rows, so the badges come from the same policy
 * the real page runs. */
const MOCK_CHECKLIST_LANE = "guangzhou→birgunj";

/**
 * Worked lane history for the QA fixture: three completed Guangzhou→Birgunj
 * ocean shipments whose documents are the evidence the recommender learns
 * from. The suggestion counts are therefore derived, not asserted, and the
 * KCPL-2609-0137 mock row (same lane, ocean, Birgunj) renders them live.
 */
function mockChecklistEvidence(): ChecklistEvidence[] {
  const oceanSet = (extra: ShipmentDocumentType[]): ShipmentDocumentType[] => [
    "commercial_invoice",
    "packing_list",
    "bill_of_lading",
    ...extra,
  ];
  return [
    { lane: MOCK_CHECKLIST_LANE, mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document"]) },
    { lane: MOCK_CHECKLIST_LANE, mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document", "certificate_of_origin"]) },
    { lane: MOCK_CHECKLIST_LANE, mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document"]) },
    // Shanghai→Kathmandu history so the 90h-clearance fixture row (0142)
    // shows the checklist suggestion alongside its slow-clearance warning.
    { lane: "shanghai→kathmandu", mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document"]) },
    { lane: "shanghai→kathmandu", mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document"]) },
    { lane: "shanghai→kathmandu", mode: "ocean", branch: "Birgunj", delivered: true, documents: oceanSet(["customs_document", "insurance_certificate"]) },
  ];
}

const MOCK_DWELL_LANE = "guangzhou→birgunj";
const customsLabel = "Customs clearance";
const outForDeliveryLabel = "Out for delivery";

/**
 * Worked dwell history for the QA fixture: three completed Guangzhou→Birgunj
 * clearances (58h, 70h, 66h) rebuilt from status-label event streams. The
 * baseline therefore derives to p75 ≈ 68h, and a fixture row in clearance for
 * 80+ hours renders the slow-clearance warning honestly.
 */
function mockDwellEvidence(now: number): DwellEvidenceItem[] {
  const stream = (entryOffsetHours: number, dwellHours: number): { title: string; at: string }[] => {
    const entry = now - entryOffsetHours * 3_600_000;
    return [
      { title: "Booking confirmed", at: new Date(entry - 96 * 3_600_000).toISOString() },
      { title: customsLabel, at: new Date(entry).toISOString() },
      { title: outForDeliveryLabel, at: new Date(entry + dwellHours * 3_600_000).toISOString() },
    ];
  };
  return [
    { lane: MOCK_DWELL_LANE, titles: stream(400, 58) },
    { lane: MOCK_DWELL_LANE, titles: stream(700, 70) },
    { lane: MOCK_DWELL_LANE, titles: stream(1000, 66) },
    // Shanghai→Kathmandu history so the fixture row parked 90h in clearance
    // (KCPL-2609-0142) trips its lane's learned p75 (~66h) honestly.
    { lane: "shanghai→kathmandu", titles: stream(500, 60) },
    { lane: "shanghai→kathmandu", titles: stream(800, 72) },
    { lane: "shanghai→kathmandu", titles: stream(1100, 64) },
  ];
}

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
      // The dwell baseline learns from the mock lane history; a fixture row
      // sitting in clearance for 90 hours trips the learned p75 (~68h).
      const lane = `${job.origin.toLowerCase()}→${job.destination.toLowerCase()}`;
      const baseline = laneDwellBaseline(mockDwellEvidence(now), lane);
      const elapsedHours = job.status === "customs_clearance" && clearanceStatus !== "released"
        ? (job.reference === "KCPL-2609-0142" ? 90 : 20)
        : null;
      const dwellPolicy = dwellWarning({ baseline, elapsedHours });
      const dwellWarningRow = { active: dwellPolicy.active, elapsed_hours: dwellPolicy.elapsedHours, p75_hours: dwellPolicy.p75Hours, sample: dwellPolicy.sample, message: dwellPolicy.message };
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
        suggested_checklist: suggestChecklist(mockChecklistEvidence(), { lane: `${job.origin.toLowerCase()}→${job.destination.toLowerCase()}`, mode: job.mode, branch: job.primary_branch }),
        dwell_baseline: { available: baseline.available, sample: baseline.sample, median_hours: baseline.medianHours, p75_hours: baseline.p75Hours },
        dwell_warning: dwellWarningRow,
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

import type { DocumentVaultDashboard, DocumentVaultRow } from "./documents/documents-data.server.ts";
import type { QuoteSummary, QuoteStatus } from "./admin-data.ts";
import type { ShipmentDocumentReviewStatus } from "../shipment-document-types";

const VAULT_REVIEW: ShipmentDocumentReviewStatus[] = ["verified", "under_review", "received", "rejected", "verified", "superseded"];

/* Two documents per shipment. The counts on the vault header are tallied from
 * the rows below rather than stated, so the header cannot disagree with the
 * table -- and the review states rotate so every filter has something in it. */
export function mockDocumentVault(staff: KcplStaffContext, now = Date.now()): DocumentVaultDashboard {
  const rows: DocumentVaultRow[] = [];
  mockCommandCentre(staff, now).jobs.forEach((job, jobIndex) => {
    const kinds: { type: ShipmentDocumentType; label: string }[] = [
      { type: "commercial_invoice", label: "Commercial invoice" },
      { type: job.mode === "air" ? "air_waybill" : job.mode === "ocean" ? "bill_of_lading" : "road_consignment_note", label: "Carriage document" },
    ];
    kinds.forEach((kind, position) => {
      const review = VAULT_REVIEW[(jobIndex + position) % VAULT_REVIEW.length];
      const expired = (jobIndex + position) % 9 === 0;
      const customerSent = kind.type === "commercial_invoice";
      rows.push({
        id: rows.length + 1,
        shipment_reference: job.reference,
        customer_id: job.customer_id,
        customer_name: job.customer_name,
        branch: job.primary_branch,
        handling_branches: job.handling_branches,
        shipment_status: job.status,
        origin: job.origin,
        destination: job.destination,
        mode: job.mode,
        filename: `${job.reference}-${kind.type}.pdf`,
        document_type: kind.type,
        content_type: "application/pdf",
        size_bytes: 180_000 + rows.length * 4_200,
        uploaded_at: iso(now, -(jobIndex + 2) * HOUR),
        // Shipper-originated papers are shown arriving from the customer portal
        // so the review queue's provenance badge has something to render.
        uploaded_by: customerSent ? job.customer_name : job.assigned_to_name ?? "KCPL Operations",
        uploaded_by_email: customerSent ? null : job.assigned_to_email,
        uploaded_by_source: customerSent ? "customer_portal" : "staff",
        review_status: review,
        effective_status: expired ? "expired" : review,
        customer_safe: kind.type !== "commercial_invoice",
        review_note: review === "rejected" ? "Illegible scan, please re-upload" : null,
        reviewed_at: review === "received" ? null : iso(now, -(jobIndex + 1) * HOUR),
        reviewed_by: review === "received" ? null : "Prakash Adhikari",
        reviewed_by_email: review === "received" ? null : "prakash.adhikari@kcpl.com.np",
        verified_at: review === "verified" ? iso(now, -jobIndex * HOUR) : null,
        verified_by: review === "verified" ? "Prakash Adhikari" : null,
        verified_by_email: review === "verified" ? "prakash.adhikari@kcpl.com.np" : null,
        expires_on: expired ? nepalDay(now, -2) : null,
        supersedes_document_id: null,
        superseded_by_document_id: null,
        deleted_at: null,
        deleted_by: null,
        deleted_by_email: null,
        sha256: `${rows.length}`.padStart(64, "0"),
        storage_delete_pending: false,
      });
    });
  });
  const count = (predicate: (row: DocumentVaultRow) => boolean) => rows.filter(predicate).length;
  return {
    generated_at: iso(now, 0),
    rows,
    active_count: count((row) => row.effective_status !== "deleted" && row.effective_status !== "superseded"),
    verified_count: count((row) => row.effective_status === "verified"),
    review_count: count((row) => row.effective_status === "received" || row.effective_status === "under_review"),
    rejected_count: count((row) => row.effective_status === "rejected"),
    expired_count: count((row) => row.effective_status === "expired"),
    deleted_count: count((row) => row.effective_status === "deleted"),
    cleanup_pending_count: count((row) => row.storage_delete_pending),
  };
}

const QUOTE_STATUS: QuoteStatus[] = ["new", "reviewing", "quoted", "won", "lost"];

/* Enquiries sit upstream of shipments, so each job's quote_reference gets its
 * enquiry back, plus a few that never converted -- a pipeline where everything
 * is won shows none of the states the desk works through. */
export function mockQuoteSummaries(staff: KcplStaffContext, now = Date.now()): QuoteSummary[] {
  const jobs = mockCommandCentre(staff, now).jobs;
  const converted: QuoteSummary[] = jobs.map((job, index) => ({
    reference: job.quote_reference,
    created_at: iso(now, -(index + 3) * DAY),
    status: "won",
    origin: job.origin,
    destination: job.destination,
    mode: job.mode,
    cargo_type: job.mode === "ocean" ? "FCL" : "General cargo",
    contact_name: job.assigned_to_name ?? "KCPL desk",
    contact_email: `ops@${job.customer_name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
    company_name: job.customer_name,
    phone: "+977 1 4000000",
    customer_id: job.customer_id,
    assigned_to: job.assigned_to_name,
    assigned_to_uid: job.assigned_to_uid,
    assigned_to_name: job.assigned_to_name,
    assigned_to_email: job.assigned_to_email,
    assigned_to_phone: job.assigned_to_phone,
    note_count: index % 3,
    email_count: 1 + (index % 4),
    last_customer_email_at: iso(now, -(index + 1) * DAY),
  }));
  const open: QuoteSummary[] = ["Nepal Cold Storage", "Kathmandu Valley Traders", "Pokhara Handicrafts", "Janakpur Agro", "Butwal Steel", "Dharan Timber"].map((company, index) => ({
    reference: `QT-2609-${900 + index}`,
    created_at: iso(now, -(index + 1) * DAY),
    status: QUOTE_STATUS[index % 4],
    origin: ["Shanghai", "Singapore", "Dubai", "Kolkata", "Delhi", "Bangkok"][index],
    destination: "Kathmandu",
    mode: ["ocean", "air", "road", "ocean", "road", "air"][index],
    cargo_type: "General cargo",
    contact_name: ["Ramesh Karki", "Sita Rai", "Deepak Lama", "Nirmala Joshi", "Kiran Bista", "Asha Magar"][index],
    contact_email: `enquiries@${company.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
    company_name: company,
    phone: "+977 1 4000000",
    customer_id: null,
    assigned_to: index % 2 === 0 ? "Meera Karki" : null,
    assigned_to_uid: index % 2 === 0 ? "uid-meera.karki" : null,
    assigned_to_name: index % 2 === 0 ? "Meera Karki" : null,
    assigned_to_email: index % 2 === 0 ? "meera.karki@kcpl.com.np" : null,
    assigned_to_phone: index % 2 === 0 ? "+977 1 4000000" : null,
    note_count: index % 2,
    email_count: index % 3,
    last_customer_email_at: index % 3 ? iso(now, -(index + 1) * HOUR) : null,
  }));
  return [...open, ...converted];
}

import type { CrmAccountStatus, CrmCustomerSummary, CrmLeadStage } from "./crm/crm-data.ts";
import type { PartnerDashboard, PartnerMode, PartnerRecord, PartnerType } from "./partners/partners-data.ts";

/* Customers come out of the shipments: each distinct customer_name in the job
 * book becomes an account, with its shipment counts tallied from those jobs.
 * Six prospects are appended so the lead pipeline is not uniformly "won". */
export function mockCrmCustomers(staff: KcplStaffContext, now = Date.now()): CrmCustomerSummary[] {
  const jobs = mockCommandCentre(staff, now).jobs;
  const names = [...new Set(jobs.map((job) => job.customer_name))];
  const accounts: CrmCustomerSummary[] = names.map((name, index) => {
    const mine = jobs.filter((job) => job.customer_name === name);
    const active = mine.filter((job) => job.status !== "delivered").length;
    const revenue = 1_250_000 + index * 340_000;
    const cost = Math.round(revenue * 0.81);
    return {
      id: mine[0].customer_id ?? `cust-${index + 1}`,
      entity_kind: "company",
      display_name: name,
      legal_name: `${name} Pvt. Ltd.`,
      relationship_types: ["customer"],
      account_status: "active",
      lead_stage: "won",
      lead_source: index % 2 === 0 ? "referral" : "existing_customer",
      primary_email: `accounts@${name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
      primary_phone: "+977 1 4000000",
      country: "Nepal",
      primary_branch: mine[0].primary_branch,
      account_manager_uid: mine[0].assigned_to_uid,
      account_manager_name: mine[0].assigned_to_name,
      account_manager_email: mine[0].assigned_to_email,
      account_manager_phone: mine[0].assigned_to_phone,
      account_manager_job_title: "Operations executive",
      account_manager_branches: [mine[0].primary_branch],
      tags: index % 3 === 0 ? ["key account"] : [],
      quote_count: mine.length,
      active_shipment_count: active,
      completed_shipment_count: mine.length - active,
      follow_up_count: index % 3,
      revenue_total: revenue,
      cost_total: cost,
      profit_total: revenue - cost,
      preferred_currency: "NPR",
      archived: false,
      created_at: iso(now, -(index + 40) * DAY),
      updated_at: mine[0].updated_at,
    };
  });

  const stages: CrmLeadStage[] = ["new_lead", "contacted", "qualified", "quote_sent", "negotiating", "lost"];
  const statuses: CrmAccountStatus[] = ["prospect", "prospect", "prospect", "active", "prospect", "dormant"];
  const prospects: CrmCustomerSummary[] = ["Nepal Cold Storage", "Kathmandu Valley Traders", "Pokhara Handicrafts", "Janakpur Agro", "Butwal Steel", "Dharan Timber"].map((name, index) => ({
    id: `prospect-${index + 1}`,
    entity_kind: "company",
    display_name: name,
    legal_name: null,
    relationship_types: ["customer"],
    account_status: statuses[index],
    lead_stage: stages[index],
    lead_source: "website",
    primary_email: `hello@${name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
    primary_phone: "+977 1 4000000",
    country: "Nepal",
    primary_branch: "Kathmandu",
    account_manager_uid: index % 2 === 0 ? "uid-meera.karki" : null,
    account_manager_name: index % 2 === 0 ? "Meera Karki" : null,
    account_manager_email: index % 2 === 0 ? "meera.karki@kcpl.com.np" : null,
    account_manager_phone: index % 2 === 0 ? "+977 1 4000000" : null,
    account_manager_job_title: index % 2 === 0 ? "Commercial executive" : null,
    account_manager_branches: index % 2 === 0 ? ["Kathmandu"] : [],
    tags: [],
    quote_count: 1 + (index % 3),
    active_shipment_count: 0,
    completed_shipment_count: 0,
    follow_up_count: index % 2,
    revenue_total: 0,
    cost_total: 0,
    profit_total: 0,
    preferred_currency: "NPR",
    archived: false,
    created_at: iso(now, -(index + 2) * DAY),
    updated_at: iso(now, -(index + 1) * HOUR),
  }));
  return [...accounts, ...prospects];
}

const PARTNER_TYPE: Record<string, PartnerType> = {
  ocean: "shipping_line",
  air: "airline",
  road: "transporter",
  rail: "transporter",
};

/* Partners are the carriers already moving the shipments, so the partner
 * directory and the shipment register name the same companies. */
export function mockPartnerDashboard(staff: KcplStaffContext, now = Date.now()): PartnerDashboard {
  const jobs = mockCommandCentre(staff, now).jobs;
  const carriers = [...new Set(jobs.map((job) => job.carrier).filter((name): name is string => Boolean(name)))];
  const partners: PartnerRecord[] = carriers.map((name, index) => {
    const mine = jobs.filter((job) => job.carrier === name);
    const mode = mine[0].mode;
    const openAmount = 180_000 + index * 42_000;
    return {
      id: `partner-${index + 1}`,
      display_name: name,
      legal_name: null,
      normalized_name: name.toLowerCase().replace(/\s+/g, " "),
      types: [PARTNER_TYPE[mode] ?? "other"],
      modes: [(mode === "ocean" ? "sea" : mode === "rail" ? "rail" : mode === "air" ? "air" : "road") as PartnerMode],
      status: index % 7 === 0 ? "on_hold" : "active",
      preferred: index % 3 === 0,
      country: ["China", "India", "Singapore", "Germany", "Nepal", "Denmark"][index % 6],
      owner_branch: mine[0].primary_branch,
      cities_served: [...new Set(mine.map((job) => job.origin))].slice(0, 3),
      countries_served: ["Nepal", "India"],
      ports_served: mode === "ocean" ? ["Kolkata", "Haldia"] : [],
      primary_contact_name: "Partner desk",
      primary_email: `ops@${name.toLowerCase().replace(/[^a-z]+/g, "")}.com`,
      primary_phone: "+977 1 4000000",
      whatsapp: null,
      website: null,
      preferred_currency: "USD",
      payment_terms_days: 30,
      service_rating: 3 + (index % 3),
      registration_number: null,
      tax_id: null,
      contract_reference: index % 2 === 0 ? `CT-${2600 + index}` : null,
      contract_expiry_date: index % 2 === 0 ? nepalDay(now, 120) : null,
      document_url: null,
      commercial_terms: null,
      internal_notes: null,
      tags: index % 3 === 0 ? ["preferred"] : [],
      created_at: iso(now, -(index + 60) * DAY),
      created_by_name: "KCPL Operations",
      created_by_email: "ops@kcpl.com.np",
      updated_at: mine[0].updated_at,
      updated_by_name: "KCPL Operations",
      updated_by_email: "ops@kcpl.com.np",
      payable_open: [{ currency: "USD", amount: openAmount }],
      payable_spend: [{ currency: "USD", amount: openAmount * 4 }],
      bill_count: mine.length,
      overdue_bill_count: index % 4 === 0 ? 1 : 0,
      shipment_count: mine.length,
      last_activity_at: mine[0].updated_at,
    };
  });
  // Tallied from the rows, mirroring the production derivation.
  return {
    generated_at: iso(now, 0),
    partners,
    active_count: partners.filter((partner) => partner.status === "active").length,
    preferred_count: partners.filter((partner) => partner.preferred && partner.status === "active").length,
    country_count: new Set(partners.filter((partner) => partner.status !== "inactive").map((partner) => partner.country.trim()).filter(Boolean)).size,
    unlinked_supplier_bills: 2,
    legacy_name_linked_bill_count: 1,
    open_payables: [{ currency: "USD", amount: partners.reduce((sum, partner) => sum + (partner.payable_open[0]?.amount ?? 0), 0) }],
  };
}

import type { KcplStaffProfile } from "./staff-directory.ts";
import type { CrmCurrency } from "./crm/crm-data.ts";
import type {
  FinanceCurrencySummary,
  FinanceDashboard,
  FinanceInvoice,
  FinanceInvoiceStatus,
} from "./finance/finance-data.ts";

/* The five names the shipments are already assigned to, so the staff directory
 * and every owner column agree. */
export function mockStaffProfiles(now = Date.now()): KcplStaffProfile[] {
  const roles = ["operations", "operations", "commercial", "accounts", "management"] as const;
  return STAFF_SEEDS.map((person, index) => ({
    uid: `uid-${person.email.split("@")[0]}`,
    email: person.email,
    display_name: person.name,
    job_title: ["Operations executive", "Operations executive", "Commercial executive", "Accounts executive", "Operations manager"][index],
    phone: "+977 1 4000000",
    role: roles[index],
    branch_scope: index === 4 ? "all" : "selected",
    branches: index === 4 ? [] : [(["Kathmandu", "Birgunj", "Kathmandu", "Kolkata", "Kathmandu"] as KcplBranch[])[index]],
    active: true,
    created_at: iso(now, -(index + 200) * DAY),
    updated_at: iso(now, -(index + 1) * DAY),
    updated_by: "ops@kcpl.com.np",
  }));
}

const INVOICE_STATUS: FinanceInvoiceStatus[] = ["paid", "issued", "overdue", "partially_paid", "draft", "paid"];

/* One receivable per shipment. Statuses rotate so the ageing buckets are not
 * all empty, and every currency summary is tallied from the invoices rather
 * than stated -- the header cannot disagree with the ledger below it. */
export function mockFinanceDashboard(staff: KcplStaffContext, now = Date.now()): FinanceDashboard {
  const invoices: FinanceInvoice[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    const status = INVOICE_STATUS[index % INVOICE_STATUS.length];
    const subtotal = 240_000 + index * 38_500;
    const tax = Math.round(subtotal * 0.13);
    const total = subtotal + tax;
    const paid = status === "paid" ? total : status === "partially_paid" ? Math.round(total * 0.4) : 0;
    const dueDays = status === "overdue" ? -(12 + (index % 40)) : 14 - (index % 10);
    return {
      reference: `INV-${job.reference.slice(5)}`,
      record_type: "invoice",
      external_invoice_number: null,
      migration_batch_id: null,
      migration_as_of_date: null,
      customer_id: job.customer_id ?? `cust-${index + 1}`,
      customer_name: job.customer_name,
      shipment_reference: job.reference,
      quote_reference: job.quote_reference,
      branch: job.primary_branch,
      status,
      issue_date: nepalDay(now, -(index + 10)),
      due_date: nepalDay(now, dueDays),
      currency: "NPR",
      line_items: [{
        id: `line-${index + 1}`,
        description: `${job.mode} freight ${job.origin} to ${job.destination}`,
        quantity: 1,
        unit_price: subtotal,
        tax_rate: 13,
        subtotal,
        tax_amount: tax,
        total,
      }],
      subtotal,
      tax_total: tax,
      total,
      amount_paid: paid,
      balance_due: total - paid,
      notes: null,
      created_by_name: "Prakash Adhikari",
      created_by_email: "prakash.adhikari@kcpl.com.np",
      created_at: iso(now, -(index + 10) * DAY),
      updated_at: job.updated_at,
      payments: paid
        ? [{
            id: `pay-${index + 1}`,
            invoice_reference: `INV-${job.reference.slice(5)}`,
            amount: paid,
            currency: "NPR" as CrmCurrency,
            payment_date: nepalDay(now, -(index + 2)),
            method: "bank_transfer" as const,
            reference: `TXN-${9000 + index}`,
            notes: null,
            recorded_by_name: "Prakash Adhikari",
            recorded_by_email: "prakash.adhikari@kcpl.com.np",
            created_at: iso(now, -(index + 2) * DAY),
          }]
        : [],
    };
  });

  const ageDays = (invoice: FinanceInvoice) => Math.floor((now - Date.parse(`${invoice.due_date}T00:00:00Z`)) / DAY);
  const bucket = (from: number, to: number) => invoices
    .filter((invoice) => invoice.balance_due > 0 && ageDays(invoice) >= from && ageDays(invoice) <= to)
    .reduce((sum, invoice) => sum + invoice.balance_due, 0);
  const summary: FinanceCurrencySummary = {
    currency: "NPR",
    invoiced: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    opening_balance: 0,
    collected: invoices.reduce((sum, invoice) => sum + invoice.amount_paid, 0),
    outstanding: invoices.reduce((sum, invoice) => sum + invoice.balance_due, 0),
    overdue: invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.balance_due, 0),
    aging_0_30: bucket(0, 30),
    aging_31_60: bucket(31, 60),
    aging_61_90: bucket(61, 90),
    aging_90_plus: bucket(91, Number.MAX_SAFE_INTEGER),
    invoice_count: invoices.length,
    opening_balance_count: 0,
  };
  const count = (status: FinanceInvoiceStatus) => invoices.filter((invoice) => invoice.status === status).length;
  return {
    generated_at: iso(now, 0),
    invoices,
    currency_summaries: [summary],
    overdue_count: count("overdue"),
    unpaid_count: invoices.filter((invoice) => invoice.balance_due > 0).length,
    paid_count: count("paid"),
    draft_count: count("draft"),
    opening_balance_count: 0,
  };
}

import { carrierIntegrationDefinitions, type CarrierIntegrationProvider, type CarrierIntegrationState } from "./carrier-integrations/carrier-integrations.ts";
import type { CarrierProviderDashboard, CarrierShipmentCandidate } from "./carrier-integrations/carrier-integrations.server.ts";
import type { MigrationBatchDashboard, MigrationBatchSummary } from "./migration/migration-batches.ts";

const PROVIDER_FOR_MODE: Record<string, CarrierIntegrationProvider | null> = {
  ocean: "maersk_ocean",
  air: "dhl_express",
  road: null,
  rail: null,
};

/* The provider cards come from carrierIntegrationDefinitions, so the
 * capabilities and auth notes are the real ones -- only the health is
 * synthesised, and one provider is left degraded so that state is visible. */
export function mockCarrierIntegrations(staff: KcplStaffContext, now = Date.now()) {
  const providers: CarrierProviderDashboard[] = carrierIntegrationDefinitions.map((definition, index) => {
    const state: CarrierIntegrationState = index === 0 ? "healthy" : "degraded";
    return {
      id: definition.id,
      label: definition.label,
      carrier: definition.carrier,
      modes: definition.modes,
      auth: definition.auth,
      capabilities: definition.capabilities,
      active_capabilities: definition.activeCapabilities,
      docs_note: definition.docsNote,
      state,
      configured: true,
      configuration: { tracking: true, schedules: index === 0, webhook: index === 0, private_api: false },
      last_action: state === "healthy" ? "tracking_poll" : "tracking_poll",
      last_success_at: iso(now, -(index + 1) * HOUR),
      last_failure_at: state === "degraded" ? iso(now, -30 * MINUTE) : null,
      last_http_status: state === "degraded" ? 503 : 200,
      last_message: state === "degraded" ? "Provider returned 503 on the last poll" : "OK",
      last_latency_ms: state === "degraded" ? 8_400 : 420,
    };
  });

  const rows: CarrierShipmentCandidate[] = mockCommandCentre(staff, now).jobs
    .filter((job) => job.carrier)
    .map((job, index) => {
      const provider = PROVIDER_FOR_MODE[job.mode] ?? null;
      return {
        reference: job.reference,
        provider,
        carrier: job.carrier ?? "",
        carrier_reference: provider ? `${job.carrier?.slice(0, 3).toUpperCase()}-${job.reference.slice(-4)}` : null,
        booking_reference: `BK-${job.reference.slice(5)}`,
        mode: job.mode,
        status: job.status,
        branch: job.primary_branch,
        current_location: job.current_location,
        last_tracking_at: provider ? iso(now, -(index + 1) * HOUR) : null,
        last_tracking_provider: provider,
        last_sync_at: provider ? iso(now, -(index + 1) * HOUR) : null,
        sync_error: provider && index % 6 === 0 ? "Carrier rejected the reference on the last sync" : null,
      };
    });

  return {
    kind: "ready" as const,
    providers,
    rows,
    // Tallied from the rows, mirroring the production derivation.
    summary: {
      configured: providers.filter((provider) => provider.configured).length,
      degraded: providers.filter((provider) => provider.state === "degraded").length,
      linked_shipments: rows.filter((row) => row.provider).length,
      dhl_sync_ready: rows.filter((row) => row.provider === "dhl_express" && row.carrier_reference).length,
      maersk_linked: rows.filter((row) => row.provider === "maersk_ocean").length,
    },
    generated_at: iso(now, 0),
  };
}

/* Import history. One batch per outcome the screen distinguishes, so the
 * completed / partial / interrupted counters are never all in one column. */
export function mockMigrationBatches(now = Date.now()): MigrationBatchDashboard {
  const seeds: { type: string; stage: string; status: MigrationBatchSummary["status"]; total: number; invalid: number; duplicate: number }[] = [
    { type: "customers", stage: "Stage 1 · Customers", status: "completed", total: 148, invalid: 0, duplicate: 6 },
    { type: "shipments", stage: "Stage 2 · Shipments", status: "completed", total: 312, invalid: 0, duplicate: 11 },
    { type: "receivables", stage: "Stage 3 · Receivables", status: "partial_failure", total: 96, invalid: 7, duplicate: 3 },
    { type: "payables", stage: "Stage 3 · Payables", status: "interrupted", total: 64, invalid: 2, duplicate: 1 },
    { type: "customers", stage: "Stage 1 · Customers", status: "running", total: 40, invalid: 0, duplicate: 0 },
  ];
  const batches: MigrationBatchSummary[] = seeds.map((seed, index) => {
    const ready = seed.total - seed.invalid - seed.duplicate;
    const imported = seed.status === "completed" ? ready : seed.status === "partial_failure" ? ready - seed.invalid : seed.status === "interrupted" ? Math.floor(ready / 2) : 0;
    return {
      id: `batch-${index + 1}`,
      stage_label: seed.stage,
      type_label: seed.type.replace(/^./, (c) => c.toUpperCase()),
      type: seed.type,
      phase: seed.stage.split("·")[0].trim(),
      status: seed.status,
      stored_status: seed.status,
      source_filename: `kcpl-${seed.type}-2026-09.csv`,
      total_rows: seed.total,
      ready_rows: ready,
      duplicate_rows: seed.duplicate,
      invalid_rows: seed.invalid,
      imported_count: imported,
      created_by_name: "Sunita Shrestha",
      created_by_email: "sunita.shrestha@kcpl.com.np",
      created_at: iso(now, -(index + 2) * DAY),
      completed_at: seed.status === "running" ? null : iso(now, -(index + 2) * DAY + 40 * MINUTE),
      error: seed.status === "partial_failure" ? `${seed.invalid} rows failed validation` : seed.status === "interrupted" ? "Import interrupted before completion" : null,
      rollback_status: null,
      rollback_recovery_id: null,
      rollback_completed_at: null,
      rollback_error: null,
      rollback_reversed_record_keys: [],
      created_records: [],
      detail_metrics: [
        { label: "Ready", value: ready },
        { label: "Duplicates", value: seed.duplicate },
        { label: "Invalid", value: seed.invalid },
      ],
    };
  });
  const count = (status: MigrationBatchSummary["status"]) => batches.filter((batch) => batch.status === status).length;
  return {
    generated_at: iso(now, 0),
    batches,
    total_batches: batches.length,
    completed_batches: count("completed"),
    partial_failure_batches: count("partial_failure"),
    interrupted_batches: count("interrupted"),
    imported_records: batches.reduce((sum, batch) => sum + batch.imported_count, 0),
  };
}

import type { PartnerOption } from "./partners/partners-data.ts";
import type {
  PayableBill,
  PayableCurrencySummary,
  PayableStatus,
  PayablesDashboard,
} from "./payables/payables-data.ts";

/* The active partners as selectable options, so the payables form offers the
 * same suppliers the partner directory lists. */
export function mockPartnerOptions(staff: KcplStaffContext, now = Date.now()): PartnerOption[] {
  return mockPartnerDashboard(staff, now).partners
    .filter((partner) => partner.status === "active")
    .map((partner) => ({
      id: partner.id,
      name: partner.display_name,
      currency: partner.preferred_currency,
      payment_terms_days: partner.payment_terms_days,
      owner_branch: partner.owner_branch,
      types: partner.types,
    }));
}

const PAYABLE_STATUS: PayableStatus[] = ["paid", "approved", "overdue", "partially_paid", "draft", "approved"];

/* One supplier bill per carried shipment, mirroring the freight-audit queue so
 * the two finance screens describe the same liabilities. */
export function mockPayablesDashboard(staff: KcplStaffContext, now = Date.now()): PayablesDashboard {
  const bills: PayableBill[] = mockCommandCentre(staff, now).jobs
    .filter((job) => job.carrier)
    .map((job, index) => {
      const status = PAYABLE_STATUS[index % PAYABLE_STATUS.length];
      const subtotal = 42_000 + index * 3_500;
      const tax = 0;
      const total = subtotal + tax;
      const paid = status === "paid" ? total : status === "partially_paid" ? Math.round(total * 0.5) : 0;
      const dueDays = status === "overdue" ? -(9 + (index % 50)) : 21 - (index % 12);
      return {
        reference: `AP-${job.reference.slice(5)}`,
        record_type: "bill" as const,
        supplier_id: null,
        supplier_name: job.carrier ?? "Unknown carrier",
        supplier_bill_reference: `INV-${job.reference.slice(-4)}`,
        shipment_reference: job.reference,
        customer_id: job.customer_id,
        customer_name: job.customer_name,
        branch: job.primary_branch,
        category: "freight" as const,
        status,
        bill_date: nepalDay(now, -(index + 6)),
        due_date: nepalDay(now, dueDays),
        currency: "USD" as CrmCurrency,
        description: `${job.mode} freight ${job.origin} to ${job.destination}`,
        subtotal,
        tax_rate: 0,
        tax_total: tax,
        total,
        amount_paid: paid,
        balance_due: total - paid,
        notes: null,
        migration_batch_id: null,
        migration_as_of_date: null,
        created_by_name: "Prakash Adhikari",
        created_by_email: "prakash.adhikari@kcpl.com.np",
        created_at: iso(now, -(index + 6) * DAY),
        updated_at: job.updated_at,
        payments: paid
          ? [{
              id: `appay-${index + 1}`,
              payable_reference: `AP-${job.reference.slice(5)}`,
              amount: paid,
              currency: "USD" as CrmCurrency,
              payment_date: nepalDay(now, -(index + 1)),
              method: "bank_transfer" as const,
              reference: `TXN-AP-${7000 + index}`,
              notes: null,
              recorded_by_name: "Prakash Adhikari",
              recorded_by_email: "prakash.adhikari@kcpl.com.np",
              created_at: iso(now, -(index + 1) * DAY),
            }]
          : [],
      };
    });

  const ageDays = (bill: PayableBill) => Math.floor((now - Date.parse(`${bill.due_date}T00:00:00Z`)) / DAY);
  const bucket = (from: number, to: number) => bills
    .filter((bill) => bill.balance_due > 0 && ageDays(bill) >= from && ageDays(bill) <= to)
    .reduce((sum, bill) => sum + bill.balance_due, 0);
  const summary: PayableCurrencySummary = {
    currency: "USD",
    billed: bills.reduce((sum, bill) => sum + bill.total, 0),
    opening_balance: 0,
    paid: bills.reduce((sum, bill) => sum + bill.amount_paid, 0),
    outstanding: bills.reduce((sum, bill) => sum + bill.balance_due, 0),
    overdue: bills.filter((bill) => bill.status === "overdue").reduce((sum, bill) => sum + bill.balance_due, 0),
    aging_0_30: bucket(0, 30),
    aging_31_60: bucket(31, 60),
    aging_61_90: bucket(61, 90),
    aging_90_plus: bucket(91, Number.MAX_SAFE_INTEGER),
    bill_count: bills.length,
    opening_balance_count: 0,
  };
  const count = (status: PayableStatus) => bills.filter((bill) => bill.status === status).length;
  return {
    generated_at: iso(now, 0),
    bills,
    currency_summaries: [summary],
    overdue_count: count("overdue"),
    unpaid_count: bills.filter((bill) => bill.balance_due > 0).length,
    paid_count: count("paid"),
    draft_count: count("draft"),
    opening_balance_count: 0,
  };
}

import type {
  CustomerPricingProfile,
  PricingOrderCandidate,
  PricingRule,
} from "./pricing/tms-pricing.ts";
import type { TmsMode } from "./rating/tms-rating.ts";

const TMS_MODE: Record<string, TmsMode> = { ocean: "sea", air: "air", road: "road", rail: "rail" };

/* Orders awaiting a sell price, the customers they belong to, and the markup
 * rules that would apply. The pricing statuses rotate so the desk shows unpriced
 * work and work already quoted, not one uniform column. */
export function mockPricingWorkspace(staff: KcplStaffContext, now = Date.now()) {
  const jobs = mockCommandCentre(staff, now).jobs.filter((job) => job.status !== "delivered");
  const orders: PricingOrderCandidate[] = jobs.map((job, index) => ({
    id: `TO-${job.reference.slice(5)}`,
    branch: job.primary_branch,
    customer_id: job.customer_id,
    origin: job.origin,
    destination: job.destination,
    mode: TMS_MODE[job.mode] ?? "multimodal",
    customer_name: job.customer_name,
    buy_cost: 42_000 + index * 3_500,
    buy_currency: "USD",
    status: job.status,
    pricing_status: (["unpriced", "priced", "approval_required", "quoted"] as const)[index % 4],
    quoted_reference: index % 4 === 3 ? job.quote_reference : null,
  }));

  const customers: CustomerPricingProfile[] = [...new Set(jobs.map((job) => job.customer_name))].map((name, index) => {
    const mine = jobs.find((job) => job.customer_name === name)!;
    return {
      id: mine.customer_id ?? `cust-${index + 1}`,
      display_name: name,
      preferred_currency: "NPR",
      markup_percent: index % 3 === 0 ? 18 : null,
      pricing_notes: index % 3 === 0 ? "Contracted markup, review each quarter" : null,
      primary_branch: mine.primary_branch,
    };
  });

  const rules: PricingRule[] = [
    { id: "rule-1", name: "Global floor", active: true, priority: 100, scope: "global", branch: null, customer_id: null, origin: null, destination: null, mode: null, sell_currency: null, markup_percent: 15, target_margin_percent: 18, minimum_margin_percent: 8, accessorial_markup_percent: 10, fixed_markup: 0, approval_below_margin_percent: 10, notes: "Applies when nothing more specific matches", created_at: iso(now, -200 * DAY), updated_at: iso(now, -40 * DAY) },
    { id: "rule-2", name: "Ocean import via Kolkata", active: true, priority: 50, scope: "lane", branch: "Birgunj", customer_id: null, origin: "Kolkata", destination: "Kathmandu", mode: "sea", sell_currency: "USD", markup_percent: 12, target_margin_percent: 15, minimum_margin_percent: 7, accessorial_markup_percent: 8, fixed_markup: 150, approval_below_margin_percent: 9, notes: null, created_at: iso(now, -120 * DAY), updated_at: iso(now, -20 * DAY) },
    { id: "rule-3", name: "Air express", active: true, priority: 40, scope: "branch", branch: "Kathmandu", customer_id: null, origin: null, destination: null, mode: "air", sell_currency: "USD", markup_percent: 22, target_margin_percent: 25, minimum_margin_percent: 12, accessorial_markup_percent: 12, fixed_markup: 0, approval_below_margin_percent: 14, notes: null, created_at: iso(now, -90 * DAY), updated_at: iso(now, -10 * DAY) },
    { id: "rule-4", name: "Legacy road rule", active: false, priority: 10, scope: "global", branch: null, customer_id: null, origin: null, destination: null, mode: "road", sell_currency: null, markup_percent: 9, target_margin_percent: null, minimum_margin_percent: 5, accessorial_markup_percent: 5, fixed_markup: 0, approval_below_margin_percent: 6, notes: "Superseded by the global floor", created_at: iso(now, -300 * DAY), updated_at: iso(now, -150 * DAY) },
  ];

  return { kind: "ready" as const, orders, customers, rules };
}

import type { EdiLedgerRow } from "./edi/edi-gateway.server.ts";
import type { EdiTransactionSet, EdiTransactionStatus } from "./edi/edi-x12.ts";

/* An EDI ledger for the shipments that have a carrier: a 204 tender out, a 990
 * response back, then 214 status messages. One is quarantined, because a
 * gateway screen whose failure column is always empty hides the reason it
 * exists. */
export function mockEdiGateway(staff: KcplStaffContext, now = Date.now()) {
  const rows: EdiLedgerRow[] = [];
  mockCommandCentre(staff, now).jobs
    .filter((job) => job.carrier)
    .forEach((job, index) => {
      const add = (direction: "inbound" | "outbound", set: EdiTransactionSet, status: EdiTransactionStatus, hoursAgo: number, message: string | null) => {
        rows.push({
          id: `edi-${rows.length + 1}`,
          direction,
          transaction_set: set,
          status,
          branch: job.primary_branch,
          partner: job.carrier,
          reference: `ISA-${5000 + rows.length}`,
          tender_reference: `TND-${job.reference.slice(5)}`,
          shipment_reference: job.reference,
          transaction_control: `${1000 + rows.length}`,
          interchange_control: `${900000 + rows.length}`,
          message,
          created_at: iso(now, -hoursAgo * HOUR),
          processed_at: status === "processed" || status === "dispatched" ? iso(now, -(hoursAgo - 1) * HOUR) : null,
        });
      };
      add("outbound", "204", index % 5 === 0 ? "queued" : "dispatched", index + 6, null);
      if (index % 5 !== 0) add("inbound", "990", "processed", index + 4, "Tender accepted");
      if (index % 7 === 0) {
        add("inbound", "214", "quarantined", index + 2, "Segment L11 missing a qualifier");
      } else {
        add("inbound", "214", "processed", index + 2, "Status update applied");
      }
    });

  // Tallied from the rows, mirroring the production derivation.
  const summary = {
    outbound204Queued: rows.filter((row) => row.transaction_set === "204" && row.status === "queued").length,
    outbound204Dispatched: rows.filter((row) => row.transaction_set === "204" && row.status === "dispatched").length,
    inbound990Processed: rows.filter((row) => row.transaction_set === "990" && row.status === "processed").length,
    inbound214Processed: rows.filter((row) => row.transaction_set === "214" && row.status === "processed").length,
    quarantined: rows.filter((row) => row.status === "quarantined" || row.status === "failed").length,
  };
  return { kind: "ready" as const, rows, summary, configured: true };
}

import type { TmsTender, TmsTenderChannel, TmsTenderStatus } from "./tenders/tms-tendering.ts";

const TENDER_STATUS: TmsTenderStatus[] = ["booked", "sent", "accepted", "countered", "sent", "rejected"];

/* One tender per carried shipment. The EDI gateway needs sent tenders on the
 * manual or edi_204 channels to have anything to queue a 204 against, so those
 * statuses and channels are deliberately present. */
export function mockTmsTenders(staff: KcplStaffContext, now = Date.now()) {
  const tenders: TmsTender[] = mockCommandCentre(staff, now).jobs
    .filter((job) => job.carrier)
    .map((job, index) => {
      const status = TENDER_STATUS[index % TENDER_STATUS.length];
      const channel: TmsTenderChannel = index % 3 === 0 ? "edi_204" : index % 3 === 1 ? "manual" : "email";
      const offered = 42_000 + index * 3_500;
      const countered = status === "countered" ? Math.round(offered * 1.08) : null;
      const settled = status === "booked" || status === "accepted";
      return {
        id: `tender-${index + 1}`,
        order_id: `TO-${job.reference.slice(5)}`,
        tender_reference: `TND-${job.reference.slice(5)}`,
        status,
        channel,
        partner_id: `partner-${index + 1}`,
        partner_name: job.carrier ?? "Unknown carrier",
        recipient_name: "Partner desk",
        recipient_email: `ops@${job.carrier?.toLowerCase().replace(/[^a-z]+/g, "")}.com`,
        rate_card_id: `rc-${index + 1}`,
        mode: TMS_MODE[job.mode] ?? "multimodal",
        service: job.mode === "air" ? "Express" : "Standard",
        equipment: job.mode === "ocean" ? "40HC" : null,
        currency: "USD",
        offered_cost: offered,
        counter_cost: countered,
        counter_currency: countered ? "USD" : null,
        final_cost: settled ? offered : null,
        final_currency: settled ? "USD" : null,
        origin: job.origin,
        destination: job.destination,
        pickup_date: nepalDay(now, -2),
        response_due_at: iso(now, (index % 4) * HOUR + 2 * HOUR),
        sent_at: iso(now, -(index + 5) * HOUR),
        responded_at: status === "sent" ? null : iso(now, -(index + 2) * HOUR),
        response_note: status === "rejected" ? "No equipment available on the requested date" : null,
        booking_reference: status === "booked" ? `BK-${job.reference.slice(5)}` : null,
        pickup_confirmation: status === "booked" ? `PU-${job.reference.slice(-4)}` : null,
        booked_at: status === "booked" ? iso(now, -(index + 1) * HOUR) : null,
        shipment_reference: job.reference,
        created_by_name: job.assigned_to_name ?? "KCPL Operations",
        created_by_email: job.assigned_to_email ?? "ops@kcpl.com.np",
        updated_at: job.updated_at,
      };
    });
  return { kind: "ready" as const, tenders };
}

import type { TmsOrder, TmsOrderStatus } from "./rating/tms-rating.ts";
import type { TmsConsolidationLoad, TmsLoadMember } from "./consolidation/tms-consolidation.ts";

const ORDER_STATUS: TmsOrderStatus[] = ["booked", "selected", "rated", "tendering", "draft", "booked"];

/* The transport order behind each shipment. Rating, pricing, tendering and the
 * load planner all read these, so they are one list rather than four. */
export function mockTmsOrders(staff: KcplStaffContext, now = Date.now()) {
  const orders: TmsOrder[] = mockCommandCentre(staff, now).jobs.map((job, index) => {
    const status = ORDER_STATUS[index % ORDER_STATUS.length];
    const selected = status === "booked" || status === "selected" || status === "tendering";
    return {
      id: `TO-${job.reference.slice(5)}`,
      branch: job.primary_branch,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      origin: job.origin,
      destination: job.destination,
      mode: TMS_MODE[job.mode] ?? "multimodal",
      pickup_date: nepalDay(now, -2),
      delivery_date: job.eta ? job.eta.slice(0, 10) : null,
      weight_kg: 850 + index * 145,
      volume_cbm: 4 + index,
      pieces: 12 + index * 3,
      container_count: job.mode === "ocean" ? 1 : 0,
      equipment: job.mode === "ocean" ? "40HC" : null,
      temperature_requirement: null,
      carrier_requirement: job.carrier,
      notes: null,
      status,
      selected_rate_card_id: selected ? `rc-${index + 1}` : null,
      selected_partner_id: selected ? `partner-${index + 1}` : null,
      selected_cost: selected ? 42_000 + index * 3_500 : null,
      selected_currency: selected ? "USD" : null,
      created_at: iso(now, -(index + 8) * DAY),
      created_by_name: job.assigned_to_name ?? "KCPL Operations",
      created_by_email: job.assigned_to_email ?? "ops@kcpl.com.np",
      updated_at: job.updated_at,
    };
  });
  return { kind: "ready" as const, orders };
}

/* Two consolidation loads built from the ocean and road orders, so the planner
 * shows a load being procured and one already booked. */
export function mockConsolidationLoads(staff: KcplStaffContext, now = Date.now()) {
  const orders = mockTmsOrders(staff, now).orders;
  const build = (
    index: number,
    mode: TmsMode,
    status: TmsConsolidationLoad["status"],
    pool: TmsOrder[],
  ): TmsConsolidationLoad => {
    const members: TmsLoadMember[] = pool.slice(0, 3).map((order) => ({
      order_id: order.id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      origin: order.origin,
      destination: order.destination,
      mode: order.mode,
      weight_kg: order.weight_kg,
      volume_cbm: order.volume_cbm,
      pieces: order.pieces,
      container_count: order.container_count,
      equipment: order.equipment,
      temperature_requirement: null,
      prior_selected_cost: order.selected_cost,
      prior_selected_currency: order.selected_currency,
      allocated_cost: status === "booked" ? order.selected_cost : null,
      allocated_currency: status === "booked" ? order.selected_currency : null,
      shipment_reference: order.id.replace("TO-", "KCPL-"),
    }));
    return {
      id: `load-${index + 1}`,
      reference: `LD-2609-${100 + index}`,
      name: `${mode === "sea" ? "Kolkata ocean" : "Raxaul road"} consolidation ${index + 1}`,
      branch: members[0]?.origin === "Kolkata" ? "Kolkata" : "Birgunj",
      mode,
      status,
      equipment: mode === "sea" ? "40HC" : "10T truck",
      capacity_weight_kg: mode === "sea" ? 26_000 : 10_000,
      capacity_volume_cbm: mode === "sea" ? 67 : 38,
      capacity_pieces: 200,
      capacity_containers: mode === "sea" ? 1 : null,
      members,
      stops: [
        { id: `stop-${index}-1`, sequence: 1, kind: "pickup", location: members[0]?.origin ?? "Kolkata", order_ids: members.map((member) => member.order_id), planned_at: iso(now, -2 * DAY), instructions: null },
        { id: `stop-${index}-2`, sequence: 2, kind: "customs", location: "Birgunj ICD", order_ids: members.map((member) => member.order_id), planned_at: iso(now, -1 * DAY), instructions: null },
        { id: `stop-${index}-3`, sequence: 3, kind: "delivery", location: "Kathmandu", order_ids: members.map((member) => member.order_id), planned_at: iso(now, 1 * DAY), instructions: null },
      ],
      master_order_id: status === "booked" ? `TO-MASTER-${index + 1}` : null,
      master_tender_id: status === "booked" ? `tender-master-${index + 1}` : null,
      master_booking_reference: status === "booked" ? `BK-LD-${100 + index}` : null,
      procurement_partner_id: status === "booked" ? "partner-1" : null,
      procurement_partner_name: status === "booked" ? "Maersk" : null,
      procurement_cost: status === "booked" ? 96_000 : null,
      procurement_currency: status === "booked" ? "USD" : null,
      created_at: iso(now, -(index + 4) * DAY),
      created_by_name: "Sunita Shrestha",
      created_by_email: "sunita.shrestha@kcpl.com.np",
      updated_at: iso(now, -(index + 1) * HOUR),
    };
  };
  const ocean = orders.filter((order) => order.mode === "sea");
  const road = orders.filter((order) => order.mode === "road");
  const loads = [
    build(0, "sea", "booked", ocean),
    build(1, "road", "ready_for_procurement", road),
  ].filter((load) => load.members.length > 0);
  return { kind: "ready" as const, loads };
}

import type {
  BranchPerformance,
  ConcentrationRisk,
  CurrencyFinancialMetric,
  CustomerPerformance,
  JobPerformance,
  ManagementAnalytics,
  ManagementRange,
  RoutePerformance,
  StaffWorkload,
  TrendPoint,
} from "./management/management-data.ts";

const margin = (revenue: number, cost: number) => (revenue ? Number((((revenue - cost) / revenue) * 100).toFixed(2)) : null);

/* Management analytics is the one screen that aggregates everything, so it is
 * built from the same jobs and invoices the other screens show: revenue per job
 * comes from mockFinanceDashboard, cost from the payables, and every roll-up --
 * by branch, customer, route and currency -- is reduced from those rows rather
 * than stated, so no figure here can contradict the ledger it came from. */
export function mockManagementAnalytics(range: ManagementRange, now = Date.now()): ManagementAnalytics {
  // A management report is an all-branches view by definition.
  const staff = { can_access_all_branches: true, branches: [] } as unknown as KcplStaffContext;
  const jobs = mockCommandCentre(staff, now).jobs;
  const invoices = mockFinanceDashboard(staff, now).invoices;
  const bills = mockPayablesDashboard(staff, now).bills;

  const revenueFor = (reference: string) => invoices.filter((invoice) => invoice.shipment_reference === reference).reduce((sum, invoice) => sum + invoice.total, 0);
  // Payables are in USD and receivables in NPR; the screen reports per currency,
  // so the cost side is converted at one fixed rate rather than mixed silently.
  const NPR_PER_USD = 133;
  const costFor = (reference: string) => bills.filter((bill) => bill.shipment_reference === reference).reduce((sum, bill) => sum + bill.total * NPR_PER_USD, 0);

  const jobRows: JobPerformance[] = jobs.map((job) => {
    const revenue = revenueFor(job.reference);
    const cost = costFor(job.reference);
    return {
      shipment_reference: job.reference,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      branch: job.primary_branch,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      status: job.status,
      currency: "NPR",
      revenue,
      cost,
      profit: revenue - cost,
      margin_percent: margin(revenue, cost),
      period_revenue: revenue,
      period_cost: cost,
      period_profit: revenue - cost,
      period_margin_percent: margin(revenue, cost),
    };
  });

  const roll = <T,>(keyOf: (row: JobPerformance) => string, make: (key: string, rows: JobPerformance[]) => T): T[] => {
    const groups = new Map<string, JobPerformance[]>();
    for (const row of jobRows) {
      const key = keyOf(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].map(([key, rows]) => make(key, rows));
  };
  const sum = (rows: JobPerformance[], field: "revenue" | "cost") => rows.reduce((total, row) => total + row[field], 0);

  const branches: BranchPerformance[] = roll((row) => row.branch, (key, rows) => {
    const revenue = sum(rows, "revenue");
    const cost = sum(rows, "cost");
    return {
      branch: key as BranchPerformance["branch"],
      currency: "NPR" as CrmCurrency,
      revenue,
      cost,
      profit: revenue - cost,
      margin_percent: margin(revenue, cost),
      active_jobs: rows.filter((row) => row.status !== "delivered").length,
      invoice_count: rows.length,
    };
  });

  const customers: CustomerPerformance[] = roll((row) => row.customer_name, (key, rows) => {
    const revenue = sum(rows, "revenue");
    const cost = sum(rows, "cost");
    return {
      customer_id: rows[0].customer_id ?? key,
      customer_name: key,
      currency: "NPR" as CrmCurrency,
      revenue,
      cost,
      profit: revenue - cost,
      margin_percent: margin(revenue, cost),
      invoice_count: rows.length,
      shipment_count: rows.length,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const routes: RoutePerformance[] = roll((row) => `${row.origin}|${row.destination}|${row.mode}`, (key, rows) => {
    const [origin, destination, mode] = key.split("|");
    const revenue = sum(rows, "revenue");
    const cost = sum(rows, "cost");
    return { origin, destination, mode, currency: "NPR" as CrmCurrency, revenue, cost, profit: revenue - cost, margin_percent: margin(revenue, cost), jobs: rows.length };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = sum(jobRows, "revenue");
  const totalCost = sum(jobRows, "cost");
  const financials: CurrencyFinancialMetric[] = [{
    currency: "NPR",
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalRevenue - totalCost,
    margin_percent: margin(totalRevenue, totalCost),
    receivables: invoices.reduce((total, invoice) => total + invoice.balance_due, 0),
    overdue_receivables: invoices.filter((invoice) => invoice.status === "overdue").reduce((total, invoice) => total + invoice.balance_due, 0),
    payables: Math.round(bills.reduce((total, bill) => total + bill.balance_due, 0) * NPR_PER_USD),
    overdue_payables: Math.round(bills.filter((bill) => bill.status === "overdue").reduce((total, bill) => total + bill.balance_due, 0) * NPR_PER_USD),
    invoice_count: invoices.length,
    cost_item_count: bills.length,
  }];

  const trends: TrendPoint[] = [5, 4, 3, 2, 1, 0].map((back) => {
    const share = [0.72, 0.81, 0.88, 0.94, 0.97, 1][5 - back];
    const revenue = Math.round(totalRevenue * share);
    const cost = Math.round(totalCost * share);
    return { month: nepalDay(now, -back * 30).slice(0, 7), currency: "NPR" as CrmCurrency, revenue, cost, profit: revenue - cost };
  });

  const topFive = customers.slice(0, 5).reduce((total, row) => total + row.revenue, 0);
  const concentration: ConcentrationRisk[] = [{
    currency: "NPR",
    total_revenue: totalRevenue,
    top_customer_name: customers[0]?.customer_name ?? null,
    top_customer_share_percent: totalRevenue ? Number(((customers[0]?.revenue ?? 0) / totalRevenue * 100).toFixed(2)) : 0,
    top_five_share_percent: totalRevenue ? Number((topFive / totalRevenue * 100).toFixed(2)) : 0,
  }];

  const staffWorkload: StaffWorkload[] = STAFF_SEEDS.map((person) => {
    const mine = jobs.filter((job) => job.assigned_to_email === person.email && job.status !== "delivered");
    return {
      staff_name: person.name,
      staff_email: person.email,
      active_jobs: mine.length,
      urgent_jobs: mine.filter((job) => job.priority === "urgent").length,
      open_tasks: mine.reduce((total, job) => total + job.open_tasks, 0),
      overdue_tasks: mine.reduce((total, job) => total + job.overdue_tasks, 0),
    };
  }).filter((row) => row.active_jobs > 0);

  const quotes = mockQuoteSummaries(staff, now);
  const won = quotes.filter((quote) => quote.status === "won").length;
  const lost = quotes.filter((quote) => quote.status === "lost").length;
  const decided = won + lost;
  const active = jobs.filter((job) => job.status !== "delivered");

  return {
    generated_at: iso(now, 0),
    range,
    financials,
    branches,
    customers,
    jobs: jobRows,
    loss_making_jobs: jobRows.filter((row) => row.profit < 0),
    routes,
    trends,
    concentration,
    staff_workload: staffWorkload,
    data_quality: {
      excluded_currency_records: 0,
      excluded_currency_values: [],
      unassigned_branch_financial_records: 0,
      active_unassigned_branch_shipments: active.filter((job) => !job.assigned_to_email).length,
      unlinked_invoice_records: 0,
      orphaned_job_cost_records: 0,
    },
    quote_total: quotes.length,
    quote_won: won,
    quote_lost: lost,
    quote_open: quotes.length - decided,
    quote_decided: decided,
    quote_conversion_percent: decided ? Number((won / decided * 100).toFixed(2)) : 0,
    quote_decision_rate_percent: quotes.length ? Number((decided / quotes.length * 100).toFixed(2)) : 0,
    active_shipments: active.length,
    delivered_in_period: jobs.filter((job) => job.status === "delivered").length,
    urgent_shipments: active.filter((job) => job.priority === "urgent").length,
    exception_shipments: active.filter((job) => job.status === "exception").length,
    customs_blocked_shipments: active.filter((job) => job.required_customs_open > 0).length,
    unassigned_shipments: active.filter((job) => !job.assigned_to_email).length,
  };
}

import type { DigitalJobFile, JobCost, JobTask, CustomsStep } from "./job-file.ts";
import type { ShipmentWorkflowReadiness, WorkflowDocumentState, WorkflowStage } from "./workflow-guard.ts";
import type { ShipmentActivityItem, ShipmentActivityTimeline } from "./shipment-activity.ts";
import { summarizeShipmentExceptions, type ShipmentException } from "./shipment-exceptions.ts";
import type { DeliveryAttempt, PodEvidence } from "./delivery/delivery-control.ts";

/* ---------------------------------------------------------------------------
 * Digital Job File
 *
 * The detail page loads six independent server modules. All six derive from the
 * same mockCommandCentre() job, so the header, the workflow rail, the task
 * list, the activity trail and the delivery panel describe one shipment rather
 * than six unrelated ones.
 * ------------------------------------------------------------------------- */

/** The one job every Job File fixture is built from. */
function mockJob(reference: string, staff: KcplStaffContext, now: number) {
  const jobs = mockCommandCentre(staff, now).jobs;
  return jobs.find((job) => job.reference === reference.trim().toUpperCase()) ?? null;
}

const JOB_OWNER = { uid: "staff-ops-1", name: "Prakash Adhikari", email: "prakash@kcpl.local", phone: "+977 1 4000001" };

function mockJobTasks(job: CommandCentreJob, now: number): JobTask[] {
  const seeds: Array<[string, string, number, boolean]> = [
    ["Confirm booking with carrier", "Reconfirm equipment and cut-off against the accepted tender.", -42, true],
    ["Collect commercial invoice & packing list", "Customer to send final signed copies for customs entry.", -18, true],
    ["Lodge customs declaration", "Submit entry once HS classification is agreed with the broker.", 6, false],
    ["Confirm delivery window with consignee", "Warehouse accepts deliveries 09:00-16:00 only.", 30, false],
  ];
  return seeds.map(([title, detail, dueHours, completed], index) => ({
    id: `${job.reference}-task-${index + 1}`,
    title,
    detail,
    branch: job.primary_branch,
    due_at: iso(now, dueHours * HOUR),
    assigned_to_uid: JOB_OWNER.uid,
    assigned_to_name: job.assigned_to_name ?? JOB_OWNER.name,
    assigned_to_email: job.assigned_to_email ?? JOB_OWNER.email,
    assigned_to_phone: JOB_OWNER.phone,
    completed,
    completed_at: completed ? iso(now, (dueHours - 2) * HOUR) : null,
    created_at: iso(now, -72 * HOUR + index * HOUR),
    created_by: JOB_OWNER.name,
  }));
}

function mockCustomsSteps(job: CommandCentreJob, now: number): CustomsStep[] {
  const seeds: Array<[string, string, boolean, boolean]> = [
    ["HS classification agreed", "Tariff lines confirmed with the licensed broker.", true, true],
    ["Duty and VAT assessed", "Assessment notice received from the customs office.", true, true],
    ["Entry lodged", "Declaration submitted against the commercial invoice.", true, job.required_customs_open === 0],
    ["Physical examination", "Only if the lane rule selects the shipment for inspection.", false, false],
  ];
  return seeds.map(([title, detail, required, completed], index) => ({
    id: `${job.reference}-customs-${index + 1}`,
    title,
    detail,
    branch: job.primary_branch,
    required,
    completed,
    completed_at: completed ? iso(now, -(24 - index * 4) * HOUR) : null,
    completed_by: completed ? JOB_OWNER.name : null,
    created_at: iso(now, -60 * HOUR + index * HOUR),
  }));
}

function mockJobCosts(job: CommandCentreJob, now: number): JobCost[] {
  const seeds: Array<[JobCost["category"], string, string, number, JobCost["source_type"]]> = [
    ["freight", "Ocean freight - main leg", "Maersk", 285000, "payable"],
    ["customs", "Customs brokerage & duty handling", "Himalaya Clearing House", 48500, "manual"],
    ["transport", "Inland haulage to consignee", "Annapurna Transport", 62000, "payable"],
    ["handling", "Terminal handling at destination", "Birgunj ICD", 18750, "manual"],
  ];
  return seeds.map(([category, label, vendor, amount, source], index) => ({
    id: `${job.reference}-cost-${index + 1}`,
    category,
    label,
    vendor,
    amount,
    currency: "NPR" as const,
    notes: null,
    source_type: source,
    source_reference: source === "payable" ? `AP-${job.reference.slice(-8)}-${index + 1}` : null,
    locked: source === "payable",
    created_at: iso(now, -(40 - index * 6) * HOUR),
    created_by: JOB_OWNER.name,
  }));
}

export function mockShipmentBranchAccess(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: job.primary_branch,
    handlingBranches: job.handling_branches,
    accessBranches: [...new Set([job.primary_branch, ...job.handling_branches])],
    branchDataComplete: true,
  };
}

export function mockDigitalJobFile(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };

  const tasks = mockJobTasks(job, now);
  const customsSteps = mockCustomsSteps(job, now);
  const canViewCosts = staff.permissions.canManageJobCosts;
  const costs = canViewCosts ? mockJobCosts(job, now) : [];

  // Totals are summed from the rows above rather than restated, so the header
  // figures can never drift from the cost table underneath them.
  const costTotal = costs.reduce((total, cost) => total + cost.amount, 0);
  const revenueTotal = canViewCosts ? Math.round(costTotal * 1.28) : 0;
  const profit = revenueTotal - costTotal;

  const file: DigitalJobFile = {
    reference: job.reference,
    quote_reference: job.quote_reference,
    customer_id: job.customer_id,
    customer_name: job.customer_name,
    status: job.status,
    origin: job.origin,
    destination: job.destination,
    mode: job.mode,
    eta: job.eta,
    current_location: job.current_location,
    carrier: job.carrier,
    carrier_reference: job.carrier ? `${job.carrier.slice(0, 3).toUpperCase()}-${job.reference.slice(-6)}` : null,
    primary_branch: job.primary_branch,
    handling_branches: job.handling_branches,
    assigned_to_uid: job.assigned_to_uid ?? JOB_OWNER.uid,
    assigned_to_name: job.assigned_to_name ?? JOB_OWNER.name,
    assigned_to_email: job.assigned_to_email ?? JOB_OWNER.email,
    assigned_to_phone: job.assigned_to_phone ?? JOB_OWNER.phone,
    assigned_to_job_title: "Operations executive",
    assigned_to_branches: [job.primary_branch],
    priority: job.priority,
    internal_reference: `JF/${job.primary_branch.slice(0, 3).toUpperCase()}/${job.reference.slice(-4)}`,
    internal_notes: "Consignee warehouse accepts deliveries 09:00-16:00 only. Call the site contact one hour before arrival.",
    tasks,
    customs_steps: customsSteps,
    costs,
    cost_totals: canViewCosts ? { NPR: costTotal } : {},
    revenue_totals: canViewCosts ? { NPR: revenueTotal } : {},
    profit_totals: canViewCosts ? { NPR: profit } : {},
    margin_percent: canViewCosts && revenueTotal > 0 ? { NPR: Math.round((profit / revenueTotal) * 10000) / 100 } : {},
    can_view_costs: canViewCosts,
    updated_at: job.updated_at,
  };
  return { kind: "ready" as const, job: file };
}

/** Documents the workflow rail checks for. Two are deliberately still missing
 *  so the rail shows a real blocked state rather than an all-green screen. */
function mockWorkflowDocuments(job: CommandCentreJob): WorkflowDocumentState[] {
  const seeds: Array<[WorkflowDocumentState["document_type"], string, boolean, boolean, WorkflowDocumentState["source"], string]> = [
    ["bill_of_lading", "Bill of Lading", true, true, "mode", "Ocean main leg requires a transport document."],
    ["commercial_invoice", "Commercial Invoice", true, true, "core", "Required for every customs entry."],
    ["packing_list", "Packing List", true, true, "core", "Required for every customs entry."],
    ["certificate_of_origin", "Certificate of Origin", true, job.status === "delivered", "route", "Preferential origin claim on this lane."],
    ["insurance_certificate", "Insurance Certificate", false, false, "cargo", "Advisory for this cargo value."],
  ];
  return seeds.map(([document_type, label, required, present, source, reason]) => ({
    document_type,
    label,
    required,
    advisory: !required,
    present,
    count: present ? 1 : 0,
    uploaded_count: present ? 1 : 0,
    verified_count: present ? 1 : 0,
    reason,
    source,
  }));
}

export function mockShipmentWorkflowReadiness(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };

  const documents = mockWorkflowDocuments(job);
  const customsSteps = mockCustomsSteps(job, now);
  const tasks = mockJobTasks(job, now);

  // Every count below is derived from the rows the page also renders, so the
  // rail and the lists underneath it cannot disagree.
  const requiredCustoms = customsSteps.filter((step) => step.required);
  const completedCustoms = requiredCustoms.filter((step) => step.completed).length;
  const customsChecklistReady = completedCustoms === requiredCustoms.length;
  const customsReleased = job.status === "delivered" || job.status === "out_for_delivery";
  const customsReady = customsChecklistReady && customsReleased;
  const openTasks = tasks.filter((task) => !task.completed).length;
  const documentPackReady = documents.filter((doc) => doc.required).every((doc) => doc.present);
  const delivered = job.status === "delivered";
  const proofOfDeliveryPresent = delivered;

  const stage = (id: WorkflowStage["id"], label: string, state: WorkflowStage["state"], detail: string): WorkflowStage =>
    ({ id, label, state, detail });
  const inTransitOrLater = ["in_transit", "customs_clearance", "out_for_delivery", "delivered"].includes(job.status);

  const closeBlockers: string[] = [];
  if (!customsChecklistReady) closeBlockers.push("All required customs checklist steps must be complete.");
  if (!documentPackReady) closeBlockers.push("All required operational documents must be verified and unexpired.");
  if (!proofOfDeliveryPresent) closeBlockers.push("A verified Proof of Delivery (POD) must be present.");
  if (openTasks > 0) closeBlockers.push(`${openTasks} operational task${openTasks === 1 ? " remains" : "s remain"} open.`);

  const readiness: ShipmentWorkflowReadiness = {
    reference: job.reference,
    status: job.status,
    customer_id: job.customer_id,
    customer_linked: Boolean(job.customer_id),
    assigned_owner: Boolean(job.assigned_to_name),
    customs_required: requiredCustoms.length,
    customs_completed: completedCustoms,
    customs_checklist_ready: customsChecklistReady,
    customs_release_required: true,
    customs_clearance_status: customsReleased ? "released" : customsChecklistReady ? "lodged" : "not_started",
    customs_released: customsReleased,
    customs_ready: customsReady,
    open_tasks: openTasks,
    documents,
    document_intelligence: {
      direction: "import",
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      cargo_type: "General cargo",
      rules_applied: ["Core commercial pack", `${job.mode} transport document`, "Preferential origin lane"],
      advisories: documentPackReady ? [] : ["Certificate of Origin is still outstanding for the preferential claim."],
    },
    document_pack_ready: documentPackReady,
    proof_of_delivery_present: proofOfDeliveryPresent,
    invoice_count: 1,
    issued_invoice_count: 1,
    paid_invoice_count: delivered ? 1 : 0,
    billing_ready: delivered,
    job_closed: false,
    job_closed_at: null,
    job_closed_by_name: null,
    blockers: customsReady ? [] : ["Customs release is not yet recorded for this shipment."],
    warnings: openTasks ? [`${openTasks} operational task${openTasks === 1 ? "" : "s"} still open.`] : [],
    close_blockers: closeBlockers,
    can_close: closeBlockers.length === 0,
    stages: [
      stage("won", "Won", "complete", "Shipment and Job File created from an accepted quote."),
      stage("setup", "Setup", "complete", `CRM customer ${job.customer_id ?? "linked"} confirmed.`),
      stage("customs", "Customs", customsReady ? "complete" : "current", customsReady ? "Customs checklist complete and explicit release recorded." : `${completedCustoms}/${requiredCustoms.length} required customs steps complete.`),
      stage("documents", "Docs", documentPackReady ? "complete" : "blocked", documentPackReady ? "Verified required document pack is present." : "Required files are missing, unverified or expired."),
      stage("transit", "Transit", inTransitOrLater ? "complete" : "pending", inTransitOrLater ? "Movement has reached transit/clearance stage." : "Movement milestone not reached yet."),
      stage("delivery", "Delivery", delivered ? "complete" : job.status === "out_for_delivery" ? "current" : "pending", delivered ? "Cargo marked delivered." : job.status === "out_for_delivery" ? "Final-mile delivery is active." : "Delivery not yet reached."),
      stage("pod", "POD", proofOfDeliveryPresent ? "complete" : "pending", proofOfDeliveryPresent ? "Verified Proof of Delivery captured." : "Verified POD required for operational closeout."),
      stage("close", "Close", closeBlockers.length ? "blocked" : "current", closeBlockers.length ? `${closeBlockers.length} closeout blocker${closeBlockers.length === 1 ? "" : "s"}.` : "Ready for operational closeout."),
    ],
  };
  return { kind: "ready" as const, readiness };
}

export function mockShipmentActivityTimeline(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };

  const owner = job.assigned_to_name ?? JOB_OWNER.name;
  const email = job.assigned_to_email ?? JOB_OWNER.email;
  const entry = (
    hours: number,
    category: ShipmentActivityItem["category"],
    title: string,
    detail: string | null,
    tone: ShipmentActivityItem["tone"],
    source: string,
  ): ShipmentActivityItem => ({
    id: `${job.reference}-activity-${Math.abs(hours)}-${category}`,
    category,
    title,
    detail,
    occurred_at: iso(now, hours * HOUR),
    actor_name: owner,
    actor_email: email,
    branch: job.primary_branch,
    source,
    tone,
  });

  const items: ShipmentActivityItem[] = [
    entry(-96, "workflow", "Job File opened", "Created from the accepted quote.", "neutral", "Workflow"),
    entry(-94, "ownership", `Assigned to ${owner}`, "Operations ownership set for the primary branch.", "info", "Ownership"),
    entry(-72, "document", "Commercial Invoice uploaded", "Verified against the booking.", "success", "Documents"),
    entry(-70, "document", "Packing List uploaded", "Verified against the booking.", "success", "Documents"),
    entry(-48, "customs", "HS classification agreed", "Tariff lines confirmed with the licensed broker.", "success", "Customs"),
    entry(-36, "customs", "Duty and VAT assessed", "Assessment notice received from the customs office.", "success", "Customs"),
    entry(-24, "shipment", `Movement update - ${job.current_location ?? job.origin}`, "Carrier milestone received.", "info", "Tracking"),
    entry(-12, "task", "Task completed: Collect commercial invoice & packing list", null, "success", "Tasks"),
    entry(-6, "alert", "Certificate of Origin still outstanding", "Required for the preferential origin claim on this lane.", "warning", "Automation alert"),
    entry(-2, "finance", "Invoice issued", "Customer invoice raised against this job.", "info", "Finance"),
  ];

  const timeline: ShipmentActivityTimeline = {
    reference: job.reference,
    generated_at: iso(now, 0),
    items: items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
  };
  return { kind: "ready" as const, timeline };
}

export function mockShipmentExceptions(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };

  const owner = job.assigned_to_name ?? JOB_OWNER.name;
  const email = job.assigned_to_email ?? JOB_OWNER.email;
  const base = {
    reference: job.reference,
    branch: job.primary_branch,
    assigned_to_name: owner,
    assigned_to_email: email,
    opened_by_name: owner,
    opened_by_email: email,
    updated_by_name: owner,
    updated_by_email: email,
  };

  // An exception file that carries one open case, one being watched and one
  // closed shows every state the control can render.
  const exceptions: ShipmentException[] = [
    {
      ...base,
      id: `${job.reference}-exception-1`,
      category: "customs",
      severity: "high",
      status: "open",
      title: "Certificate of Origin not received from shipper",
      detail: "The preferential origin claim cannot be lodged without the signed certificate.",
      operational_impact: "Customs entry is held; demurrage starts if this is not cleared within 48 hours.",
      sla_due_at: iso(now, 18 * HOUR),
      opened_at: iso(now, -20 * HOUR),
      updated_at: iso(now, -4 * HOUR),
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      resolution: null,
    },
    {
      ...base,
      id: `${job.reference}-exception-2`,
      category: "delay",
      severity: "medium",
      status: "monitoring",
      title: "Vessel arrival slipped by 36 hours",
      detail: "Carrier advised a revised ETA after a port congestion delay at transshipment.",
      operational_impact: "Delivery appointment with the consignee may need to move.",
      sla_due_at: iso(now, 40 * HOUR),
      opened_at: iso(now, -48 * HOUR),
      updated_at: iso(now, -10 * HOUR),
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      resolution: null,
    },
    {
      ...base,
      id: `${job.reference}-exception-3`,
      category: "document",
      severity: "low",
      status: "resolved",
      title: "Packing list showed the wrong carton count",
      detail: "Shipper reissued the packing list with the corrected count.",
      operational_impact: "No customs impact; corrected before the entry was lodged.",
      sla_due_at: iso(now, -60 * HOUR),
      opened_at: iso(now, -80 * HOUR),
      updated_at: iso(now, -64 * HOUR),
      resolved_at: iso(now, -64 * HOUR),
      resolved_by_name: owner,
      resolved_by_email: email,
      resolution: "Corrected packing list received and verified against the commercial invoice.",
    },
  ];

  const nowIso = iso(now, 0);
  return {
    kind: "ready" as const,
    exceptions,
    // Derived by the production summariser so the counts match the rows.
    summary: summarizeShipmentExceptions(exceptions, nowIso),
    generated_at: nowIso,
  };
}

export function mockDeliveryControl(reference: string, staff: KcplStaffContext, now = Date.now()) {
  const job = mockJob(reference, staff, now);
  if (!job) return { kind: "missing" as const };

  const delivered = job.status === "delivered";
  const active = job.status === "out_for_delivery";
  const owner = job.assigned_to_name ?? JOB_OWNER.name;
  const email = job.assigned_to_email ?? JOB_OWNER.email;

  const attempts: DeliveryAttempt[] = [];
  if (delivered || active) {
    attempts.push({
      id: `${job.reference}-attempt-1`,
      shipment_reference: job.reference,
      attempt_number: 1,
      status: delivered ? "delivered" : "out_for_delivery",
      scheduled_for: iso(now, delivered ? -8 * HOUR : 3 * HOUR),
      event_time: delivered ? iso(now, -6 * HOUR) : null,
      location: job.destination,
      latitude: null,
      longitude: null,
      recipient_name: delivered ? "Warehouse supervisor" : null,
      recipient_phone: delivered ? "+977 1 4000123" : null,
      recipient_relation: delivered ? "Consignee warehouse" : null,
      driver_name: "Ram Bahadur",
      driver_phone: "+977 9800000001",
      vehicle_reference: "BA-2000 KHA",
      failure_reason: null,
      notes: delivered ? "Cargo handed over against signed POD." : "Driver dispatched from the destination depot.",
      created_at: iso(now, -12 * HOUR),
      created_by_name: owner,
      created_by_email: email,
      updated_at: iso(now, delivered ? -6 * HOUR : -1 * HOUR),
      updated_by_name: owner,
      updated_by_email: email,
    });
  }

  const evidence: PodEvidence[] = delivered
    ? [
        {
          id: `${job.reference}-pod-1`,
          shipment_reference: job.reference,
          attempt_id: `${job.reference}-attempt-1`,
          kind: "signature",
          filename: `${job.reference}-pod-signature.png`,
          content_type: "image/png",
          size_bytes: 184_320,
          sha256: "b3f1c2d4e5a6978811223344556677889900aabbccddeeff0011223344556677",
          review_status: "verified",
          customer_safe: true,
          captured_at: iso(now, -6 * HOUR),
          uploaded_at: iso(now, -5 * HOUR),
          uploaded_by_name: owner,
          uploaded_by_email: email,
          reviewed_at: iso(now, -4 * HOUR),
          reviewed_by_name: owner,
          reviewed_by_email: email,
          review_note: "Signature matches the nominated consignee contact.",
        },
        {
          id: `${job.reference}-pod-2`,
          shipment_reference: job.reference,
          attempt_id: `${job.reference}-attempt-1`,
          kind: "photo",
          filename: `${job.reference}-pod-cargo.jpg`,
          content_type: "image/jpeg",
          size_bytes: 962_144,
          sha256: "0099aabbccddeeff112233445566778899aabbccddeeff00112233445566778",
          review_status: "verified",
          customer_safe: false,
          captured_at: iso(now, -6 * HOUR),
          uploaded_at: iso(now, -5 * HOUR),
          uploaded_by_name: owner,
          uploaded_by_email: email,
          reviewed_at: iso(now, -4 * HOUR),
          reviewed_by_name: owner,
          reviewed_by_email: email,
          review_note: null,
        },
      ]
    : [];

  return {
    kind: "ready" as const,
    reference: job.reference,
    attempts,
    evidence,
    shipment_status: job.status,
    current_location: job.current_location,
    tracking_last_event_at: iso(now, -3 * HOUR),
    pod_status: (delivered ? "verified" : "not_received") as "not_received" | "received" | "rejected" | "verified",
    pod_document_id: delivered ? `${job.reference}-pod-1` : null,
    pod_verified_at: delivered ? iso(now, -4 * HOUR) : null,
    pod_verified_by: delivered ? owner : null,
    external_observed_milestone: active ? "out_for_delivery" : delivered ? "delivered" : null,
    external_observed_at: active || delivered ? iso(now, -3 * HOUR) : null,
    external_observed_provider: active || delivered ? "Carrier API" : null,
    delivery_completion_id: delivered ? `${job.reference}-completion-1` : null,
    delivery_completed_at: delivered ? iso(now, -6 * HOUR) : null,
    delivery_completion_source: delivered ? "pod_verified" : null,
  };
}

import type {
  CrmActivity, CrmAddress, CrmContact, CrmCustomerDetail, CrmNote, CrmTask,
} from "./crm/crm-data.ts";
import type { CrmQuoteLinkItem } from "./crm/crm-quote-links.server.ts";
import type { CrmOperationsHistory } from "./crm/crm-operations-history.server.ts";
import type { CrmRateCard } from "./crm/crm-rate-cards.ts";
import type { CrmCustomerDocument } from "./crm/crm-customer-document-types.ts";
import type { CrmCustomerFinanceSnapshot } from "./crm/crm-customer-finance.ts";

/* ---------------------------------------------------------------------------
 * Customer 360
 *
 * Built on top of mockCrmCustomers() and the same command-centre jobs, so the
 * account header, the quote and shipment history, the rate cards and the
 * finance snapshot all describe one customer's real book of work rather than
 * unrelated demo rows.
 * ------------------------------------------------------------------------- */

/* Loaders like getCrmCustomer() take no staff context -- in production they do
 * not branch-check either, because checkCrmCustomerAccess() already did. These
 * fixtures match that split: the access check is staff-scoped, the record
 * loaders are not. */
const ALL_BRANCH_CONTEXT = { can_access_all_branches: true, branches: [] } as unknown as KcplStaffContext;

function mockCrmAccount(id: string, staff: KcplStaffContext, now: number) {
  const wanted = id.trim().toLowerCase();
  return mockCrmCustomers(staff, now).find((account) => account.id.toLowerCase() === wanted) ?? null;
}

/** The jobs this customer owns, which drive its history and finance rows. */
function mockCustomerJobs(name: string, staff: KcplStaffContext, now: number) {
  return mockCommandCentre(staff, now).jobs.filter((job) => job.customer_name === name);
}

export function mockCrmCustomerReadAccess(id: string, staff: KcplStaffContext, now = Date.now()) {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return { kind: "missing" as const };
  return { kind: "ready" as const, branch: account.primary_branch, id: account.id };
}

export function mockCrmCustomerDetail(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()): CrmCustomerDetail | null {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return null;

  const manager = account.account_manager_name ?? "Prakash Adhikari";
  const managerEmail = account.account_manager_email ?? "prakash@kcpl.local";

  const contacts: CrmContact[] = [
    {
      id: `${account.id}-contact-1`,
      customer_id: account.id,
      name: "Sunita Shrestha",
      job_title: "Logistics manager",
      email: account.primary_email,
      phone: account.primary_phone,
      communication_preference: "email",
      is_primary: true,
      notes: "Books all inbound ocean freight and signs off delivery windows.",
      created_at: iso(now, -120 * DAY),
      updated_at: iso(now, -8 * DAY),
    },
    {
      id: `${account.id}-contact-2`,
      customer_id: account.id,
      name: "Bikash Thapa",
      job_title: "Accounts payable",
      email: `accounts@${account.display_name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
      phone: "+977 1 4000002",
      communication_preference: "email",
      is_primary: false,
      notes: null,
      created_at: iso(now, -118 * DAY),
      updated_at: iso(now, -30 * DAY),
    },
  ];

  const addresses: CrmAddress[] = [
    {
      id: `${account.id}-address-1`,
      label: "Registered office",
      line1: "Tripureshwor Marg 44",
      line2: null,
      city: "Kathmandu",
      state_region: "Bagmati",
      postal_code: "44600",
      country: "Nepal",
      is_primary: true,
      created_at: iso(now, -120 * DAY),
      updated_at: iso(now, -120 * DAY),
    },
    {
      id: `${account.id}-address-2`,
      label: "Delivery warehouse",
      line1: "Balaju Industrial District, Gate 3",
      line2: "Receiving bay 2",
      city: "Kathmandu",
      state_region: "Bagmati",
      postal_code: "44600",
      country: "Nepal",
      is_primary: false,
      created_at: iso(now, -90 * DAY),
      updated_at: iso(now, -14 * DAY),
    },
  ];

  const notes: CrmNote[] = [
    {
      id: `${account.id}-note-1`,
      note: "Deliveries are accepted 09:00-16:00 only; the site contact must be called an hour ahead.",
      author_name: manager,
      author_email: managerEmail,
      created_at: iso(now, -21 * DAY),
    },
    {
      id: `${account.id}-note-2`,
      note: "Prefers consolidated monthly invoicing rather than one invoice per shipment.",
      author_name: manager,
      author_email: managerEmail,
      created_at: iso(now, -46 * DAY),
    },
  ];

  const activity: CrmActivity[] = [
    { id: `${account.id}-activity-1`, type: "quote_sent", title: "Quote issued", detail: "Ocean import quote sent for the Shanghai lane.", actor_name: manager, actor_email: managerEmail, created_at: iso(now, -9 * DAY) },
    { id: `${account.id}-activity-2`, type: "call", title: "Call with logistics manager", detail: "Agreed the revised delivery window after the vessel delay.", actor_name: manager, actor_email: managerEmail, created_at: iso(now, -4 * DAY) },
    { id: `${account.id}-activity-3`, type: "invoice_issued", title: "Invoice issued", detail: "Monthly consolidated invoice raised.", actor_name: manager, actor_email: managerEmail, created_at: iso(now, -2 * DAY) },
  ];

  const tasks: CrmTask[] = [
    {
      id: `${account.id}-task-1`,
      title: "Renew annual rate agreement",
      detail: "Current sea-freight rate card expires at the end of the quarter.",
      due_at: iso(now, 9 * DAY),
      priority: "high",
      assigned_to_uid: account.account_manager_uid,
      assigned_to_name: manager,
      assigned_to_email: managerEmail,
      assigned_to_phone: account.account_manager_phone,
      completed: false,
      completed_at: null,
      completed_by_name: null,
      created_by_name: manager,
      created_by_email: managerEmail,
      created_at: iso(now, -12 * DAY),
      updated_at: iso(now, -3 * DAY),
    },
    {
      id: `${account.id}-task-2`,
      title: "Collect updated PAN/VAT certificate",
      detail: "Compliance file needs the current year's certificate.",
      due_at: iso(now, -2 * DAY),
      priority: "normal",
      assigned_to_uid: account.account_manager_uid,
      assigned_to_name: manager,
      assigned_to_email: managerEmail,
      assigned_to_phone: account.account_manager_phone,
      completed: false,
      completed_at: null,
      completed_by_name: null,
      created_by_name: manager,
      created_by_email: managerEmail,
      created_at: iso(now, -25 * DAY),
      updated_at: iso(now, -25 * DAY),
    },
  ];

  return {
    ...account,
    trading_name: account.display_name,
    website: `https://www.${account.display_name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
    industry: "Textiles & apparel",
    tax_id: "601234567",
    billing_email: contacts[1].email,
    transport_preferences: ["Ocean FCL", "Road inland haulage"],
    internal_summary: "Long-standing import account. Sensitive to delivery-window changes; finance prefers consolidated monthly billing.",
    commercial: {
      preferred_currency: account.preferred_currency,
      payment_terms_days: 30,
      credit_limit: 5_000_000,
      outstanding_balance: Math.round(account.revenue_total * 0.18),
      pricing_notes: "Agreed annual sea-freight tariff; air freight quoted per shipment.",
      markup_percent: 18,
      preferred_carriers: ["Maersk", "CMA CGM"],
    },
    contacts,
    addresses,
    notes,
    activity,
    tasks,
  };
}

export function mockCrmQuoteLinks(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()) {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return null;
  const jobs = mockCustomerJobs(account.display_name, staff, now);

  const link = (job: CommandCentreJob, index: number, matched: boolean): CrmQuoteLinkItem => ({
    reference: job.quote_reference,
    created_at: iso(now, -(20 + index * 3) * DAY),
    status: matched ? "won" : "new",
    origin: job.origin,
    destination: job.destination,
    contact_name: "Sunita Shrestha",
    contact_email: account.primary_email ?? `enquiries@${account.display_name.toLowerCase().replace(/[^a-z]+/g, "")}.com.np`,
    company_name: account.display_name,
    phone: account.primary_phone,
    customer_id: matched ? account.id : null,
    match_reason: matched ? null : "Same company name and contact email as this account.",
  });

  return {
    linked: jobs.map((job, index) => link(job, index, true)),
    // One unlinked enquiry so the "suggested match" path has something to show.
    suggested: jobs.slice(0, 1).map((job, index) => ({
      ...link(job, index, false),
      reference: `${job.quote_reference}-B`,
    })),
  };
}

export function mockCrmOperationsHistory(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()): CrmOperationsHistory | null {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return null;
  const jobs = mockCustomerJobs(account.display_name, staff, now);

  return {
    quotes: jobs.map((job, index) => ({
      reference: job.quote_reference,
      created_at: iso(now, -(20 + index * 3) * DAY),
      updated_at: iso(now, -(18 + index * 3) * DAY),
      status: "won" as const,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
      currency: "USD" as const,
      quoted_amount: String(4200 + index * 360),
      shipment_reference: job.reference,
    })),
    shipments: jobs.map((job) => ({
      reference: job.reference,
      quote_reference: job.quote_reference,
      created_at: iso(now, -16 * DAY),
      updated_at: job.updated_at,
      status: job.status,
      eta: job.eta,
      current_location: job.current_location,
      carrier: job.carrier,
      carrier_reference: job.carrier ? `${job.carrier.slice(0, 3).toUpperCase()}-${job.reference.slice(-6)}` : null,
      origin: job.origin,
      destination: job.destination,
      mode: job.mode,
    })),
  };
}

export function mockCrmRateCards(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()) {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return { kind: "missing" as const };
  const manager = account.account_manager_name ?? "Prakash Adhikari";
  const managerEmail = account.account_manager_email ?? "prakash@kcpl.local";

  const seeds: Array<[string, string, CrmRateCard["mode"], string, number, CrmRateCard["unit"], boolean]> = [
    ["Shanghai", "Kathmandu", "sea", "Maersk", 2850, "per_container", true],
    ["Kolkata", "Birgunj", "road", "Annapurna Transport", 420, "per_container", true],
    ["Dubai", "Kathmandu", "air", "Qatar Airways Cargo", 3.8, "per_kg", true],
    ["Shanghai", "Kathmandu", "sea", "CMA CGM", 3100, "per_container", false],
  ];

  return {
    kind: "ready" as const,
    rateCards: seeds.map(([origin, destination, mode, carrier, sell, unit, active], index): CrmRateCard => ({
      id: `${account.id}-rate-${index + 1}`,
      customer_id: account.id,
      origin,
      destination,
      mode,
      carrier,
      service: mode === "air" ? "Express" : "Standard",
      currency: "USD",
      cost_rate: Math.round(sell * 0.82 * 100) / 100,
      sell_rate: sell,
      unit,
      minimum_charge: mode === "air" ? 240 : null,
      valid_from: iso(now, -150 * DAY),
      valid_until: iso(now, active ? 60 * DAY : -10 * DAY),
      notes: active ? null : "Superseded by the current Maersk tariff.",
      active,
      created_by_name: manager,
      created_by_email: managerEmail,
      created_at: iso(now, -150 * DAY),
      updated_at: iso(now, -(12 + index) * DAY),
    })),
  };
}

export function mockCrmCustomerDocuments(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()) {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return { kind: "missing" as const };
  const slug = account.display_name.toLowerCase().replace(/[^a-z]+/g, "-");

  const seeds: Array<[CrmCustomerDocument["document_type"], string, string, number, number]> = [
    ["pan_vat", `${slug}-pan-vat.pdf`, "application/pdf", 184_320, -210],
    ["contract", `${slug}-freight-agreement.pdf`, "application/pdf", 612_400, -180],
    ["credit_agreement", `${slug}-credit-terms.pdf`, "application/pdf", 240_118, -150],
    ["rate_sheet", `${slug}-rate-sheet.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 48_900, -30],
  ];

  return {
    kind: "ready" as const,
    documents: seeds.map(([document_type, filename, content_type, size_bytes, days], index): CrmCustomerDocument => ({
      id: index + 1,
      customer_id: account.id,
      filename,
      content_type,
      size_bytes,
      document_type,
      uploaded_at: iso(now, days * DAY),
      uploaded_by: account.account_manager_name ?? "Prakash Adhikari",
    })),
    storageAvailable: false,
  };
}

export function mockCrmCustomerFinanceSnapshot(id: string, staff: KcplStaffContext = ALL_BRANCH_CONTEXT, now = Date.now()): CrmCustomerFinanceSnapshot | null {
  const account = mockCrmAccount(id, staff, now);
  if (!account) return null;

  // Derived from the account's own totals so the 360 header, the finance panel
  // and the CRM list cannot state three different revenue figures.
  const revenue = account.revenue_total;
  const cost = account.cost_total;
  const profit = account.profit_total;
  const collected = Math.round(revenue * 0.72);
  const outstanding = revenue - collected;
  const overdue = Math.round(outstanding * 0.34);

  return {
    currency: account.preferred_currency,
    revenue_total: revenue,
    cost_total: cost,
    profit_total: profit,
    gross_margin_percent: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
    collected_total: collected,
    outstanding_total: outstanding,
    overdue_total: overdue,
    invoice_count: account.quote_count + 2,
    open_invoice_count: 3,
    overdue_invoice_count: overdue > 0 ? 1 : 0,
    draft_invoice_count: 1,
    oldest_overdue_days: overdue > 0 ? 18 : null,
    other_currency_invoice_count: 0,
    other_currency_cost_count: 0,
    integrity_warning_count: 0,
    generated_at: iso(now, 0),
  };
}
