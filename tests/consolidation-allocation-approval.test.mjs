import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  allocateConsolidationProcurement,
  consolidationAllocationApprovalStatus,
  consolidationCurrencyDecimals,
} from "../app/admin/consolidation/tms-consolidation-allocation.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const preparation = readFileSync(`${root}/app/admin/consolidation/tms-consolidation-allocation.server.ts`, "utf8");
const booking = readFileSync(`${root}/app/admin/consolidation/tms-consolidation-allocation-booking.server.ts`, "utf8");
const consolidationRoute = readFileSync(`${root}/app/api/admin/consolidation/route.ts`, "utf8");
const tenderRoute = readFileSync(`${root}/app/api/admin/tenders/route.ts`, "utf8");
const dispatcher = readFileSync(`${root}/app/admin/tenders/tms-booking-lineage-dispatch.server.ts`, "utf8");
const desk = readFileSync(`${root}/app/admin/consolidation/tms-consolidation-allocation-desk.tsx`, "utf8");
const customerAuthority = readFileSync(`${root}/app/admin/commercial-authority/customer-sell-authority.server.ts`, "utf8");
const packageJson = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));

function member(id, weight = 0, volume = 0, pieces = 0) {
  return { order_id: id, weight_kg: weight, volume_cbm: volume, pieces };
}
function allocate(total, currency, members) {
  const result = allocateConsolidationProcurement(total, currency, members);
  assert.equal(result.ok, true);
  return result;
}
function sum(values) { return values.reduce((total, value) => total + value, 0); }

// Preparation / released-manifest authority.
test("01 released load preparation is a dedicated transaction", () => {
  assert.match(preparation, /prepareConsolidationCommercialAllocation[\s\S]*?runTransaction/);
  assert.match(preparation, /\["ready_for_procurement", "tendering"\]/);
});
test("02 unreleased draft load cannot prepare", () => assert.match(preparation, /includes\(text\(load\.get\("status"\)\)\)[\s\S]*?invalid_transition/));
test("03 cancelled load cannot prepare", () => assert.doesNotMatch(preparation, /\["ready_for_procurement", "tendering", "cancelled"\]/));
test("04 duplicate prepare resolves the same deterministic package", () => {
  assert.match(preparation, /packageId\(packageFingerprint\)/);
  assert.match(preparation, /idempotent: targetPackageSnapshot\.exists/);
});
test("05 concurrent prepare uses deterministic package and transaction create semantics", () => {
  assert.match(preparation, /createHash\("sha256"\)/);
  assert.match(preparation, /transaction\.create\(targetPackageRef/);
});
test("06 released manifest identity is fingerprinted", () => assert.match(preparation, /released_manifest_fingerprint: hash\(manifest\)/));
test("07 missing house blocks preparation", () => assert.match(preparation, /houseOrders\.some\(\(order\) => !order\.exists\).*missing_order/));
test("08 extra or omitted house cannot differ from released source set", () => assert.match(preparation, /sameIdSet\(members\.map[\s\S]*?sources\.map/));
test("09 source commercial version id is checked against release authority", () => assert.match(preparation, /consolidation_source_commercial_version_id[\s\S]*?source\.versionId/));
test("10 source commercial fingerprint is checked against release authority", () => assert.match(preparation, /consolidation_source_commercial_fingerprint[\s\S]*?source\.fingerprint/));
test("11 master procurement must equal exact tender/master commercial economics", () => assert.match(preparation, /sameCommercialMoney\(masterVersion\.snapshot\.procurement\.total, commercials\.amount/));
test("12 branch is loaded from canonical load authority", () => assert.match(preparation, /const branch = branchValue\(load\.get\("branch"\)\)/));
test("13 malformed branch fails closed", () => assert.match(preparation, /if \(!branch \|\| !staffCanAccessBranch\(staff, branch\)\) return \{ kind: "forbidden"/));
test("14 caller cannot submit source economics or per-house allocation", () => {
  const block = consolidationRoute.slice(consolidationRoute.indexOf('action === "prepare_allocation"'), consolidationRoute.indexOf('action === "approve_allocation"'));
  assert.match(block, /prepareConsolidationCommercialAllocation\(clean\(body\.loadId/);
  assert.doesNotMatch(block, /body\.(amount|currency|members|allocations|sourceVersion|branch)/);
});

// Derived version durability and lineage.
test("15 preparation persists immutable derived commercial versions", () => assert.match(preparation, /persistCommercialVersionInTransaction\(transaction, derivedVersions\[index\]\)/));
test("16 source commercial version is never overwritten by preparation", () => assert.doesNotMatch(preparation, /transaction\.update\([^\n]*commercial_versions/));
test("17 each derived version points to exact source version", () => assert.match(preparation, /previous_version_id: input\.source\.id/));
test("18 allocation package identity is embedded in derived provenance", () => assert.match(preparation, /consolidation_allocation_package_fingerprint: input\.packageFingerprint/));
test("19 retry verifies existing deterministic derived version instead of creating a duplicate", () => assert.match(preparation, /existingDerivedMatches\(existingDerived\[index\], derivedVersions\[index\]\)/));
test("20 changed package fingerprint changes deterministic derived version id", () => assert.match(preparation, /hash\(\[fingerprint, normalizeCommercialId\(orderId\), normalizeCommercialId\(sourceVersionId\)\]\)/));
test("21 old package can be retained and marked stale rather than deleted", () => {
  assert.match(preparation, /oldPackage\?\.exists/);
  assert.doesNotMatch(preparation, /transaction\.delete\(/);
});
test("22 current FX is not fetched during allocation preparation", () => assert.doesNotMatch(preparation, /(getNrbForexSnapshot|fetch\(|forex)/));
test("23 current rate card collection is not read to reconstruct house procurement", () => assert.doesNotMatch(preparation, /collection\("partner_rate_cards"\)/));

// Approval authority.
test("24 no required derived approval makes package ready", () => assert.deepEqual(consolidationAllocationApprovalStatus([{ approval_required: false, approved: false }]), { status: "ready", required: 0, approved: 0, pending: 0 }));
test("25 one required derived approval makes package pending", () => assert.deepEqual(consolidationAllocationApprovalStatus([{ approval_required: true, approved: false }]), { status: "pending_approval", required: 1, approved: 0, pending: 1 }));
test("26 approval-required derived version is persisted before workflow waits", () => {
  assert.match(preparation, /persistCommercialVersionInTransaction/);
  assert.match(preparation, /kind: approvalState\.status === "ready" \? "ready" as const : "approval_required" as const/);
});
test("27 Management approval targets existing commercial_approvals authority", () => assert.match(preparation, /createCommercialApprovalInTransaction\(transaction, targetVersion/));
test("28 commercial role cannot perform staged Management approval", () => assert.match(preparation, /staff\.permissions\.role !== "management"/));
test("29 accounts role cannot perform staged Management approval", () => assert.match(consolidationRoute, /Management authority is required to approve staged consolidation economics/));
test("30 approval for V1 cannot authorize a different derived V2", () => assert.match(preparation, /loadCommercialApprovalInTransaction\(transaction, resolved\.version\)/));
test("31 approval target fingerprint is loaded from immutable package member", () => assert.match(preparation, /loadCommercialVersionInTransaction\(transaction, member\.derived_commercial_version_id, member\.derived_commercial_fingerprint/));
test("32 partial approval keeps package pending", () => assert.deepEqual(consolidationAllocationApprovalStatus([{ approval_required: true, approved: true }, { approval_required: true, approved: false }]), { status: "pending_approval", required: 2, approved: 1, pending: 1 }));
test("33 all exact approvals make package ready", () => assert.deepEqual(consolidationAllocationApprovalStatus([{ approval_required: true, approved: true }, { approval_required: true, approved: true }]), { status: "ready", required: 2, approved: 2, pending: 0 }));
test("34 non-approved approval documents cannot satisfy package read model", () => assert.match(preparation, /text\(approval\.get\("status"\)\) === "approved"/));
test("35 exact approval survives identical preparation retry", () => assert.match(preparation, /loadCommercialApprovalInTransaction\(transaction, version\)/));
test("36 changed package economics cannot inherit old version approval", () => assert.match(preparation, /derivedVersionId\(input\.packageFingerprint/));

// Customer sell authority from #131.
test("37 buy-only allocation uses #131 carry-forward prepare helper", () => assert.match(preparation, /prepareCustomerSellAuthorityCarryForwardInTransaction/));
test("38 carried authority is persisted to exact deterministic target version", () => assert.match(preparation, /persistPreparedCustomerSellAuthorityCarryForwardInTransaction\(transaction, carryForwards\[index\]\)/));
test("39 sell-changing allocation fails instead of carrying acceptance", () => assert.match(preparation, /!customerSellEconomicsMatch\(source\.snapshot, derived\.snapshot\).*customer_quote_stale/));
test("40 missing source customer acceptance is not fabricated", () => assert.match(preparation, /prepared\.kind === "not_carried".*customer_acceptance_required/));
test("41 conflicting target customer acceptance fails closed", () => assert.match(preparation, /prepared\.kind === "conflict".*customer_quote_stale/));
test("42 internal bridge quote does not satisfy customer acceptance", () => {
  assert.match(customerAuthority, /commercial_customer_acceptances/);
  assert.doesNotMatch(preparation, /source: "tms_consolidation_house_bridge"[\s\S]*?accept/);
});
test("43 wrong customer is revalidated at booking", () => assert.match(preparation, /normalizeCommercialId\(order\.get\("customer_id"\)\) !== normalizeCommercialId\(members\.find/));
test("44 wrong sell facts cannot carry because #131 exact economics matcher is required", () => assert.match(preparation, /customerSellEconomicsMatch\(source\.snapshot, derived\.snapshot\)/));

// Final booking must consume exact staged package.
test("45 pending package cannot book without exact approval", () => assert.match(preparation, /bookable\.decision\.reason === "approval_required".*return \{ kind: "approval_required"/));
test("46 ready package is consumed by the final booking transaction", () => assert.match(booking, /loadPreparedConsolidationAllocationForBookingInTransaction/));
test("47 booking consumes staged derived versions", () => assert.match(booking, /const bookedHouseVersions = prepared\.derivedVersions/));
test("48 booking does not derive a new commercial version", () => {
  assert.doesNotMatch(booking, /deriveConsolidationAllocationSnapshot/);
  assert.doesNotMatch(booking, /newCommercialVersion/);
});
test("49 booking does not persist a newly created house commercial version", () => assert.doesNotMatch(booking, /persistCommercialVersionInTransaction/));
test("50 package version and persisted derived version fingerprint mismatch blocks stale", () => assert.match(preparation, /loadCommercialVersionInTransaction\(transaction, member\.derived_commercial_version_id, member\.derived_commercial_fingerprint/));
test("51 released manifest changed after preparation blocks stale", () => assert.match(preparation, /hash\(manifest\) !== packageData\.released_manifest_fingerprint/));
test("52 source commercial changed after preparation blocks stale", () => assert.match(preparation, /commercial_version_id[\s\S]*?released\.versionId[\s\S]*?commercial_fingerprint[\s\S]*?released\.fingerprint/));
test("53 master procurement changed after preparation blocks stale", () => assert.match(preparation, /commercials\.currency !== packageData\.allocation_currency[\s\S]*?sameCommercialMoney\(commercials\.amount, packageData\.allocation_total/));
test("54 booking retry validates same booked allocation package", () => assert.match(booking, /validateBookedConsolidationAllocationForRetryInTransaction/));
test("55 different booking reference retains #127 booking conflict", () => assert.match(booking, /retry as "booking_conflict" \| "state_conflict"/));
test("56 twenty-house package remains below configured consolidation cap", () => {
  const members = Array.from({ length: 20 }, (_, index) => member(`ORD-${index + 1}`, index + 1));
  const result = allocate(100000, "NPR", members);
  const scale = 10 ** consolidationCurrencyDecimals("NPR");
  const allocatedUnits = result.allocations.reduce((total, item) => total + Math.round(item.amount * scale), 0);
  assert.equal(result.allocations.length, 20);
  assert.equal(allocatedUnits, Math.round(100000 * scale));
  assert.equal(result.total, 100000);
});
test("57 partial booking graph is protected by one Firestore transaction", () => {
  assert.match(booking, /runTransaction/);
  assert.match(booking, /transaction\.create\(db\.collection\("shipments"\)/);
});

// Money, precision and residuals.
test("58 100 divided by 3 uses deterministic residual", () => {
  const result = allocate(100, "NPR", [member("ORD-1"), member("ORD-2"), member("ORD-3")]);
  assert.deepEqual(result.allocations.map((item) => item.amount), [33.33, 33.33, 33.34]);
  assert.deepEqual(result.residual_recipients, ["ORD-3"]);
});
test("59 retry with reversed input reproduces same residual recipient", () => {
  const a = allocate(100, "NPR", [member("ORD-1"), member("ORD-2"), member("ORD-3")]);
  const b = allocate(100, "NPR", [member("ORD-3"), member("ORD-1"), member("ORD-2")]);
  assert.deepEqual(a.allocations, b.allocations);
  assert.deepEqual(a.residual_recipients, b.residual_recipients);
});
test("60 JPY uses zero-decimal precision", () => {
  assert.equal(consolidationCurrencyDecimals("JPY"), 0);
  const result = allocate(100, "JPY", [member("ORD-1"), member("ORD-2"), member("ORD-3")]);
  assert.deepEqual(result.allocations.map((item) => item.amount), [33, 33, 34]);
});
test("61 zero total physical basis is handled explicitly as equal split", () => assert.equal(allocate(9, "NPR", [member("A"), member("B"), member("C")]).basis, "equal"));
test("62 negative master procurement is rejected", () => assert.deepEqual(allocateConsolidationProcurement(-1, "NPR", [member("A", 1)]), { ok: false, reason: "invalid_total" }));
test("63 NaN and infinity master procurement are rejected", () => {
  assert.deepEqual(allocateConsolidationProcurement(Number.NaN, "NPR", [member("A", 1)]), { ok: false, reason: "invalid_total" });
  assert.deepEqual(allocateConsolidationProcurement(Number.POSITIVE_INFINITY, "NPR", [member("A", 1)]), { ok: false, reason: "invalid_total" });
});
test("64 allocated minor-unit sum equals master procurement", () => {
  const result = allocate(12345.67, "NPR", [member("A", 13), member("B", 17), member("C", 19), member("D", 23)]);
  assert.equal(Math.round(sum(result.allocations.map((item) => item.amount)) * 100), 1234567);
});
test("65 multi-currency without historical FX fails commercial review", () => assert.match(preparation, /pricing\.converted_buy_cost === null.*commercial_review_required/));
test("66 duplicate house id is rejected", () => assert.deepEqual(allocateConsolidationProcurement(10, "NPR", [member("A", 1), member("a", 1)]), { ok: false, reason: "duplicate_house" }));
test("67 invalid negative or non-finite house basis is rejected", () => {
  assert.deepEqual(allocateConsolidationProcurement(10, "NPR", [member("A", -1)]), { ok: false, reason: "invalid_members" });
  assert.deepEqual(allocateConsolidationProcurement(10, "NPR", [member("A", Number.NaN)]), { ok: false, reason: "invalid_members" });
});
test("68 basis preference is weight then volume then pieces then equal", () => {
  assert.equal(allocate(10, "NPR", [member("A", 1, 10, 10), member("B", 1, 20, 20)]).basis, "weight_kg");
  assert.equal(allocate(10, "NPR", [member("A", 0, 10, 10), member("B", 0, 20, 20)]).basis, "volume_cbm");
  assert.equal(allocate(10, "NPR", [member("A", 0, 0, 10), member("B", 0, 0, 20)]).basis, "pieces");
});

// Race, state and transaction-order regression guards.
test("69 prepare vs prepare has one deterministic economic identity", () => assert.doesNotMatch(preparation, /randomBytes|Math\.random|Date\.now\(\).*package/));
test("70 prepare vs load change rereads load inside transaction", () => assert.match(preparation, /runTransaction[\s\S]*?transaction\.get\(loadRef\)/));
test("71 approval vs reprepare binds approval to package member exact version", () => assert.match(preparation, /targetMember = packageData\.members\.find\(\(member\) => member\.derived_commercial_version_id === versionId\)/));
test("72 approval vs booking rereads exact approval inside booking transaction", () => assert.match(preparation, /assertBookableCommercialVersionInTransaction\(transaction, derived\)/));
test("73 only one current package pointer is authoritative", () => assert.match(preparation, /current_allocation_package_id/));
test("74 identical prepare keeps current package while changed prepare supersedes old", () => assert.match(preparation, /superseded_by_package_id: id/));
test("75 package approval state is never blindly trusted by booking", () => {
  assert.match(preparation, /const bookable = await assertBookableCommercialVersionInTransaction\(transaction, derived\)/);
  assert.doesNotMatch(booking, /prepared\.package\.status === "ready"/);
});
test("76 preparation write phase occurs after customer authority, package, derived and approval reads", () => {
  const writeMarker = preparation.indexOf("// WRITE PHASE: every transaction.get/query/authority read has completed above.");
  const prepareEnd = preparation.indexOf("export async function approveConsolidationCommercialAllocationVersion");
  assert.ok(writeMarker > preparation.indexOf("prepareCustomerSellAuthorityCarryForwardInTransaction"));
  assert.ok(writeMarker > preparation.indexOf("loadCommercialApprovalInTransaction"));
  assert.ok(prepareEnd > writeMarker);
  assert.equal(preparation.slice(writeMarker, prepareEnd).includes("transaction.get("), false);
});
test("77 booking write phase has no Firestore reads or stale-return exits after it begins", () => {
  const writeMarker = booking.indexOf("// WRITE PHASE begins. No transaction.get/query call appears below this point.");
  assert.ok(writeMarker > booking.indexOf("loadPreparedConsolidationAllocationForBookingInTransaction"));
  const writePhase = booking.slice(writeMarker);
  assert.equal(writePhase.includes("transaction.get("), false);
  assert.equal(writePhase.includes('return { kind: "commercial_allocation_stale"'), false);
});
test("78 preparation creates no shipment or booking graph artifacts", () => {
  assert.doesNotMatch(preparation, /collection\("shipments"\)/);
  assert.doesNotMatch(preparation, /ensureBookingArtifacts/);
  assert.doesNotMatch(preparation, /active_shipment_count/);
});
test("79 final booking promotes staged version only inside successful booking write phase", () => {
  const writeMarker = booking.indexOf("// WRITE PHASE begins");
  const pointerWrite = booking.indexOf("commercial_version_id: version.id", writeMarker);
  assert.ok(pointerWrite > writeMarker);
});
test("80 load cancellation remains pre-release only and staged code does not add destructive cancellation", () => {
  assert.match(consolidationRoute, /cancelDraftConsolidationLoad/);
  assert.doesNotMatch(preparation, /transaction\.delete\(/);
});

// API/read model/discoverability and scope guards.
test("81 GET allocation read model does not prepare, approve or book", () => {
  const getBlock = consolidationRoute.slice(consolidationRoute.indexOf("export async function GET"), consolidationRoute.indexOf("export async function POST"));
  assert.match(getBlock, /listCurrentConsolidationAllocationViews/);
  assert.doesNotMatch(getBlock, /prepareConsolidationCommercialAllocation\(/);
  assert.doesNotMatch(getBlock, /approveConsolidationCommercialAllocationVersion\(/);
});
test("82 API exposes explicit successful approval-required staging response", () => assert.match(consolidationRoute, /status: result\.kind === "approval_required" \? "approval_required" : "ready"/));
test("83 booking returns explicit allocation-not-prepared conflict", () => assert.match(tenderRoute, /allocation_not_prepared/));
test("84 booking returns explicit commercial-allocation-stale conflict", () => assert.match(tenderRoute, /commercial_allocation_stale/));
test("85 dispatcher uses prepared allocation booking path while standard booking remains #127", () => {
  assert.match(dispatcher, /confirmConsolidatedLoadBookingWithPreparedAllocation/);
  assert.match(dispatcher, /return confirmTmsTenderBooking\(tenderId, input, actor, staff\)/);
});
test("86 UI exposes prepare allocation action", () => assert.match(desk, /action: "prepare_allocation"/));
test("87 UI exposes exact Management approval action", () => assert.match(desk, /action: "approve_allocation"[\s\S]*?commercialVersionId/));
test("88 UI shows partial approval progress and ready-to-book state", () => {
  assert.match(desk, /approved_approvals.*required_approvals/);
  assert.match(desk, /Ready to book/);
});
test("89 package remains separate from ordinary load status machine", () => assert.match(preparation, /commercial_allocation_status: approvalState\.status/));
test("90 consolidation allocation suite is registered in normal npm test", () => assert.match(packageJson.scripts.test, /tests\/consolidation-allocation-approval\.test\.mjs/));
