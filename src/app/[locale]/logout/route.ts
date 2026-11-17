import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/session"

/** Log out: clear the mock session and go back to sign in (same language). */
export async function GET(req: NextRequest, { params }: RouteContext<"/[locale]/logout">) {
  const { locale } = await params
  // Link prefetches (production prefetches every visible link, e.g. the sidebar "Log out") must not sign the user out.
  const h = req.headers
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) {
    return new NextResponse(null, { status: 204 })
  }
  const res = NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  res.cookies.delete(SESSION_COOKIE)
  return res
}
