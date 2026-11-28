import createMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"

import { routing } from "./i18n/routing"
import { API_SESSION_COOKIE, verifySessionCookie } from "./lib/api/session-cookie"
import { tenantFromHost } from "./lib/api/tenant"
import { HSTS, buildCsp } from "./lib/csp"
import { SESSION_COOKIE, isPublicPath } from "./lib/session"

/**
 * Next 16 renamed Middleware to Proxy. Server build only (the static export has no server; scripts/build-pages.mjs sets this
 * file aside). It does four jobs:
 *  1. `/api/*` goes to the API (`HIS_API_URL`), with the tenant taken from the address the browser used.
 *  2. Pages: the /en · /ar prefix (next-intl).
 *  3. Route protection: HIS_AUTH_MODE=api checks the signed `his_session` cookie (HMAC + expiry, no network call);
 *     "mock" (default until sign-in is on the API) keeps today's `ms_session` check.
 *  4. Security headers on every page: a Content-Security-Policy with a fresh nonce, and HSTS on https.
 * Variables (server only): HIS_API_URL, HIS_SESSION_COOKIE_KEY, HIS_AUTH_MODE. See .env.example.
 */
const intl = createMiddleware(routing)

/** Forward a browser call to the API. The tenant header is ours alone: whatever the client sent is dropped. */
function forwardToApi(req: NextRequest) {
  const base = process.env.HIS_API_URL
  if (!base) return NextResponse.json({ message: "The API address is not configured.", code: "server" }, { status: 503 })

  const headers = new Headers(req.headers)
  headers.delete("x-tenant-subdomain")
  const tenant = tenantFromHost(req.headers.get("host"))
  if (tenant) headers.set("x-tenant-subdomain", tenant)
  // Origin and Cookie stay as the browser sent them: the API needs both (CSRF origin check, his_session).
  return NextResponse.rewrite(new URL(req.nextUrl.pathname + req.nextUrl.search, base), { request: { headers } })
}

async function isSignedIn(req: NextRequest) {
  if (process.env.HIS_AUTH_MODE === "api") {
    return verifySessionCookie(req.cookies.get(API_SESSION_COOKIE)?.value, process.env.HIS_SESSION_COOKIE_KEY)
  }
  return req.cookies.has(SESSION_COOKIE)
}

function withSecurityHeaders(res: NextResponse, csp: string, https: boolean) {
  res.headers.set("Content-Security-Policy", csp)
  if (https) res.headers.set("Strict-Transport-Security", HSTS)
  return res
}

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  if (pathname === "/api" || pathname.startsWith("/api/")) return forwardToApi(req)

  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development", https })

  const [, maybeLocale, ...rest] = pathname.split("/")
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    const path = "/" + rest.join("/")
    if (!isPublicPath(path) && !(await isSignedIn(req))) {
      const url = req.nextUrl.clone()
      url.pathname = `/${maybeLocale}/login`
      url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`
      return withSecurityHeaders(NextResponse.redirect(url), csp, https)
    }
  }

  // Next reads the nonce from the request's CSP header while it renders the page.
  const headers = new Headers(req.headers)
  headers.set("x-nonce", nonce)
  headers.set("Content-Security-Policy", csp)
  return withSecurityHeaders(intl(new NextRequest(req, { headers })) as NextResponse, csp, https)
}

// `/api/*` always reaches the proxy (also paths with a dot, such as file downloads). Pages: everything except the framework's own
// files and public files. Prefetches are not skipped, so a signed-out prefetch cannot read a protected page.
export const config = {
  matcher: ["/api/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
}
