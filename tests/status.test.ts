import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateOnly } from "../src/lib/dates";
import { computeOverallStatus, computeProgressPercent, daysOverdue, isOverdue, type ModuleState } from "../src/lib/status";
import { MODULE_DEFINITIONS, SETUP_TRACK_TYPES } from "../src/modules";

const notStarted = (): ModuleState[] =>
  MODULE_DEFINITIONS.map((m) => ({ moduleType: m.moduleType, status: "NOT_STARTED", approvalStatus: "PENDING" }));

function withModule(mods: ModuleState[], type: string, patch: Partial<ModuleState>): ModuleState[] {
  return mods.map((m) => (m.moduleType === type ? { ...m, ...patch } : m));
}
const withDone = (mods: ModuleState[], ...types: string[]) => types.reduce((acc, t) => withModule(acc, t, approved), mods);

const approved: Partial<ModuleState> = { status: "COMPLETED", approvalStatus: "APPROVED" };
const blankStore = { overallStatus: null, keyHandoverDate: null, actualLaunchDate: null };
const keysStore = { ...blankStore, keyHandoverDate: parseDateOnly("2026-11-01") };
const allDone = () => notStarted().map((m) => ({ ...m, ...approved }));

describe("computeOverallStatus (launch flow)", () => {
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

  it("Token paid only once Accounts approves the advance (step 3)", () => {
    let mods = withDone(notStarted(), "LOCATION_FILING", "LANDLORD_CHECK");
    assert.equal(computeOverallStatus(blankStore, withModule(mods, "TOKEN_ADVANCE", { status: "COMPLETED", approvalStatus: "PENDING" })), "PREMISES_CLEARED");
    mods = withDone(mods, "TOKEN_ADVANCE");
    assert.equal(computeOverallStatus(blankStore, mods), "TOKEN_PAID");
  });

  it("Keys received once RK accepts the handover (Day 0 set)", () => {
    assert.equal(computeOverallStatus(keysStore, notStarted()), "KEYS_RECEIVED");
    assert.equal(computeOverallStatus(blankStore, withDone(notStarted(), "KEY_HANDOVER")), "KEYS_RECEIVED");
  });

  it("Store setup in progress when any department track has started", () => {
    assert.equal(computeOverallStatus(keysStore, withModule(notStarted(), "HR", { status: "IN_PROGRESS" })), "FITOUT_IN_PROGRESS");
    // Legal (step 4) running alongside is not a department track
    assert.equal(computeOverallStatus(keysStore, withModule(notStarted(), "LEGAL_STATUTORY", { status: "IN_PROGRESS" })), "KEYS_RECEIVED");
  });

  it("all departments green (Ready for Launch) needs every one of the 13 steps done", () => {
    assert.equal(computeOverallStatus(keysStore, allDone()), "READY_FOR_LAUNCH");
    for (const t of ["LEGAL_STATUTORY", ...SETUP_TRACK_TYPES]) {
      const one = withModule(allDone(), t, { status: "IN_PROGRESS", approvalStatus: "PENDING" });
      assert.notEqual(computeOverallStatus(keysStore, one), "READY_FOR_LAUNCH", t);
    }
  });

  it("ignores rows of retired module types", () => {
    const mods = [...allDone(), { moduleType: "AIR_CONDITIONING", status: "NOT_STARTED" as const, approvalStatus: "PENDING" as const }];
    assert.equal(computeOverallStatus(keysStore, mods), "READY_FOR_LAUNCH");
  });

  it("Soft launched when the actual launch date is entered", () => {
    assert.equal(computeOverallStatus({ ...blankStore, actualLaunchDate: parseDateOnly("2026-11-10") }, notStarted()), "LAUNCHED");
  });

  it("keeps On Hold / Dropped set by HQ", () => {
    for (const manual of ["ON_HOLD", "DROPPED"] as const) {
      const store = { ...blankStore, overallStatus: manual, actualLaunchDate: parseDateOnly("2026-11-10") };
      assert.equal(computeOverallStatus(store, notStarted()), manual);
    }
  });
});

describe("computeProgressPercent (steps done ÷ 13)", () => {
  it("counts only done (approved) steps", () => {
    let mods = withDone(notStarted(), "LOCATION_FILING");
    mods = withModule(mods, "LANDLORD_CHECK", { status: "COMPLETED", approvalStatus: "PENDING" });
    assert.equal(computeProgressPercent(mods), 8); // 1 of 13 = 7.7
    assert.equal(computeProgressPercent(allDone()), 100);
    assert.equal(computeProgressPercent([]), 0);
  });
});

describe("isOverdue / daysOverdue (spec: planned end passed and not Completed)", () => {
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
