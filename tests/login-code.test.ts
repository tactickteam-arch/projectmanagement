import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLoginCode, CODE_MAX_ATTEMPTS, hashLoginCode, loginMode, newLoginCode, passwordAllowedFor } from "../src/lib/auth/login-code";

describe("decision 21 Nov 2026: sign in with an e-mail code only", () => {
  const secret = "test-secret";
  const state = (code: string, user = "u1", mins = 10, attempts = 0) => ({
    loginCodeHash: hashLoginCode(code, user, secret),
    loginCodeExpiresAt: new Date(Date.now() + mins * 60_000),
    loginCodeAttempts: attempts,
  });

  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) assert.match(newLoginCode(), /^\d{6}$/);
  });
  it("accepts the right code for the right user only", () => {
    assert.equal(checkLoginCode(state("123456"), "123456", "u1", secret), "ok");
    assert.equal(checkLoginCode(state("123456"), "123457", "u1", secret), "wrong");
    assert.equal(checkLoginCode(state("123456", "u2"), "123456", "u1", secret), "wrong", "code of another account");
    assert.equal(checkLoginCode(state("123456"), "12345a", "u1", secret), "wrong");
  });
  it("expires after 10 minutes and locks after 5 tries", () => {
    assert.equal(checkLoginCode(state("123456", "u1", -1), "123456", "u1", secret), "expired");
    assert.equal(checkLoginCode(state("123456", "u1", 10, CODE_MAX_ATTEMPTS), "123456", "u1", secret), "locked");
    assert.equal(checkLoginCode({ loginCodeHash: null, loginCodeExpiresAt: null, loginCodeAttempts: 0 }, "123456", "u1", secret), "none");
  });
  it("switches to code-only once e-mail sending is set up; demo accounts keep passwords only when allowed", () => {
    assert.equal(loginMode({}), "password");
    assert.equal(loginMode({ EMAIL_FROM: "a@b.com", RESEND_API_KEY: "k" }), "code");
    assert.equal(loginMode({ LOGIN_MODE: "code" }), "code");
    const live = { EMAIL_FROM: "a@b.com", RESEND_API_KEY: "k" };
    assert.equal(passwordAllowedFor("manjunath.j@sangeetha.com", live), false);
    assert.equal(passwordAllowedFor("rk@sangeetha.test", live), false);
    assert.equal(passwordAllowedFor("rk@sangeetha.test", { ...live, DEMO_PASSWORD_LOGIN: "1" }), true);
    assert.equal(passwordAllowedFor("manjunath.j@sangeetha.com", { ...live, DEMO_PASSWORD_LOGIN: "1" }), false);
    assert.equal(passwordAllowedFor("anyone@sangeetha.com", {}), true);
  });
});
