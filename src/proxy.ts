import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"

import { routing } from "./i18n/routing"
import { SESSION_COOKIE, isPublicPath } from "./lib/session"

// Next 16 renamed Middleware → Proxy. Handles the /en · /ar prefix and keeps signed-out users on the auth pages.
const intl = createMiddleware(routing)

export default function proxy(req: NextRequest) {
  const [, maybeLocale, ...rest] = req.nextUrl.pathname.split("/")
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    const path = "/" + rest.join("/")
    if (!isPublicPath(path) && !req.cookies.has(SESSION_COOKIE)) {
      const url = req.nextUrl.clone()
      url.pathname = `/${maybeLocale}/login`
      url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`
      return NextResponse.redirect(url)
    }
  }
  return intl(req)
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
