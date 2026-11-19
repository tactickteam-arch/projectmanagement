import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateOnly } from "../src/lib/dates";
import { computeOverallStatus, computeProgressPercent, daysOverdue, isDone, isOverdue, pendingGates, stepRag, worstRag, type ModuleState } from "../src/lib/status";
import { MODULE_DEFINITIONS, SETUP_TRACK_TYPES } from "../src/modules";

const PAID = { payment: { paidAmount: 200000, paidOn: "2026-11-01", paymentMode: "NEFT" } };
const notStarted = (): ModuleState[] => MODULE_DEFINITIONS.map((m) => ({ moduleType: m.moduleType, status: "NOT_STARTED", approvalStatus: "PENDING" }));
const approved = (t: string): Partial<ModuleState> => ({ status: "COMPLETED", approvalStatus: "APPROVED", details: t === "TOKEN_ADVANCE" ? PAID : {} });
function withModule(mods: ModuleState[], type: string, patch: Partial<ModuleState>): ModuleState[] {
  return mods.map((m) => (m.moduleType === type ? { ...m, ...patch } : m));
}
const withDone = (mods: ModuleState[], ...types: string[]) => types.reduce((acc, t) => withModule(acc, t, approved(t)), mods);
const blankStore = { overallStatus: null, keyHandoverDate: null, actualLaunchDate: null };
const keysStore = { ...blankStore, keyHandoverDate: parseDateOnly("2026-11-01") };
const allDone = () => notStarted().map((m) => ({ ...m, ...approved(m.moduleType) }));
const allButLaunch = () => withModule(allDone(), "SOFT_LAUNCH", { status: "NOT_STARTED", approvalStatus: "PENDING" });

describe("computeOverallStatus (SOP stages)", () => {
  it("is null (location filing) for a brand-new store", () => {
    assert.equal(computeOverallStatus(blankStore, notStarted()), null);
  });

  it("Location approved needs step 1 approved by Boss + CEO, not just completed", () => {
    assert.equal(computeOverallStatus(blankStore, withModule(notStarted(), "LOCATION_FILING", { status: "COMPLETED", approvalStatus: "PENDING" })), null);
    assert.equal(computeOverallStatus(blankStore, withDone(notStarted(), "LOCATION_FILING")), "LOCATION_FINALISED");
  });

  it("Landlord check cleared once RK approves step 2", () => {
    assert.equal(computeOverallStatus(blankStore, withDone(notStarted(), "LOCATION_FILING", "LANDLORD_CHECK")), "PREMISES_CLEARED");
  });

  it("Token paid needs Accounts' approval AND HO's payment record", () => {
    const mods = withDone(notStarted(), "LOCATION_FILING", "LANDLORD_CHECK");
    const approvedNotPaid = withModule(mods, "TOKEN_ADVANCE", { status: "COMPLETED", approvalStatus: "APPROVED", details: {} });
    assert.equal(computeOverallStatus(blankStore, approvedNotPaid), "PREMISES_CLEARED");
    assert.deepEqual(pendingGates(approvedNotPaid.find((m) => m.moduleType === "TOKEN_ADVANCE")!), ["payment"]);
    assert.equal(computeOverallStatus(blankStore, withDone(mods, "TOKEN_ADVANCE")), "TOKEN_PAID");
  });

  it("the APX PO record does not hold up Token paid (only HO's payment gates it)", () => {
    const m: ModuleState = { moduleType: "TOKEN_ADVANCE", status: "COMPLETED", approvalStatus: "APPROVED", details: PAID };
    assert.equal(isDone(m), true);
  });

  it("Keys received once RK accepts the handover (Day 0 set)", () => {
    assert.equal(computeOverallStatus(keysStore, notStarted()), "KEYS_RECEIVED");
    assert.equal(computeOverallStatus(blankStore, withDone(notStarted(), "KEY_HANDOVER")), "KEYS_RECEIVED");
  });

  it("Store setup in progress when on-site work or a department track has started", () => {
    assert.equal(computeOverallStatus(keysStore, withModule(notStarted(), "HR", { status: "IN_PROGRESS" })), "FITOUT_IN_PROGRESS");
    assert.equal(computeOverallStatus(keysStore, withModule(notStarted(), "SITE_FURNITURE", { status: "IN_PROGRESS" })), "FITOUT_IN_PROGRESS");
    assert.equal(computeOverallStatus(keysStore, withModule(notStarted(), "LEGAL_STATUTORY", { status: "IN_PROGRESS" })), "KEYS_RECEIVED");
  });

  it("All departments green when all 8 Stage 6 tracks are green", () => {
    assert.equal(computeOverallStatus(keysStore, allButLaunch()), "READY_FOR_LAUNCH");
    for (const t of SETUP_TRACK_TYPES) {
      const one = withModule(allButLaunch(), t, { status: "IN_PROGRESS", approvalStatus: "PENDING" });
      assert.notEqual(computeOverallStatus(keysStore, one), "READY_FOR_LAUNCH", t);
    }
  });

  it("Soft launched when step 7 is done", () => {
    assert.equal(computeOverallStatus(keysStore, allDone()), "LAUNCHED");
  });

  it("ignores rows of retired module types", () => {
    const mods = [...allButLaunch(), { moduleType: "AIR_CONDITIONING", status: "NOT_STARTED" as const, approvalStatus: "PENDING" as const }];
    assert.equal(computeOverallStatus(keysStore, mods), "READY_FOR_LAUNCH");
  });

  it("keeps On Hold / Dropped set by HQ", () => {
    for (const manual of ["ON_HOLD", "DROPPED"] as const) {
      assert.equal(computeOverallStatus({ ...blankStore, overallStatus: manual, actualLaunchDate: parseDateOnly("2026-11-10") }, allDone()), manual);
    }
  });
});

describe("computeProgressPercent (steps done ÷ 21)", () => {
  it("counts only done steps", () => {
    let mods = withDone(notStarted(), "LOCATION_FILING");
    mods = withModule(mods, "LANDLORD_CHECK", { status: "COMPLETED", approvalStatus: "PENDING" });
    assert.equal(computeProgressPercent(mods), 5); // 1 of 21 = 4.8
    assert.equal(computeProgressPercent(allDone()), 100);
    assert.equal(computeProgressPercent([]), 0);
  });
});

describe("isOverdue / daysOverdue", () => {
  const today = parseDateOnly("2026-11-11");
  it("is overdue only after the planned end date", () => {
    assert.equal(isOverdue(parseDateOnly("2026-11-10"), "IN_PROGRESS", today), true);
    assert.equal(isOverdue(parseDateOnly("2026-11-11"), "IN_PROGRESS", today), false);
    assert.equal(isOverdue(parseDateOnly("2026-11-10"), "COMPLETED", today), false);
    assert.equal(isOverdue(null, "NOT_STARTED", today), false);
  });
  it("counts days overdue", () => {
    assert.equal(daysOverdue(parseDateOnly("2026-11-03"), "BLOCKED", today), 8);
    assert.equal(daysOverdue(parseDateOnly("2026-11-03"), "COMPLETED", today), 0);
  });
});

describe("weekly RAG (slide 11)", () => {
  const today = parseDateOnly("2026-11-11");
  const step = (patch: Partial<ModuleState> & { plannedStart?: Date | null; plannedEnd?: Date | null }) => ({
    moduleType: "HR", status: "IN_PROGRESS" as const, approvalStatus: "PENDING" as const, plannedStart: parseDateOnly("2026-11-01"), plannedEnd: parseDateOnly("2026-11-30"), ...patch,
  });
  it("Green when done or on track", () => {
    assert.equal(stepRag(step({ status: "COMPLETED", approvalStatus: "APPROVED" }), false, today), "G");
    assert.equal(stepRag(step({}), false, today), "G");
  });
  it("Red when overdue or blocked", () => {
    assert.equal(stepRag(step({ plannedEnd: parseDateOnly("2026-11-10") }), false, today), "R");
    assert.equal(stepRag(step({ status: "BLOCKED" }), false, today), "R");
  });
  it("Amber when due within 3 days, late to start, or waiting for approval", () => {
    assert.equal(stepRag(step({ plannedEnd: parseDateOnly("2026-11-13") }), false, today), "A");
    assert.equal(stepRag(step({ status: "NOT_STARTED" }), false, today), "A");
    assert.equal(stepRag(step({ status: "COMPLETED", approvalStatus: "PENDING" }), false, today), "A");
  });
  it("not reached (no colour) while waiting on earlier steps and not yet due", () => {
    assert.equal(stepRag(step({ status: "NOT_STARTED" }), true, today), null);
  });
  it("worst colour wins", () => {
    assert.equal(worstRag(["G", null, "A"]), "A");
    assert.equal(worstRag(["G", "R", "A"]), "R");
    assert.equal(worstRag([null]), null);
  });
});
