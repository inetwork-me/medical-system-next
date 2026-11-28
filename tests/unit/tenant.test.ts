import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { tenantFromHost } from "../../src/lib/api/tenant.ts"

describe("tenantFromHost", () => {
  it("takes the first label", () => {
    assert.equal(tenantFromHost("demo.localhost:3010"), "demo")
    assert.equal(tenantFromHost("demo.localhost"), "demo")
    assert.equal(tenantFromHost("alnoor.his.example.sa"), "alnoor")
    assert.equal(tenantFromHost("Demo.Localhost:3010"), "demo")
  })

  it("gives none for a bare host", () => {
    assert.equal(tenantFromHost("localhost"), null)
    assert.equal(tenantFromHost("localhost:3010"), null)
  })

  it("gives none for an IP address, an empty or a missing host", () => {
    assert.equal(tenantFromHost("127.0.0.1:3010"), null)
    assert.equal(tenantFromHost("[::1]:3010"), null)
    assert.equal(tenantFromHost(""), null)
    assert.equal(tenantFromHost(null), null)
    assert.equal(tenantFromHost(undefined), null)
  })

  it("gives none for a label that is not a valid subdomain", () => {
    assert.equal(tenantFromHost("de mo.localhost"), null)
    assert.equal(tenantFromHost("-demo.localhost"), null)
    assert.equal(tenantFromHost("a_b.localhost"), null)
  })
})
