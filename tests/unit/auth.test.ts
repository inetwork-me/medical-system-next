import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { readSignInReply, resendCode, signIn, signOut, verifyTwoFactor, chooseBranch } from "../../src/lib/api/auth.ts"
import { ApiError, type ApiErrorCode } from "../../src/lib/api/errors.ts"
import { resendProblem, verifyProblem } from "../../src/lib/auth-code.ts"
import { safeNext } from "../../src/lib/safe-next.ts"

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

type Seen = { url: string; body: unknown }
function stub(status: number, body: unknown, headers: Record<string, string> = {}): Seen[] {
  const seen: Seen[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
  }) as typeof fetch
  return seen
}

const user = { id: 1, name: "Test", email: "t@example.sa", roles: ["admin"], permissions: [] }
const tenant = { id: "demo", name: "Demo", subdomain: "demo", enabled_modules: [] }
const branch = { id: 3, code: "MAIN", name_en: "Main", name_ar: "الرئيسي" }

describe("readSignInReply", () => {
  it("reads the three 200 replies", () => {
    assert.deepEqual(
      readSignInReply({ two_factor_required: true, two_factor_method: "email", temp_token: "t1", code_sent_to: "kh***@clinic.sa", tries_left: 3, resend_in: 45 }),
      { kind: "two_factor", tempToken: "t1", method: "email", codeSentTo: "kh***@clinic.sa", triesLeft: 3, resendIn: 45 },
    )
    assert.deepEqual(readSignInReply({ branch_required: true, branches: [branch], branch_temp_token: "b1" }), { kind: "branch", branches: [branch], branchTempToken: "b1" })
    assert.equal(readSignInReply({ user, tenant, branch }).kind, "signed_in")
  })

  it("refuses a reply it does not know", () => {
    assert.throws(() => readSignInReply({}))
    assert.throws(() => readSignInReply({ two_factor_required: true }))
  })
})

describe("sign-in calls", () => {
  it("sends the identifier, the password and keep_signed_in, and nothing else", async () => {
    const seen = stub(200, { user, tenant, branch })
    const r = await signIn("a@b.sa", "pw", true)
    assert.equal(r.kind, "signed_in")
    assert.equal(seen[0].url, "/api/login")
    assert.deepEqual(seen[0].body, { identifier: "a@b.sa", password: "pw", keep_signed_in: true })
  })

  it("keeps the numbers of a wrong password and of a lock", async () => {
    stub(401, { code: "invalid_credentials", attempts_left: 2 })
    await assert.rejects(() => signIn("a@b.sa", "x", false), (e: unknown) => e instanceof ApiError && e.code === "invalid_credentials" && e.attemptsLeft === 2)
    stub(423, { code: "locked", retry_after: 900 }, { "Retry-After": "900" })
    await assert.rejects(() => signIn("a@b.sa", "x", false), (e: unknown) => e instanceof ApiError && e.code === "locked" && e.retryAfter === 900)
    stub(429, { code: "too_many_requests", retry_after: 30 })
    await assert.rejects(() => signIn("a@b.sa", "x", false), (e: unknown) => e instanceof ApiError && e.code === "too_many_requests" && e.retryAfter === 30)
  })

  it("a sign-in error never redirects (public client)", async () => {
    stub(401, { code: "invalid_credentials", attempts_left: 1 })
    await assert.rejects(() => signIn("a@b.sa", "x", false))
  })

  it("posts the temp token with the code, and the branch token with the branch", async () => {
    let seen = stub(200, { user, tenant, branch })
    await verifyTwoFactor("t1", "123456")
    assert.deepEqual([seen[0].url, seen[0].body], ["/api/login/2fa", { temp_token: "t1", code: "123456" }])
    seen = stub(200, { user, tenant, branch })
    await chooseBranch("b1", 3)
    assert.deepEqual([seen[0].url, seen[0].body], ["/api/login/branch", { branch_temp_token: "b1", branch_id: 3 }])
  })

  it("logs out with a POST", async () => {
    const seen = stub(200, { message: "Logged out successfully" })
    await signOut()
    assert.equal(seen[0].url, "/api/logout")
  })
})

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    assert.equal(safeNext("/patients?page=2"), "/patients?page=2")
    assert.equal(safeNext("/settings/users"), "/settings/users")
  })

  it("drops anything else", () => {
    for (const v of ["//evil.example", "https://evil.example", "/\\evil.example", "evil", "", null, undefined, "/login", "/login/verify?x=1", "/logout"]) {
      assert.equal(safeNext(v), null, String(v))
    }
  })
})

describe("the code step (AUTH-02)", () => {
  it("keeps the tries the API sends on a wrong code, and does not count itself", async () => {
    const seen = stub(422, { code: "invalid_code", tries_left: 2 })
    await assert.rejects(() => verifyTwoFactor("t1", "123456"), (e: unknown) => e instanceof ApiError && e.code === "invalid_code" && e.triesLeft === 2)
    assert.equal(seen[0].url, "/api/login/2fa")
    assert.deepEqual(seen[0].body, { temp_token: "t1", code: "123456" })
  })

  it("reads the stable codes of the code step", async () => {
    stub(422, { code: "code_tries_exhausted", tries_left: 0 })
    await assert.rejects(() => verifyTwoFactor("t1", "1"), (e: unknown) => e instanceof ApiError && e.code === "code_tries_exhausted")
    stub(401, { code: "step_expired" })
    await assert.rejects(() => verifyTwoFactor("t1", "1"), (e: unknown) => e instanceof ApiError && e.code === "step_expired")
  })

  it("resend posts the temp token and reads where the code went, the tries and the wait", async () => {
    const seen = stub(200, { code_sent_to: "kh***@clinic.sa", tries_left: 3, resend_in: 45 })
    assert.deepEqual(await resendCode("t1"), { codeSentTo: "kh***@clinic.sa", triesLeft: 3, resendIn: 45 })
    assert.equal(seen[0].url, "/api/login/2fa/resend")
    assert.deepEqual(seen[0].body, { temp_token: "t1" })
  })

  it("a resend inside the wait carries the seconds to wait", async () => {
    stub(429, { code: "resend_wait", retry_after: 30 }, { "Retry-After": "30" })
    await assert.rejects(() => resendCode("t1"), (e: unknown) => e instanceof ApiError && e.code === "resend_wait" && e.retryAfter === 30)
  })
})

describe("what the code page does with an error", () => {
  const err = (status: number, code: ApiErrorCode, extra = {}) => new ApiError(status, code, extra)

  it("verify: tries come from the API", () => {
    assert.deepEqual(verifyProblem(err(422, "invalid_code", { triesLeft: 1 })), { kind: "wrong", triesLeft: 1 })
    assert.deepEqual(verifyProblem(err(422, "code_tries_exhausted")), { kind: "over" })
    assert.deepEqual(verifyProblem(err(401, "step_expired")), { kind: "expired" })
    assert.deepEqual(verifyProblem(err(429, "too_many_requests", { retryAfter: 20 })), { kind: "tooMany", seconds: 20 })
    assert.deepEqual(verifyProblem(err(0, "network")), { kind: "network" })
    assert.deepEqual(verifyProblem(new Error("x")), { kind: "network" })
  })

  it("resend: the wait is the server's", () => {
    assert.deepEqual(resendProblem(err(429, "resend_wait", { retryAfter: 12 })), { kind: "wait", seconds: 12 })
    assert.deepEqual(resendProblem(err(401, "step_expired")), { kind: "expired" })
    assert.deepEqual(resendProblem(err(503, "send_failed")), { kind: "failed" })
    assert.deepEqual(resendProblem(err(422, "resend_unavailable")), { kind: "failed" })
    assert.deepEqual(resendProblem(err(0, "network")), { kind: "network" })
  })
})
