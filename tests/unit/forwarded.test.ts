import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { clientAddress, setForwardedHeaders, trustedHops } from "../../src/lib/api/forwarded.ts"

const opts = { host: "demo.his.example.sa", protocol: "https:", hops: 1 }

describe("setForwardedHeaders", () => {
  it("drops a client-sent X-Forwarded-For and sets its own", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "6.6.6.6", forwarded: "for=6.6.6.6" })
    setForwardedHeaders(h, opts)
    assert.equal(h.get("x-forwarded-for"), "203.0.113.9")
    assert.equal(h.get("x-real-ip"), null)
    assert.equal(h.get("forwarded"), null)
  })

  it("sends no address when the value is not an address", () => {
    const h = new Headers({ "x-forwarded-for": "not-an-ip" })
    setForwardedHeaders(h, opts)
    assert.equal(h.get("x-forwarded-for"), null)
  })

  it("sets proto and host itself, ignoring client values", () => {
    const h = new Headers({ "x-forwarded-proto": "http", "x-forwarded-host": "evil.example", "x-forwarded-port": "1" })
    setForwardedHeaders(h, opts)
    assert.equal(h.get("x-forwarded-proto"), "https")
    assert.equal(h.get("x-forwarded-host"), "demo.his.example.sa")
    assert.equal(h.get("x-forwarded-port"), null)
  })
})

describe("clientAddress", () => {
  it("counts from the right by the number of trusted hops", () => {
    assert.equal(clientAddress("6.6.6.6, 203.0.113.9, 10.0.0.2", 2), "203.0.113.9")
    assert.equal(clientAddress("2001:db8::1", 1), "2001:db8::1")
  })
  it("gives none for zero hops or an empty chain", () => {
    assert.equal(clientAddress("203.0.113.9", 0), null)
    assert.equal(clientAddress(null, 1), null)
    assert.equal(clientAddress("203.0.113.9", 3), null)
  })
})

describe("trustedHops", () => {
  it("defaults to 1 and rejects bad values", () => {
    assert.equal(trustedHops(undefined), 1)
    assert.equal(trustedHops("2"), 2)
    assert.equal(trustedHops("0"), 0)
    assert.equal(trustedHops("-1"), 1)
    assert.equal(trustedHops("abc"), 1)
  })
})
