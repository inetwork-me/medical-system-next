// Checks the server build (run `npm run build` first, then `npm run check:server`):
//  · security headers and the CSP nonce on page responses
//  · route protection in both modes (default api mode with a signed cookie, HIS_AUTH_MODE=mock)
//  · the /api proxy: tenant header from the host (a client-sent one is removed), Origin and cookie forwarded
// It starts a fake API on a free port and `next start` on others; nothing outside this machine is called and no .env file is read.
import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import http from "node:http"
import { createServer } from "node:net"

const KEY = "check-server-key-not-a-real-secret"
const failures = []
let checks = 0

function check(name, ok, detail = "") {
  checks++
  if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ""}`)
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` -> ${detail}` : ""}`)
}

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

function get(port, path, { host, headers = {}, method = "GET" } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method, headers: { host: host ?? `localhost:${port}`, ...headers } }, (res) => {
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (c) => (body += c))
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on("error", reject)
    req.end()
  })
}

async function waitFor(port) {
  for (let i = 0; i < 120; i++) {
    try {
      await get(port, "/en/login")
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`next start did not come up on ${port}`)
}

const cookieFor = (expiry, key = KEY) => {
  const token = "7|checkservertoken"
  return `${token}.${expiry}.${createHmac("sha256", key).update(`${token}.${expiry}`).digest("hex")}`
}

function start(env, port) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", ...env },
    stdio: ["ignore", "ignore", "inherit"],
  })
  return child
}

const seen = []
const fake = http.createServer((req, res) => {
  seen.push({ url: req.url, method: req.method, headers: req.headers })
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({ ok: true }))
})
await new Promise((r) => fake.listen(0, "127.0.0.1", r))
const fakePort = fake.address().port

const apiPort = await freePort()
const mockPort = await freePort()
const servers = [
  start({ HIS_API_URL: `http://127.0.0.1:${fakePort}`, HIS_AUTH_MODE: "", HIS_SESSION_COOKIE_KEY: KEY }, apiPort),
  start({ HIS_AUTH_MODE: "mock", HIS_API_URL: "", HIS_SESSION_COOKIE_KEY: "" }, mockPort),
]

try {
  await Promise.all([waitFor(apiPort), waitFor(mockPort)])
  const future = Math.floor(Date.now() / 1000) + 3600
  const past = Math.floor(Date.now() / 1000) - 10

  // --- headers and nonce on a page (public page, api mode)
  const page = await get(apiPort, "/en/login")
  const h = page.headers
  const csp = String(h["content-security-policy"] ?? "")
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
  check("page: status 200", page.status === 200, String(page.status))
  check("page: CSP has a nonce and strict-dynamic", !!nonce && csp.includes("'strict-dynamic'"), csp)
  check("page: CSP has no unsafe-inline or unsafe-eval for scripts", !/script-src[^;]*'unsafe-(inline|eval)'/.test(csp), csp)
  check("page: CSP frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"), csp)
  check("page: CSP object-src none and base-uri self", csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"))
  check("page: X-Frame-Options DENY", h["x-frame-options"] === "DENY", String(h["x-frame-options"]))
  check("page: X-Content-Type-Options nosniff", h["x-content-type-options"] === "nosniff")
  check("page: Referrer-Policy", h["referrer-policy"] === "strict-origin-when-cross-origin", String(h["referrer-policy"]))
  check("page: no HSTS on plain http", h["strict-transport-security"] === undefined)
  check("page: scripts carry the nonce", !!nonce && page.body.includes(`nonce="${nonce}"`))
  const other = await get(apiPort, "/en/login")
  check("page: a new nonce on every request", String(other.headers["content-security-policy"]) !== csp)
  const https = await get(apiPort, "/en/login", { headers: { "x-forwarded-proto": "https" } })
  check("page: HSTS on https", /max-age=\d+/.test(String(https.headers["strict-transport-security"] ?? "")))

  // --- route protection, api mode (the default: HIS_AUTH_MODE is not set for this server)
  const next = "/en/login?next=%2Fdashboard"
  const anon = await get(apiPort, "/en/dashboard")
  check("api mode: no cookie -> sign-in", anon.status === 307 && anon.headers.location?.endsWith(next), `${anon.status} ${anon.headers.location}`)
  check("api mode: redirect also carries the security headers", !!anon.headers["content-security-policy"] && anon.headers["x-frame-options"] === "DENY")
  const old = await get(apiPort, "/en/dashboard", { headers: { cookie: "ms_session=1" } })
  check("api mode: old ms_session=1 -> sign-in", old.status === 307, String(old.status))
  const forged = await get(apiPort, "/en/dashboard", { headers: { cookie: `his_session=${cookieFor(future, "wrong-key")}` } })
  check("api mode: forged his_session -> sign-in", forged.status === 307, String(forged.status))
  const expired = await get(apiPort, "/en/dashboard", { headers: { cookie: `his_session=${cookieFor(past)}` } })
  check("api mode: expired his_session -> sign-in", expired.status === 307, String(expired.status))
  const good = await get(apiPort, "/en/dashboard", { headers: { cookie: `his_session=${cookieFor(future)}` } })
  check("api mode: valid his_session -> page", good.status === 200, String(good.status))
  const signedInLogin = await get(apiPort, "/en/login", { headers: { cookie: `his_session=${cookieFor(future)}` } })
  check("api mode: signed in on /login -> dashboard", signedInLogin.status === 307 && signedInLogin.headers.location?.endsWith("/en/dashboard"), `${signedInLogin.status} ${signedInLogin.headers.location}`)
  const forgedLogin = await get(apiPort, "/en/login", { headers: { cookie: `his_session=${cookieFor(future, "wrong-key")}` } })
  check("api mode: forged cookie on /login -> sign-in page", forgedLogin.status === 200, String(forgedLogin.status))
  const staleMockLogin = await get(apiPort, "/en/login", { headers: { cookie: "ms_session=1" } })
  check("api mode: ms_session=1 on /login -> sign-in page", staleMockLogin.status === 200, String(staleMockLogin.status))
  const pub = await get(apiPort, "/en/forgot-password")
  check("api mode: public page stays public", pub.status === 200, String(pub.status))

  // --- route protection, mock mode (default)
  const mockAnon = await get(mockPort, "/en/dashboard")
  check("mock mode: no cookie -> sign-in", mockAnon.status === 307, String(mockAnon.status))
  const mockIn = await get(mockPort, "/en/dashboard", { headers: { cookie: "ms_session=1" } })
  const mockLogin = await get(mockPort, "/en/login", { headers: { cookie: "ms_session=1" } })
  check("mock mode: /login stays reachable", mockLogin.status === 200, String(mockLogin.status))
  check("mock mode: ms_session=1 -> page (today's behaviour)", mockIn.status === 200, String(mockIn.status))
  const mockApi = await get(mockPort, "/api/user")
  check("api address not set: /api answers 503 JSON", mockApi.status === 503, String(mockApi.status))

  // --- the /api proxy
  seen.length = 0
  const proxied = await get(apiPort, "/api/user?x=1", {
    host: "demo.localhost:3010",
    headers: { "x-tenant-subdomain": "evil", origin: "http://demo.localhost:3010", cookie: `his_session=${cookieFor(future)}`, "x-auth-mode": "cookie" },
  })
  const s1 = seen[0]
  check("proxy: reaches the API with path and query", proxied.status === 200 && s1?.url === "/api/user?x=1", `${proxied.status} ${s1?.url}`)
  check("proxy: tenant from the host, client value removed", s1?.headers["x-tenant-subdomain"] === "demo", String(s1?.headers["x-tenant-subdomain"]))
  check("proxy: Origin forwarded", s1?.headers.origin === "http://demo.localhost:3010", String(s1?.headers.origin))
  check("proxy: cookie forwarded", String(s1?.headers.cookie ?? "").includes("his_session="))
  check("proxy: X-Auth-Mode forwarded", s1?.headers["x-auth-mode"] === "cookie")

  seen.length = 0
  await get(apiPort, "/api/login", { method: "POST", host: `localhost:${apiPort}`, headers: { "x-tenant-subdomain": "evil", "content-length": "0" } })
  const s2 = seen[0]
  check("proxy: bare localhost sends no tenant, spoofed one removed", s2 && s2.headers["x-tenant-subdomain"] === undefined, String(s2?.headers["x-tenant-subdomain"]))
  check("proxy: method kept", s2?.method === "POST")
} finally {
  for (const s of servers) s.kill()
  fake.close()
}

console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (failures.length) {
  console.error(`\nFailed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
