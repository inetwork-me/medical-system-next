import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { api, loginUrlFor, onSessionEnded, publicApi, setForbiddenHandler } from "../../src/lib/api/client.ts"
import { ApiError, apiErrorFrom } from "../../src/lib/api/errors.ts"

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  setForbiddenHandler(null)
})

type Seen = { url: string; init: RequestInit }
function stub(status: number, body: unknown, headers: Record<string, string> = {}): Seen[] {
  const seen: Seen[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init })
    return new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
  }) as typeof fetch
  return seen
}

describe("apiErrorFrom (matches the code, never the text)", () => {
  it("maps the sign-in codes", () => {
    const wrong = apiErrorFrom(401, { message: "anything", code: "invalid_credentials", attempts_left: 2 })
    assert.equal(wrong.code, "invalid_credentials")
    assert.equal(wrong.attemptsLeft, 2)
    const locked = apiErrorFrom(423, { code: "locked", retry_after: 900 })
    assert.equal(locked.code, "locked")
    assert.equal(locked.retryAfter, 900)
    assert.equal(apiErrorFrom(403, { code: "inactive" }).code, "inactive")
    assert.equal(apiErrorFrom(403, { code: "no_branch" }).code, "no_branch")
    assert.equal(apiErrorFrom(403, { code: "csrf_origin" }).code, "csrf_origin")
    assert.equal(apiErrorFrom(429, { code: "too_many_requests", retry_after: 30 }).retryAfter, 30)
  })

  it("ignores the English message", () => {
    const e = apiErrorFrom(401, { message: "Invalid credentials" })
    assert.equal(e.code, "unauthenticated")
    assert.equal(apiErrorFrom(403, { message: "Account inactive" }).code, "forbidden")
    assert.doesNotMatch(e.message, /Invalid credentials/)
  })

  it("falls back by status, and reads Retry-After when the body has none", () => {
    assert.equal(apiErrorFrom(429, {}, "45").code, "too_many_requests")
    assert.equal(apiErrorFrom(429, {}, "45").retryAfter, 45)
    assert.equal(apiErrorFrom(422, { errors: { identifier: ["x"] } }).code, "validation")
    assert.deepEqual(apiErrorFrom(422, { errors: { identifier: ["x"] } }).fieldErrors, { identifier: ["x"] })
    assert.equal(apiErrorFrom(404, {}).code, "not_found")
    assert.equal(apiErrorFrom(500, { code: "invalid_credentials" }).code, "invalid_credentials")
    assert.equal(apiErrorFrom(502, null).code, "server")
    assert.equal(apiErrorFrom(418, {}).code, "unknown")
  })

  it("does not trust an unknown code from the body", () => {
    assert.equal(apiErrorFrom(400, { code: "<script>" }).code, "unknown")
  })
})

describe("client", () => {
  it("sends same-origin cookie-mode requests and no Authorization header", async () => {
    const seen = stub(200, { ok: true })
    await api.post("/api/login", { a: 1 })
    assert.equal(seen[0].url, "/api/login")
    const h = seen[0].init.headers as Record<string, string>
    assert.equal(h["X-Auth-Mode"], "cookie")
    assert.equal(h["Authorization"], undefined)
    assert.equal(seen[0].init.credentials, "same-origin")
    assert.equal(seen[0].init.body, JSON.stringify({ a: 1 }))
  })

  it("only calls /api/ paths on the same origin", async () => {
    stub(200, {})
    await assert.rejects(() => api.get("https://evil.example/api/user"))
    await assert.rejects(() => api.get("/other"))
  })

  it("never keeps a token the API might send", async () => {
    stub(200, { user: { id: 1 }, token: "12|secret" })
    const body = await api.post<Record<string, unknown>>("/api/login", {})
    assert.equal("token" in body, false)
  })

  it("throws a typed error with the numbers the API sent", async () => {
    stub(401, { code: "invalid_credentials", attempts_left: 1 })
    await assert.rejects(
      () => publicApi.post("/api/login", {}),
      (e: unknown) => e instanceof ApiError && e.code === "invalid_credentials" && e.attemptsLeft === 1 && e.status === 401,
    )
  })

  it("maps a failed request to `network` and a non-JSON 5xx to `server`", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch
    await assert.rejects(() => api.get("/api/user"), (e: unknown) => e instanceof ApiError && e.code === "network")
    globalThis.fetch = (async () => new Response("<html>Bad gateway</html>", { status: 502 })) as typeof fetch
    await assert.rejects(() => api.get("/api/user"), (e: unknown) => e instanceof ApiError && e.code === "server")
  })

  it("on 401 clears the client state (signed-in calls only)", async () => {
    let ended = 0
    const off = onSessionEnded(() => ended++)
    stub(401, { code: "unauthenticated" })
    await assert.rejects(() => api.get("/api/user"))
    assert.equal(ended, 1)
    await assert.rejects(() => publicApi.post("/api/login", {}))
    assert.equal(ended, 1)
    off()
  })

  it("on 403 reloads the user once, not for a public call and not for /api/user itself", async () => {
    let reloads = 0
    setForbiddenHandler(async () => void reloads++)
    stub(403, { code: "forbidden" })
    await assert.rejects(() => api.get("/api/patients"))
    assert.equal(reloads, 1)
    await assert.rejects(() => api.get("/api/user"))
    await assert.rejects(() => publicApi.post("/api/login", {}))
    assert.equal(reloads, 1)
  })
})

describe("loginUrlFor", () => {
  it("keeps the language and where the user was going", () => {
    assert.equal(loginUrlFor("/en/patients", "?page=2"), "/en/login?next=" + encodeURIComponent("/patients?page=2"))
    assert.equal(loginUrlFor("/ar/dashboard"), "/ar/login?next=%2Fdashboard")
  })
  it("does not loop on the sign-in pages", () => {
    assert.equal(loginUrlFor("/en/login", "?next=%2Fx"), "/en/login")
    assert.equal(loginUrlFor("/ar/login/verify"), "/ar/login")
  })
})
