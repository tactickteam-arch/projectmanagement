import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, formatDateOnly, parseDateOnly, todayInIndia } from "../src/lib/dates";
import { defaultExpectedKey, defaultTargetLaunch, planFrom, planModulesFromHandover, rolloutTarget } from "../src/lib/scheduling";
import { MODULE_DEFINITIONS, SETUP_TRACK_TYPES, SITE_TYPES } from "../src/modules";

const ymd = formatDateOnly;

describe("13-week rollout (slide 10)", () => {
  const created = parseDateOnly("2026-11-02"); // week 1
  const plan = Object.fromEntries(planFrom("created", created, MODULE_DEFINITIONS).map((p) => [p.moduleType, p]));

  it("plans the gate steps from the store record: 1 in W1–3, 2 in W4–5, 3 in W5–6, quotation W1–2", () => {
    assert.equal(ymd(plan.LOCATION_FILING.plannedStart), "2026-11-02");
    assert.equal(ymd(plan.LOCATION_FILING.plannedEnd), "2026-11-23");
    assert.equal(ymd(plan.LANDLORD_CHECK.plannedStart), "2026-11-23");
    assert.equal(ymd(plan.TOKEN_ADVANCE.plannedStart), "2026-11-30");
    assert.equal(ymd(plan.INTERIORS_QUOTE.plannedEnd), "2026-11-16");
  });

  it("keys expected in week 8 and the soft launch in week 13 until the MOU sheet gives a date", () => {
    assert.equal(daysBetween(created, defaultExpectedKey(created)), 49);
    assert.equal(daysBetween(created, rolloutTarget(created)), 91);
  });

  it("T-7 work is planned back from the expected key date and ends a week before it", () => {
    const keys = parseDateOnly("2026-12-21");
    const pre = Object.fromEntries(planFrom("expectedKey", keys, MODULE_DEFINITIONS).map((p) => [p.moduleType, p]));
    assert.deepEqual(Object.keys(pre).sort(), ["KEY_HANDOVER", "MATERIAL_ORDERING", "SIGN_BOARD"]);
    assert.equal(ymd(pre.SIGN_BOARD.plannedEnd), "2026-12-14");
    assert.equal(ymd(pre.MATERIAL_ORDERING.plannedEnd), "2026-12-14");
    assert.equal(ymd(pre.KEY_HANDOVER.plannedEnd), "2026-12-21");
  });
});

describe("planModulesFromHandover (Day 0 = keys accepted)", () => {
  const handover = parseDateOnly("2026-12-01");
  const plan = planModulesFromHandover(handover, MODULE_DEFINITIONS);
  const byType = Object.fromEntries(plan.map((p) => [p.moduleType, p]));

  it("schedules the on-site work, the eight department tracks and the soft launch", () => {
    assert.deepEqual(plan.map((p) => p.moduleType).sort(), [...SITE_TYPES, ...SETUP_TRACK_TYPES, "SOFT_LAUNCH"].sort());
  });

  it("on-site work runs one week each: furniture, electrical, AC, branding", () => {
    assert.equal(ymd(byType.SITE_FURNITURE.plannedStart), "2026-12-01");
    assert.equal(ymd(byType.SITE_ELECTRICAL.plannedStart), "2026-12-08");
    assert.equal(ymd(byType.SITE_AC.plannedStart), "2026-12-15");
    assert.equal(ymd(byType.SITE_BRANDING.plannedEnd), "2026-12-29");
  });

  it("every step ends by the default soft launch (keys + 5 weeks)", () => {
    const target = defaultTargetLaunch(handover);
    assert.equal(ymd(target), "2027-01-05");
    for (const p of plan) assert.ok(p.plannedEnd <= target, p.moduleType);
    assert.equal(ymd(byType.SOFT_LAUNCH.plannedStart), "2027-01-05");
  });
});

describe("date helpers", () => {
  it("rejects impossible dates", () => {
    assert.throws(() => parseDateOnly("2026-02-30"));
    assert.throws(() => parseDateOnly("11/11/2026"));
  });

  it("adds and counts whole days across month ends", () => {
    assert.equal(ymd(addDays(parseDateOnly("2026-12-25"), 10)), "2027-01-04");
    assert.equal(daysBetween(parseDateOnly("2026-11-01"), parseDateOnly("2026-11-11")), 10);
  });

  it("todayInIndia rolls over at IST midnight, not UTC midnight", () => {
    assert.equal(ymd(todayInIndia(new Date("2026-11-11T19:00:00Z"))), "2026-11-12");
    assert.equal(ymd(todayInIndia(new Date("2026-11-11T18:00:00Z"))), "2026-11-11");
  });
});
