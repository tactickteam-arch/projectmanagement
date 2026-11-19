import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AC_CASSETTE, AC_SPLIT, acProblems, acRequirement, maskAadhaar, powerLoadProblems, preKeyProblems, requiredLoadKw, SINGLE_PHASE, THREE_PHASE } from "../src/lib/sop-rules";

describe("slide 4: 3-phase power load by store size", () => {
  it("follows the kW table", () => {
    assert.equal(requiredLoadKw(400).kw, 7.5);
    assert.equal(requiredLoadKw(500).kw, 7.5);
    assert.equal(requiredLoadKw(501).kw, 15);
    assert.equal(requiredLoadKw(1000).kw, 15);
    assert.equal(requiredLoadKw(1500).kw, 20);
    assert.equal(requiredLoadKw(2000).kw, 25);
    assert.equal(requiredLoadKw(3000).kw, 30);
    assert.deepEqual(requiredLoadKw(3500), { kw: 30, beyondTable: true });
  });
  it("rejects single phase and too little load", () => {
    assert.equal(powerLoadProblems(1200, THREE_PHASE, 20).length, 0);
    assert.equal(powerLoadProblems(1200, THREE_PHASE, 15).length, 1);
    assert.match(powerLoadProblems(1200, SINGLE_PHASE, 20)[0], /3-phase/);
    assert.equal(powerLoadProblems(null, THREE_PHASE, 20).length, 1);
  });
});

describe("slide 8: AC sizing", () => {
  it("split below 1,000 sq ft, cassette from 1,000; 1 ton per 150 sq ft rounded up", () => {
    assert.deepEqual(acRequirement(900), { type: AC_SPLIT, minTons: 6 });
    assert.deepEqual(acRequirement(1000), { type: AC_CASSETTE, minTons: 7 });
    assert.deepEqual(acRequirement(1500), { type: AC_CASSETTE, minTons: 10 });
  });
  it("flags the wrong type or too few tons", () => {
    assert.equal(acProblems(1500, AC_CASSETTE, 10).length, 0);
    assert.equal(acProblems(1500, AC_SPLIT, 10).length, 1);
    assert.equal(acProblems(1500, AC_CASSETTE, 9).length, 1);
  });
});

describe("slide 6: T-7 rule", () => {
  const ok = { done: true, completedOn: "2026-12-01" };
  it("both pre-key steps done one week before the key handover", () => {
    assert.deepEqual(preKeyProblems("2026-12-08", ok, ok), []);
    assert.equal(preKeyProblems("2026-12-07", ok, ok).length, 2);
    assert.equal(preKeyProblems("2026-12-08", { done: false, completedOn: null }, ok).length, 1);
  });
});

describe("KYC", () => {
  it("keeps only the last 4 Aadhaar digits", () => {
    assert.equal(maskAadhaar("1234 5678 9012"), "XXXX XXXX 9012");
    assert.equal(maskAadhaar("XXXX XXXX 9012"), "XXXX XXXX 9012");
    assert.equal(maskAadhaar("12345"), null);
  });
});
