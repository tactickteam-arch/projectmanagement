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
// A done token advance also has HO's payment record (the gate).
const state = (moduleType: string, done: boolean) => ({
  moduleType,
  status: done ? ("COMPLETED" as const) : ("NOT_STARTED" as const),
  approvalStatus: done ? ("APPROVED" as const) : ("PENDING" as const),
  details: done && moduleType === "TOKEN_ADVANCE" ? { payment: { paidAmount: 1 } } : {},
});

describe("checkModuleRules (spec validation + flow order)", () => {
  it("cannot mark Completed without the minimum photos (when a step asks for them)", () => {
    assert.ok(checkModuleRules(base({ photoCount: 0 }, { status: "COMPLETED" })).photos);
    assert.equal(checkModuleRules(base({ photoCount: 0, minPhotos: 0 }, { status: "COMPLETED" })).photos, undefined);
  });

  it("the SOP asks for no photo minimums; photos are optional uploads", () => {
    for (const m of MODULE_DEFINITIONS) assert.equal(m.minPhotos, 0, m.moduleType);
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
    const e = checkModuleRules(base({ moduleType: "KEY_HANDOVER", minPhotos: 0, fields: def.fields, details: {} }, { status: "COMPLETED" }));
    assert.ok(e.tasks);
    assert.ok(e["details.handoverDate"]);
    assert.ok(e["details.keysReceivedBy"]);
    assert.ok(e.required);
  });

  it("SOP check problems block completion", () => {
    assert.ok(checkModuleRules(base({ minPhotos: 0, sopProblems: ["single phase"] }, { status: "COMPLETED" })).sop);
    assert.equal(checkModuleRules(base({ minPhotos: 0, sopProblems: ["single phase"] }, { status: "IN_PROGRESS" })).sop, undefined);
  });

  it("pre-key steps need the actual end date (for the T-7 rule)", () => {
    assert.ok(checkModuleRules(base({ minPhotos: 0, requireActualEnd: true }, { status: "COMPLETED" })).actualEnd);
  });

  it("a track cannot be completed before the steps it covers (Interiors covers on-site work)", () => {
    assert.match(checkModuleRules(base({ minPhotos: 0, missingBeforeComplete: ["AC installation"] }, { status: "COMPLETED" })).status ?? "", /AC installation/);
  });
});

describe("completionErrors", () => {
  const landlord = getModuleDefinition("LANDLORD_CHECK")!;
  const allTicked = Object.fromEntries(landlord.fields.filter((f) => f.type === "task").map((f) => [f.key, true]));
  const filled = { ...allTicked, powerSupply: "3-Phase", sanctionedLoadKw: 20, civilWorkDueDate: "2026-12-01" };
  it("all 8 landlord points must be ticked", () => {
    const e = completionErrors(landlord.fields, { ...filled, pt5MainLine: false }, ["landlord_confirmation"]);
    assert.ok(e.tasks);
  });
  it("required files must be uploaded", () => {
    assert.ok(completionErrors(landlord.fields, filled, [])["file.landlord_confirmation"]);
    assert.deepEqual(completionErrors(landlord.fields, filled, ["landlord_confirmation"]), {});
  });
  it("location filing: points 36 (MOU copy) and 37 (GST) are optional; 38/39 files are required", () => {
    const loc = getModuleDefinition("LOCATION_FILING")!;
    const e = completionErrors(loc.fields, {}, []);
    assert.ok(e["file.property_tax"]);
    assert.ok(e["file.building_plan"]);
    assert.equal(e["file.mou_copy"], undefined);
    assert.equal(e["details.gstNumber"], undefined);
    assert.ok(e["details.landlordPan"]);
  });
  it("hidden fields are not required", () => {
    const fields = [{ key: "notes", label: "Notes", type: "text" as const, required: true, showWhen: { key: "x", equals: "y" } }];
    assert.deepEqual(completionErrors(fields, {}), {});
  });
});

describe("flow order (missingPrerequisites)", () => {
  it("follows the SOP: 1 → 2 → 3 → (6·1, materials) → 5, 4 alongside, Stage 6 after keys, 7 after all tracks", () => {
    assert.deepEqual(missingPrerequisites("LOCATION_FILING", []), []);
    assert.deepEqual(missingPrerequisites("LANDLORD_CHECK", [state("LOCATION_FILING", false)]), ["LOCATION_FILING"]);
    assert.deepEqual(missingPrerequisites("LANDLORD_CHECK", [state("LOCATION_FILING", true)]), []);
    assert.deepEqual(missingPrerequisites("TOKEN_ADVANCE", [state("LANDLORD_CHECK", true)]), []);
    assert.deepEqual(missingPrerequisites("LEGAL_STATUTORY", [state("LANDLORD_CHECK", true), state("TOKEN_ADVANCE", false)]), []);
    assert.deepEqual(missingPrerequisites("KEY_HANDOVER", [state("TOKEN_ADVANCE", false)]), ["TOKEN_ADVANCE"]);
    assert.deepEqual(missingPrerequisites("INTERIORS_QUOTE", []), []);
    assert.deepEqual(missingPrerequisites("SIGN_BOARD", [state("TOKEN_ADVANCE", true)]), []);
    assert.deepEqual(missingPrerequisites("MATERIAL_ORDERING", [state("TOKEN_ADVANCE", true), state("INTERIORS_QUOTE", false)]), ["INTERIORS_QUOTE"]);
    assert.equal(missingPrerequisites("SOFT_LAUNCH", []).length, 8);
    for (const t of ["MARKETING", "INTERIORS", "HR", "LAUNCH_PLANNING"]) {
      assert.deepEqual(missingPrerequisites(t, [state("KEY_HANDOVER", false)]), ["KEY_HANDOVER"], t);
      assert.deepEqual(missingPrerequisites(t, [state("KEY_HANDOVER", true)]), [], t);
    }
  });
  it("an approved token advance does not unlock the next steps until HO records the payment", () => {
    assert.deepEqual(missingPrerequisites("KEY_HANDOVER", [{ moduleType: "TOKEN_ADVANCE", status: "COMPLETED", approvalStatus: "APPROVED", details: {} }]), ["TOKEN_ADVANCE"]);
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
  const loc = detailsSchema(getModuleDefinition("LOCATION_FILING")!.fields);
  const ac = detailsSchema(getModuleDefinition("SITE_AC")!.fields);
  it("accepts valid values, points as booleans, and strips unknown keys", () => {
    assert.deepEqual(ac.parse({ acCable: true, acUnits: 3, hacker: "x" }), { acCable: true, acUnits: 3 });
  });
  it("rejects values outside the configured ranges", () => {
    assert.equal(ac.safeParse({ acUnits: -1 }).success, false);
    assert.equal(ac.safeParse({ acCable: "yes" }).success, false);
  });
  it("checks PAN, IFSC, account number, e-mail and phone formats", () => {
    assert.equal(loc.safeParse({ landlordPan: "abcde1234f" }).success, true);
    assert.equal(loc.parse({ landlordPan: "abcde1234f" }).landlordPan, "ABCDE1234F");
    assert.equal(loc.safeParse({ landlordPan: "ABC123" }).success, false);
    assert.equal(loc.safeParse({ ifsc: "HDFC0001234" }).success, true);
    assert.equal(loc.safeParse({ ifsc: "HDFC1234" }).success, false);
    assert.equal(loc.safeParse({ bankAccount: "12345" }).success, false);
    assert.equal(loc.safeParse({ landlordEmail: "not-an-email" }).success, false);
    assert.equal(loc.safeParse({ landlordPhone1: "98765" }).success, false);
  });
  it("stores only the last 4 Aadhaar digits", () => {
    assert.equal(loc.parse({ landlordAadhaar: "1234 5678 9012" }).landlordAadhaar, "XXXX XXXX 9012");
    assert.equal(loc.safeParse({ landlordAadhaar: "1234" }).success, false);
  });
  it("store-sourced points (branch name, code, state, address, size) are not saved in the details", () => {
    assert.deepEqual(loc.parse({ branchName: "x", size: 5 }), {});
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
