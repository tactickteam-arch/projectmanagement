import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canViewStore, storeScope } from "../src/lib/auth/access";
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

describe("module definitions (spec: 8 modules, photo minimums)", () => {
  it("has 8 modules with unique types and orders", () => {
    assert.equal(MODULE_DEFINITIONS.length, 8);
    assert.equal(new Set(MODULE_DEFINITIONS.map((m) => m.moduleType)).size, 8);
    assert.equal(new Set(MODULE_DEFINITIONS.map((m) => m.sortOrder)).size, 8);
  });

  it("photo minimums: 2 for Key Handover, 4 for In-shop Branding, 1 otherwise", () => {
    for (const m of MODULE_DEFINITIONS) {
      const expected = m.moduleType === "KEY_HANDOVER" ? 2 : m.moduleType === "INSHOP_BRANDING" ? 4 : 1;
      assert.equal(m.minPhotos, expected, m.moduleType);
    }
  });

  it("field keys are unique within each module", () => {
    for (const m of MODULE_DEFINITIONS) {
      const keys = m.fields.map((f) => f.key);
      assert.equal(new Set(keys).size, keys.length, m.moduleType);
    }
  });
});
