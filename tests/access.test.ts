import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canViewStore, storeScope } from "../src/lib/auth/access";
import { can } from "../src/lib/auth/permissions";
import { isTeamKey } from "../src/lib/teams";
import { MODULE_DEFINITIONS } from "../src/modules";

const kaStore = { ownerId: "owner-1", state: "KA" };

describe("store access (spec: Users and roles)", () => {
  it("SuperAdmin sees all stores", () => {
    const u = { id: "hq", role: "SUPER_ADMIN" as const, regionStates: [] };
    assert.deepEqual(storeScope(u), {});
    assert.equal(canViewStore(u, kaStore), true);
  });

  it("Regional Manager sees only stores in assigned states", () => {
    const u = { id: "rm", role: "REGIONAL_MANAGER" as const, regionStates: ["KA", "KL"] };
    assert.deepEqual(storeScope(u), { state: { in: ["KA", "KL"] } });
    assert.equal(canViewStore(u, kaStore), true);
    assert.equal(canViewStore(u, { ownerId: "owner-1", state: "TN" }), false);
  });

  it("Regional Manager with no states sees nothing", () => {
    const u = { id: "rm", role: "REGIONAL_MANAGER" as const, regionStates: [] };
    assert.equal(canViewStore(u, kaStore), false);
  });

  it("Store Owner sees only their own stores", () => {
    const u = { id: "owner-1", role: "STORE_OWNER" as const, regionStates: ["KA"] };
    assert.deepEqual(storeScope(u), { ownerId: "owner-1" });
    assert.equal(canViewStore(u, kaStore), true);
    assert.equal(canViewStore({ ...u, id: "owner-2" }, kaStore), false);
  });
});

describe("Sangeetha team members", () => {
  it("see all stores without states, or only their states", () => {
    const all = { id: "t", role: "TEAM_MEMBER" as const, regionStates: [], teams: ["ACCOUNTS"] };
    assert.deepEqual(storeScope(all), {});
    assert.equal(canViewStore(all, kaStore), true);
    const ka = { ...all, regionStates: ["KA"] };
    assert.equal(canViewStore(ka, kaStore), true);
    assert.equal(canViewStore(ka, { ownerId: "owner-1", state: "TN" }), false);
  });
});

describe("step permissions (who fills in / approves)", () => {
  const owner = { id: "owner-1", role: "STORE_OWNER" as const, regionStates: [] };
  const hq = { id: "hq", role: "SUPER_ADMIN" as const, regionStates: [] };
  const accounts = { id: "a", role: "TEAM_MEMBER" as const, regionStates: [], teams: ["ACCOUNTS"] };
  const rk = { id: "rk", role: "TEAM_MEMBER" as const, regionStates: [], teams: ["RK"] };
  const step = (moduleType: string) => {
    const d = MODULE_DEFINITIONS.find((m) => m.moduleType === moduleType)!;
    return { editTeams: d.editTeams, approverTeam: d.approverTeam };
  };

  it("store owner fills in Location filing and Key received for their own store only", () => {
    assert.equal(can.editModule(owner, kaStore, step("LOCATION_FILING")), true);
    assert.equal(can.editModule(owner, kaStore, step("KEY_HANDOVER")), true);
    assert.equal(can.editModule(owner, kaStore, step("LANDLORD_CHECK")), false);
    assert.equal(can.editModule({ ...owner, id: "owner-2" }, kaStore, step("LOCATION_FILING")), false);
  });

  it("Accounts manages the landlord check and token advance; RK approves the landlord check and handover", () => {
    assert.equal(can.editModule(accounts, kaStore, step("LANDLORD_CHECK")), true);
    assert.equal(can.editModule(accounts, kaStore, step("MARKETING")), false);
    assert.equal(can.approveModule(accounts, kaStore, step("TOKEN_ADVANCE")), true);
    assert.equal(can.approveModule(accounts, kaStore, step("LANDLORD_CHECK")), false);
    assert.equal(can.approveModule(rk, kaStore, step("LANDLORD_CHECK")), true);
    assert.equal(can.approveModule(rk, kaStore, step("KEY_HANDOVER")), true);
    assert.equal(can.approveModule(owner, kaStore, step("LOCATION_FILING")), false);
  });

  it("steps without an approver cannot be approved by a team; HQ can do everything", () => {
    assert.equal(can.approveModule(accounts, kaStore, step("MARKETING")), false);
    assert.equal(can.editModule(hq, kaStore, step("MARKETING")), true);
    assert.equal(can.approveModule(hq, kaStore, step("LOCATION_FILING")), true);
  });
});

describe("launch-flow step definitions", () => {
  it("has 21 SOP steps (gates, legal, pre-key, on-site, 8 department tracks, soft launch) with unique types and orders", () => {
    assert.equal(MODULE_DEFINITIONS.length, 21);
    assert.equal(new Set(MODULE_DEFINITIONS.map((m) => m.moduleType)).size, 21);
    assert.equal(new Set(MODULE_DEFINITIONS.map((m) => m.sortOrder)).size, 21);
    assert.equal(MODULE_DEFINITIONS.filter((m) => m.group === "track").length, 8);
    assert.equal(MODULE_DEFINITIONS.filter((m) => m.group === "site").length, 4);
  });

  it("approvers follow the SOP: Boss + CEO, RK, Accounts, none for Legal, RK; departments mark green", () => {
    const approvers = Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.moduleType, m.approverTeam]));
    assert.equal(approvers.LOCATION_FILING, "LEADERSHIP");
    assert.equal(approvers.LANDLORD_CHECK, "RK");
    assert.equal(approvers.TOKEN_ADVANCE, "ACCOUNTS");
    assert.equal(approvers.LEGAL_STATUTORY, null);
    assert.equal(approvers.KEY_HANDOVER, "RK");
    assert.equal(approvers.INTERIORS_QUOTE, "LEADERSHIP");
    assert.equal(approvers.SOFT_LAUNCH, null);
    for (const m of MODULE_DEFINITIONS.filter((x) => x.group === "track" || x.group === "site")) assert.equal(m.approverTeam, null, m.moduleType);
  });

  it("every team used by a step exists", () => {
    for (const m of MODULE_DEFINITIONS) {
      for (const t of [...m.editTeams, ...(m.approverTeam ? [m.approverTeam] : [])]) assert.ok(t === "STORE_OWNER" || isTeamKey(t), `${m.moduleType}: ${t}`);
    }
  });

  it("field keys are unique within each step", () => {
    for (const m of MODULE_DEFINITIONS) {
      const keys = m.fields.map((f) => f.key);
      assert.equal(new Set(keys).size, keys.length, m.moduleType);
    }
  });
});
