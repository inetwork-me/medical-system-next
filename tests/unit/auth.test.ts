import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { readSignInReply, signIn, signOut, verifyTwoFactor, chooseBranch } from "../../src/lib/api/auth.ts"
import { ApiError } from "../../src/lib/api/errors.ts"
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
    assert.deepEqual(readSignInReply({ two_factor_required: true, two_factor_method: "email", temp_token: "t1" }), { kind: "two_factor", tempToken: "t1", method: "email" })
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
