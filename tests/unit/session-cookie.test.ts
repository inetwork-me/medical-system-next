import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"

import { parseSessionCookie, verifySessionCookie } from "../../src/lib/api/session-cookie.ts"

const KEY = "unit-test-key-not-a-real-secret"
const NOW = 1_800_000_000
const token = "12|abcdefghijklmnopqrstuvwxyz0123456789"

const sign = (t: string, expiry: number | string, key = KEY) => createHmac("sha256", key).update(`${t}.${expiry}`).digest("hex")
const cookie = (t = token, expiry: number | string = NOW + 3600, key = KEY) => `${t}.${expiry}.${sign(t, expiry, key)}`

describe("verifySessionCookie", () => {
  it("accepts a valid, unexpired cookie", async () => {
    assert.equal(await verifySessionCookie(cookie(), KEY, NOW), true)
  })

  it("rejects a forged mac", async () => {
    const forged = `${token}.${NOW + 3600}.${"0".repeat(64)}`
    assert.equal(await verifySessionCookie(forged, KEY, NOW), false)
  })

  it("rejects a tampered expiry (extended life, same mac)", async () => {
    const good = cookie(token, NOW + 60)
    const tampered = good.replace(`.${NOW + 60}.`, `.${NOW + 999_999}.`)
    assert.notEqual(good, tampered)
    assert.equal(await verifySessionCookie(tampered, KEY, NOW), false)
  })

  it("rejects a tampered token", async () => {
    const good = cookie()
    assert.equal(await verifySessionCookie(good.replace("12|", "13|"), KEY, NOW), false)
  })

  it("rejects an expired cookie even with a good mac", async () => {
    assert.equal(await verifySessionCookie(cookie(token, NOW - 1), KEY, NOW), false)
    assert.equal(await verifySessionCookie(cookie(token, NOW), KEY, NOW), false)
  })

  it("rejects a cookie signed with another key", async () => {
    assert.equal(await verifySessionCookie(cookie(token, NOW + 3600, "another-key"), KEY, NOW), false)
  })

  it("fails closed when the key is missing or empty", async () => {
    assert.equal(await verifySessionCookie(cookie(), undefined, NOW), false)
    assert.equal(await verifySessionCookie(cookie(), "", NOW), false)
  })

  it("rejects the old mock cookie and other junk", async () => {
    for (const raw of ["1", "", undefined, null, "a.b", "a.b.c", "..", "...", `${token}.abc.${"a".repeat(64)}`, `${token}.${NOW + 10}.not-hex`, `${token}.${NOW + 10}.abc`]) {
      assert.equal(await verifySessionCookie(raw, KEY, NOW), false, String(raw))
    }
  })

  it("rejects an expiry that is too long to be a unix time", async () => {
    assert.equal(await verifySessionCookie(cookie(token, "9".repeat(13)), KEY, NOW), false)
  })
})

describe("parseSessionCookie", () => {
  it("splits on the last two dots", () => {
    assert.deepEqual(parseSessionCookie("a.b.c.123.deadbeef"), { token: "a.b.c", expiry: 123, mac: "deadbeef" })
  })
})
