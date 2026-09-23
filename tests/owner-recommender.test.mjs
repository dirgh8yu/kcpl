import assert from "node:assert/strict";
import test from "node:test";

import { suggestOwner, laneKey } from "../app/admin/command-centre/owner-recommender.ts";

function staff(overrides = {}) {
  return {
    key: "s1",
    uid: "u1",
    name: "Sunita Shrestha",
    email: "sunita@kcpl.test",
    phone: null,
    active_jobs: 5,
    urgent_jobs: 0,
    open_tasks: 4,
    overdue_tasks: 0,
    ...overrides,
  };
}

const JOB = { primary_branch: "Birgunj", handling_branches: ["Birgunj"], origin: "Guangzhou", destination: "Birgunj", mode: "ocean" };
const LANE = "guangzhou→birgunj";

test("lane keys normalise case on both ends", () => {
  assert.equal(laneKey("Guangzhou", "BIRGUNJ"), LANE);
});

test("a lighter workload wins when lane experience is equal", () => {
  const busy = staff({ name: "Busy", email: "busy@kcpl.test", uid: "u2", open_tasks: 10, urgent_jobs: 2, active_jobs: 8 });
  const calm = staff({ name: "Calm", email: "calm@kcpl.test", uid: "u3", open_tasks: 1, urgent_jobs: 0, active_jobs: 2 });
  const result = suggestOwner({ job: JOB, candidates: [busy, calm], laneEvidence: new Map() });
  assert.equal(result.available, true);
  assert.equal(result.recommendations[0].name, "Calm");
  assert.match(result.recommendations[0].reason, /2 active · 1 open task$/);
});

test("lane experience beats a modest workload edge", () => {
  const experienced = staff({ name: "Lane", email: "lane@kcpl.test", uid: "u4", open_tasks: 4, active_jobs: 5 });
  const fresh = staff({ name: "Fresh", email: "fresh@kcpl.test", uid: "u5", open_tasks: 1, active_jobs: 2 });
  const evidence = new Map([
    ["u4", { lane_completions: 3, last_lane_completion_at: "2026-09-01T00:00:00.000Z" }],
  ]);
  const result = suggestOwner({ job: JOB, candidates: [fresh, experienced], laneEvidence: evidence });
  // Fresh: 1 + 0 + 1 = 2; Lane: 4 + 0 + 2.5 - 6 = 0.5 → Lane leads.
  assert.equal(result.recommendations[0].name, "Lane");
  assert.equal(result.recommendations[0].lane_completions, 3);
  assert.match(result.recommendations[0].reason, /3 completed on this lane/);
});

test("evidence is matched by email when the register carries no uid", () => {
  const noUid = staff({ uid: null, email: "lane@kcpl.test" });
  const evidence = new Map([
    ["lane@kcpl.test", { lane_completions: 2, last_lane_completion_at: null }],
  ]);
  const result = suggestOwner({ job: JOB, candidates: [noUid], laneEvidence: evidence });
  assert.equal(result.recommendations[0].lane_completions, 2);
});

test("at most three candidates are returned, ordered", () => {
  const candidates = ["a", "b", "c", "d", "e"].map((tag, index) => staff({
    name: `Staff ${tag}`,
    email: `${tag}@kcpl.test`,
    uid: `u-${tag}`,
    open_tasks: index,
  }));
  const result = suggestOwner({ job: JOB, candidates, laneEvidence: new Map() });
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.recommendations[0].name, "Staff a");
});

test("an empty directory says so instead of inventing a name", () => {
  const result = suggestOwner({ job: JOB, candidates: [], laneEvidence: new Map() });
  assert.equal(result.available, false);
  assert.ok(result.reason);
  assert.deepEqual(result.recommendations, []);
});
