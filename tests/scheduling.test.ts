import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, formatDateOnly, parseDateOnly, todayInIndia } from "../src/lib/dates";
import { defaultTargetLaunch, planModulesFromHandover } from "../src/lib/scheduling";
import { MODULE_DEFINITIONS, SETUP_TRACK_TYPES } from "../src/modules";

describe("planModulesFromHandover (department tracks scheduled from Day 0)", () => {
  const handover = parseDateOnly("2026-12-01");
  const plan = planModulesFromHandover(handover, MODULE_DEFINITIONS);
  const byType = Object.fromEntries(plan.map((p) => [p.moduleType, p]));

  it("schedules exactly the eight step-6 department tracks", () => {
    assert.deepEqual(plan.map((p) => p.moduleType).sort(), [...SETUP_TRACK_TYPES].sort());
    assert.equal(plan.length, 8);
  });

  it("uses each track's default offset and duration (planned end = start + duration)", () => {
    const expect = {
      MARKETING: ["2026-12-01", "2026-12-26"],
      INTERIORS: ["2026-12-01", "2026-12-22"],
      BRAND_PROMOTERS: ["2026-12-15", "2026-12-29"],
      STOCKS: ["2026-12-22", "2026-12-29"],
    };
    for (const [type, [start, end]] of Object.entries(expect)) {
      assert.equal(formatDateOnly(byType[type].plannedStart), start, `${type} start`);
      assert.equal(formatDateOnly(byType[type].plannedEnd), end, `${type} end`);
    }
  });

  it("every track ends before the default target launch (Day 30)", () => {
    for (const p of plan) assert.ok(p.plannedEnd < defaultTargetLaunch(handover), p.moduleType);
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
