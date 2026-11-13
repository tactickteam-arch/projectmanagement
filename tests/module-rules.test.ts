import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateOnly } from "../src/lib/dates";
import { approvalAfterSave, canBeApproved, checkModuleRules, detailsSchema, type ModuleRuleInput } from "../src/lib/module-rules";
import { cityCode, formatStoreCode, serialFromCode } from "../src/lib/store-code";
import { getModuleDefinition } from "../src/modules";

const base = (patch: Partial<ModuleRuleInput> = {}, next: Partial<ModuleRuleInput["next"]> = {}): ModuleRuleInput => ({
  moduleType: "AIR_CONDITIONING",
  current: { status: "IN_PROGRESS", approvalStatus: "PENDING" },
  storeHasKeyHandover: true,
  photoCount: 0,
  minPhotos: 1,
  ...patch,
  next: { status: "IN_PROGRESS", blockerReason: null, actualStart: null, actualEnd: null, plannedStart: null, plannedEnd: null, ...next },
});

describe("checkModuleRules (spec: Validation rules)", () => {
  it("cannot mark Completed without the minimum photos", () => {
    assert.ok(checkModuleRules(base({ photoCount: 0 }, { status: "COMPLETED" })).photos);
    assert.equal(checkModuleRules(base({ photoCount: 1 }, { status: "COMPLETED" })).photos, undefined);
  });

  it("Key Handover needs 2 photos, In-shop Branding 4 (minimums come from the module config)", () => {
    assert.equal(getModuleDefinition("KEY_HANDOVER")?.minPhotos, 2);
    const branding = base({ moduleType: "INSHOP_BRANDING", minPhotos: 4, photoCount: 3 }, { status: "COMPLETED" });
    assert.ok(checkModuleRules(branding).photos);
    assert.equal(checkModuleRules({ ...branding, photoCount: 4 }).photos, undefined);
  });

  it("Blocked requires a blocker reason", () => {
    assert.ok(checkModuleRules(base({}, { status: "BLOCKED", blockerReason: "  " })).blockerReason);
    assert.equal(checkModuleRules(base({}, { status: "BLOCKED", blockerReason: "Waiting for NOC" })).blockerReason, undefined);
  });

  it("fit-out modules cannot start before the key handover date", () => {
    assert.ok(checkModuleRules(base({ storeHasKeyHandover: false }, { status: "IN_PROGRESS" })).status);
    assert.equal(checkModuleRules(base({ storeHasKeyHandover: false }, { status: "NOT_STARTED" })).status, undefined);
    // Store Location is not a fit-out module
    assert.equal(checkModuleRules(base({ moduleType: "STORE_LOCATION", storeHasKeyHandover: false }, { status: "IN_PROGRESS" })).status, undefined);
  });

  it("actual end cannot be before actual start", () => {
    const e = checkModuleRules(base({}, { actualStart: parseDateOnly("2026-11-10"), actualEnd: parseDateOnly("2026-11-09") }));
    assert.ok(e.actualEnd);
    assert.equal(checkModuleRules(base({}, { actualStart: parseDateOnly("2026-11-10"), actualEnd: parseDateOnly("2026-11-10") })).actualEnd, undefined);
  });

  it("approved modules are locked; Key Handover only through its own form", () => {
    assert.ok(checkModuleRules(base({ current: { status: "COMPLETED", approvalStatus: "APPROVED" } })).status);
    assert.ok(checkModuleRules(base({ moduleType: "KEY_HANDOVER" })).status);
  });
});

describe("approval flow", () => {
  it("marking Completed asks HQ for approval again (also after a rejection)", () => {
    assert.deepEqual(approvalAfterSave({ status: "IN_PROGRESS", approvalStatus: "REJECTED" }, "COMPLETED"), { approvalStatus: "PENDING", submitted: true });
    assert.deepEqual(approvalAfterSave({ status: "IN_PROGRESS", approvalStatus: "REJECTED" }, "IN_PROGRESS"), { approvalStatus: "REJECTED", submitted: false });
  });
  it("only Completed + Pending setup modules can be decided", () => {
    assert.equal(canBeApproved({ moduleType: "IT_WORKS", status: "COMPLETED", approvalStatus: "PENDING" }), true);
    assert.equal(canBeApproved({ moduleType: "IT_WORKS", status: "IN_PROGRESS", approvalStatus: "PENDING" }), false);
    assert.equal(canBeApproved({ moduleType: "IT_WORKS", status: "COMPLETED", approvalStatus: "APPROVED" }), false);
    assert.equal(canBeApproved({ moduleType: "KEY_HANDOVER", status: "COMPLETED", approvalStatus: "PENDING" }), false);
  });
});

describe("detailsSchema (config-driven validation)", () => {
  const ac = detailsSchema(getModuleDefinition("AIR_CONDITIONING")!.fields);
  const loc = detailsSchema(getModuleDefinition("STORE_LOCATION")!.fields);
  it("accepts valid values and strips unknown keys", () => {
    const r = ac.parse({ acType: "Split", units: 3, totalTonnage: 4.5, installationDate: "2026-11-01", hacker: "x" });
    assert.deepEqual(r, { acType: "Split", units: 3, totalTonnage: 4.5, installationDate: "2026-11-01" });
  });
  it("rejects values outside the configured options and ranges", () => {
    assert.equal(ac.safeParse({ acType: "Window" }).success, false);
    assert.equal(ac.safeParse({ units: -1 }).success, false);
    assert.equal(loc.safeParse({ footfallRating: 6 }).success, false);
    assert.equal(loc.safeParse({ yearlyEscalationPct: 5, locationApprovedByHq: true }).success, true);
  });
});

describe("store code (spec: SGM-<STATE>-<CITY>-<NNNN>)", () => {
  it("formats like the spec example", () => {
    assert.equal(formatStoreCode("KA", "Bengaluru", 142), "SGM-KA-BLR-0142");
    assert.equal(cityCode("Mangaluru"), "MLR");
    assert.equal(cityCode("Siliguri"), "SIL");
    assert.equal(serialFromCode("SGM-KA-BLR-0142"), 142);
  });
});
