import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/session"

/** Log out: clear the mock session and go back to sign in (same language). */
export async function GET(req: NextRequest, { params }: RouteContext<"/[locale]/logout">) {
  const { locale } = await params
  const res = NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  res.cookies.delete(SESSION_COOKIE)
  return res
}
