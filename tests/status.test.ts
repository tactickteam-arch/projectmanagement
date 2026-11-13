import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateOnly } from "../src/lib/dates";
import { computeOverallStatus, computeProgressPercent, daysOverdue, isOverdue, type ModuleState } from "../src/lib/status";
import { MODULE_DEFINITIONS } from "../src/modules";

const notStarted = (): ModuleState[] =>
  MODULE_DEFINITIONS.map((m) => ({ moduleType: m.moduleType, status: "NOT_STARTED", approvalStatus: "PENDING" }));

function withModule(mods: ModuleState[], type: string, patch: Partial<ModuleState>): ModuleState[] {
  return mods.map((m) => (m.moduleType === type ? { ...m, ...patch } : m));
}

const approved: Partial<ModuleState> = { status: "COMPLETED", approvalStatus: "APPROVED" };
const blankStore = { overallStatus: null, keyHandoverDate: null, actualLaunchDate: null };
const allSetupApproved = () => notStarted().map((m) => (m.moduleType === "KEY_HANDOVER" ? { ...m, status: "COMPLETED" as const } : { ...m, ...approved }));

describe("computeOverallStatus (spec: Overall status rules)", () => {
  it("is null for a brand-new store", () => {
    assert.equal(computeOverallStatus(blankStore, notStarted()), null);
  });

  it("Location Finalised needs Store Location approved, not just completed", () => {
    let mods = withModule(notStarted(), "STORE_LOCATION", { status: "COMPLETED", approvalStatus: "PENDING" });
    assert.equal(computeOverallStatus(blankStore, mods), null);
    mods = withModule(notStarted(), "STORE_LOCATION", approved);
    assert.equal(computeOverallStatus(blankStore, mods), "LOCATION_FINALISED");
  });

  it("Token Paid when Token Advance is Completed", () => {
    let mods = withModule(notStarted(), "STORE_LOCATION", approved);
    mods = withModule(mods, "TOKEN_ADVANCE", { status: "COMPLETED", approvalStatus: "PENDING" });
    assert.equal(computeOverallStatus(blankStore, mods), "TOKEN_PAID");
  });

  it("Keys Received when key handover date is entered", () => {
    const store = { ...blankStore, keyHandoverDate: parseDateOnly("2026-11-01") };
    assert.equal(computeOverallStatus(store, notStarted()), "KEYS_RECEIVED");
  });

  it("Fit-out in Progress when any fit-out module has started", () => {
    const store = { ...blankStore, keyHandoverDate: parseDateOnly("2026-11-01") };
    const mods = withModule(notStarted(), "AIR_CONDITIONING", { status: "IN_PROGRESS" });
    assert.equal(computeOverallStatus(store, mods), "FITOUT_IN_PROGRESS");
  });

  it("starting a non-fit-out module does not count as fit-out", () => {
    const mods = withModule(notStarted(), "KEY_HANDOVER", { status: "IN_PROGRESS" });
    assert.equal(computeOverallStatus(blankStore, mods), null);
  });

  it("Ready for Launch when all 7 setup modules are approved (Key Handover milestone not approved)", () => {
    const store = { ...blankStore, keyHandoverDate: parseDateOnly("2026-11-01") };
    assert.equal(computeOverallStatus(store, allSetupApproved()), "READY_FOR_LAUNCH");
    const oneNotApproved = withModule(allSetupApproved(), "IT_WORKS", { approvalStatus: "PENDING" });
    assert.equal(computeOverallStatus(store, oneNotApproved), "FITOUT_IN_PROGRESS");
  });

  it("Launched when actual launch date is entered", () => {
    const store = { ...blankStore, actualLaunchDate: parseDateOnly("2026-11-10") };
    assert.equal(computeOverallStatus(store, notStarted()), "LAUNCHED");
  });

  it("keeps On Hold / Dropped set by HQ", () => {
    for (const manual of ["ON_HOLD", "DROPPED"] as const) {
      const store = { ...blankStore, overallStatus: manual, actualLaunchDate: parseDateOnly("2026-11-10") };
      assert.equal(computeOverallStatus(store, notStarted()), manual);
    }
  });
});

describe("computeProgressPercent (spec: approved ÷ total × 100, 7 setup modules)", () => {
  it("counts only approved setup modules", () => {
    let mods = withModule(notStarted(), "STORE_LOCATION", approved);
    mods = withModule(mods, "TOKEN_ADVANCE", { status: "COMPLETED", approvalStatus: "PENDING" });
    assert.equal(computeProgressPercent(mods), 14); // 1 of 7 = 14.3
    assert.equal(computeProgressPercent(allSetupApproved()), 100);
    assert.equal(computeProgressPercent([]), 0);
  });

  it("the Key Handover milestone does not count", () => {
    const mods = withModule(notStarted(), "KEY_HANDOVER", approved);
    assert.equal(computeProgressPercent(mods), 0);
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
