import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateOnly } from "../src/lib/dates";
import { approvalAfterSave, canBeApproved, checkModuleRules, completionErrors, detailsSchema, missingPrerequisites, type ModuleRuleInput } from "../src/lib/module-rules";
import { cityCode, formatStoreCode, serialFromCode } from "../src/lib/store-code";
import { getModuleDefinition, MODULE_DEFINITIONS } from "../src/modules";

const base = (patch: Partial<ModuleRuleInput> = {}, next: Partial<ModuleRuleInput["next"]> = {}): ModuleRuleInput => ({
  moduleType: "HR",
  current: { status: "IN_PROGRESS", approvalStatus: "PENDING" },
  missingPrerequisites: [],
  photoCount: 0,
  minPhotos: 1,
  ...patch,
  next: { status: "IN_PROGRESS", blockerReason: null, actualStart: null, actualEnd: null, plannedStart: null, plannedEnd: null, ...next },
});
const state = (moduleType: string, done: boolean) => ({ moduleType, status: done ? ("COMPLETED" as const) : ("NOT_STARTED" as const), approvalStatus: done ? ("APPROVED" as const) : ("PENDING" as const) });

describe("checkModuleRules (spec validation + flow order)", () => {
  it("cannot mark Completed without the minimum photos", () => {
    assert.ok(checkModuleRules(base({ photoCount: 0 }, { status: "COMPLETED" })).photos);
    assert.equal(checkModuleRules(base({ photoCount: 1 }, { status: "COMPLETED" })).photos, undefined);
    assert.equal(checkModuleRules(base({ photoCount: 0, minPhotos: 0 }, { status: "COMPLETED" })).photos, undefined);
  });

  it("Key received needs 2 handover photos (from the step config)", () => {
    assert.equal(getModuleDefinition("KEY_HANDOVER")?.minPhotos, 2);
    assert.equal(getModuleDefinition("KEY_HANDOVER")?.photoTag, "photo_handover");
  });

  it("Blocked requires a blocker reason", () => {
    assert.ok(checkModuleRules(base({}, { status: "BLOCKED", blockerReason: "  " })).blockerReason);
    assert.equal(checkModuleRules(base({}, { status: "BLOCKED", blockerReason: "Waiting for NOC" })).blockerReason, undefined);
  });

  it("a step cannot start before its earlier steps are done", () => {
    assert.match(checkModuleRules(base({ missingPrerequisites: ["Key received"] }, { status: "IN_PROGRESS" })).status ?? "", /Key received/);
    assert.equal(checkModuleRules(base({ missingPrerequisites: ["Key received"] }, { status: "NOT_STARTED" })).status, undefined);
  });

  it("actual end cannot be before actual start", () => {
    const e = checkModuleRules(base({}, { actualStart: parseDateOnly("2026-11-10"), actualEnd: parseDateOnly("2026-11-09") }));
    assert.ok(e.actualEnd);
    assert.equal(checkModuleRules(base({}, { actualStart: parseDateOnly("2026-11-10"), actualEnd: parseDateOnly("2026-11-10") })).actualEnd, undefined);
  });

  it("done (approved) steps are locked", () => {
    assert.ok(checkModuleRules(base({ current: { status: "COMPLETED", approvalStatus: "APPROVED" } })).status);
  });

  it("every point must be ticked and required fields filled before Completed", () => {
    const def = getModuleDefinition("KEY_HANDOVER")!;
    const e = checkModuleRules(base({ moduleType: "KEY_HANDOVER", photoCount: 2, minPhotos: 2, fields: def.fields, details: {} }, { status: "COMPLETED" }));
    assert.ok(e.tasks);
    assert.ok(e["details.handoverDate"]);
    assert.ok(e["details.handoverPoints"]);
  });
});

describe("completionErrors", () => {
  const landlord = getModuleDefinition("LANDLORD_CHECK")!;
  const rows = (cleared: boolean[]) => cleared.map((c, i) => ({ itemName: `Point ${i + 1}`, cleared: c, note: null }));
  it("all 8 landlord points must be cleared (RK: “All 8 points cleared”)", () => {
    const tasks = { commercialTerms: true, civilWorkByLandlord: true };
    assert.ok(completionErrors(landlord.fields, { ...tasks, landlordPoints: rows([true, true, true, true, true, true, true, false]) })["details.landlordPoints"]);
    assert.deepEqual(completionErrors(landlord.fields, { ...tasks, landlordPoints: rows(Array(8).fill(true)) }), {});
  });
  it("hidden fields are not required", () => {
    const fields = [{ key: "notes", label: "Notes", type: "text" as const, required: true, showWhen: { key: "x", equals: "y" } }];
    assert.deepEqual(completionErrors(fields, {}), {});
  });
});

describe("flow order (missingPrerequisites)", () => {
  it("follows the launch flow: 1 → 2 → 3 → 5, 4 alongside 3–5, 6 after keys", () => {
    assert.deepEqual(missingPrerequisites("LOCATION_FILING", []), []);
    assert.deepEqual(missingPrerequisites("LANDLORD_CHECK", [state("LOCATION_FILING", false)]), ["LOCATION_FILING"]);
    assert.deepEqual(missingPrerequisites("LANDLORD_CHECK", [state("LOCATION_FILING", true)]), []);
    assert.deepEqual(missingPrerequisites("TOKEN_ADVANCE", [state("LANDLORD_CHECK", true)]), []);
    assert.deepEqual(missingPrerequisites("LEGAL_STATUTORY", [state("LANDLORD_CHECK", true), state("TOKEN_ADVANCE", false)]), []);
    assert.deepEqual(missingPrerequisites("KEY_HANDOVER", [state("TOKEN_ADVANCE", false)]), ["TOKEN_ADVANCE"]);
    for (const t of ["MARKETING", "INTERIORS", "HR", "LAUNCH_PLANNING"]) {
      assert.deepEqual(missingPrerequisites(t, [state("KEY_HANDOVER", false)]), ["KEY_HANDOVER"], t);
      assert.deepEqual(missingPrerequisites(t, [state("KEY_HANDOVER", true)]), [], t);
    }
  });
  it("a step completed but still waiting for approval does not unlock the next one", () => {
    assert.deepEqual(missingPrerequisites("TOKEN_ADVANCE", [{ moduleType: "LANDLORD_CHECK", status: "COMPLETED", approvalStatus: "PENDING" }]), ["LANDLORD_CHECK"]);
  });
  it("every prerequisite is a known step that comes earlier", () => {
    for (const m of MODULE_DEFINITIONS) {
      for (const r of m.requires) assert.ok((getModuleDefinition(r)?.sortOrder ?? 99) < m.sortOrder, `${m.moduleType} requires ${r}`);
    }
  });
});

describe("approval flow", () => {
  it("marking Completed asks the approver team (also after a rejection)", () => {
    assert.deepEqual(approvalAfterSave({ status: "IN_PROGRESS", approvalStatus: "REJECTED" }, "COMPLETED"), { approvalStatus: "PENDING", submitted: true, autoApproved: false });
    assert.deepEqual(approvalAfterSave({ status: "IN_PROGRESS", approvalStatus: "REJECTED" }, "IN_PROGRESS"), { approvalStatus: "REJECTED", submitted: false, autoApproved: false });
  });
  it("a step without an approver turns green when its team marks it Completed", () => {
    assert.deepEqual(approvalAfterSave({ status: "IN_PROGRESS", approvalStatus: "PENDING" }, "COMPLETED", false), { approvalStatus: "APPROVED", submitted: true, autoApproved: true });
  });
  it("only Completed + Pending steps can be decided", () => {
    assert.equal(canBeApproved({ status: "COMPLETED", approvalStatus: "PENDING" }), true);
    assert.equal(canBeApproved({ status: "IN_PROGRESS", approvalStatus: "PENDING" }), false);
    assert.equal(canBeApproved({ status: "COMPLETED", approvalStatus: "APPROVED" }), false);
  });
});

describe("detailsSchema (config-driven validation)", () => {
  const interiors = detailsSchema(getModuleDefinition("INTERIORS")!.fields);
  const loc = detailsSchema(getModuleDefinition("LOCATION_FILING")!.fields);
  it("accepts valid values, points as booleans, and strips unknown keys", () => {
    const r = interiors.parse({ vendorQuotation: true, poNumber: "PO-1", acUnits: 3, hacker: "x" });
    assert.deepEqual(r, { vendorQuotation: true, poNumber: "PO-1", acUnits: 3 });
  });
  it("rejects values outside the configured ranges", () => {
    assert.equal(interiors.safeParse({ acUnits: -1 }).success, false);
    assert.equal(interiors.safeParse({ vendorQuotation: "yes" }).success, false);
    assert.equal(loc.safeParse({ footfallRating: 6 }).success, false);
    assert.equal(loc.safeParse({ yearlyEscalationPct: 5, locationIdentification: true }).success, true);
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
