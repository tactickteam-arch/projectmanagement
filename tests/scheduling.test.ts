import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, formatDateOnly, parseDateOnly, todayInIndia } from "../src/lib/dates";
import { defaultTargetLaunch, planModulesFromHandover } from "../src/lib/scheduling";
import { MODULE_DEFINITIONS } from "../src/modules";

describe("planModulesFromHandover (spec: auto-scheduling on key handover)", () => {
  const handover = parseDateOnly("2026-12-01");
  const plan = planModulesFromHandover(handover, MODULE_DEFINITIONS);
  const byType = Object.fromEntries(plan.map((p) => [p.moduleType, p]));

  it("schedules exactly the five fit-out modules", () => {
    assert.deepEqual(
      plan.map((p) => p.moduleType).sort(),
      ["AIR_CONDITIONING", "ELECTRICAL_IT_WIRING", "EXTERNAL_SIGNAGE", "INSHOP_BRANDING", "IT_WORKS"],
    );
  });

  it("uses the spec placeholder offsets and durations", () => {
    const expect = {
      ELECTRICAL_IT_WIRING: ["2026-12-01", "2026-12-11"],
      EXTERNAL_SIGNAGE: ["2026-12-04", "2026-12-11"],
      AIR_CONDITIONING: ["2026-12-08", "2026-12-13"],
      IT_WORKS: ["2026-12-11", "2026-12-18"],
      INSHOP_BRANDING: ["2026-12-16", "2026-12-23"],
    };
    for (const [type, [start, end]] of Object.entries(expect)) {
      assert.equal(formatDateOnly(byType[type].plannedStart), start, `${type} start`);
      assert.equal(formatDateOnly(byType[type].plannedEnd), end, `${type} end`);
    }
  });

  it("target launch defaults to handover + 30 days", () => {
    assert.equal(formatDateOnly(defaultTargetLaunch(handover)), "2026-12-31");
  });
});

describe("date helpers", () => {
  it("rejects impossible dates", () => {
    assert.throws(() => parseDateOnly("2026-02-30"));
    assert.throws(() => parseDateOnly("11/11/2026"));
  });

  it("adds and counts whole days across month ends", () => {
    assert.equal(formatDateOnly(addDays(parseDateOnly("2026-12-25"), 10)), "2027-01-04");
    assert.equal(daysBetween(parseDateOnly("2026-11-01"), parseDateOnly("2026-11-11")), 10);
  });

  it("todayInIndia rolls over at IST midnight, not UTC midnight", () => {
    // 2026-11-11 19:00 UTC = 2026-11-12 00:30 IST
    assert.equal(formatDateOnly(todayInIndia(new Date("2026-11-11T19:00:00Z"))), "2026-11-12");
    assert.equal(formatDateOnly(todayInIndia(new Date("2026-11-11T18:00:00Z"))), "2026-11-11");
  });
});
