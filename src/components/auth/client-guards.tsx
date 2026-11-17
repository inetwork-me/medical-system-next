"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { useRouter, usePathname } from "@/i18n/navigation"
import { SESSION_COOKIE } from "@/lib/session"
import { hasSessionCookie } from "@/lib/static"
import { LoginForm } from "./login-form"
import { VerifyForm } from "./verify-form"

/**
 * Static export only (no proxy): sends signed-out visitors of app pages to sign in, keeping where they were going.
 * With the server build the proxy does this before the page renders.
 */
export function AuthGate() {
  const router = useRouter()
  const pathname = usePathname()
  React.useEffect(() => {
    if (!hasSessionCookie(SESSION_COOKIE)) router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`)
  }, [router, pathname])
  return null
}

/** Entry route: signed in → dashboard, otherwise → sign in (client-side, so it also works as a static page). */
export function HomeRedirect() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace(hasSessionCookie(SESSION_COOKIE) ? "/dashboard" : "/login")
  }, [router])
  return null
}

/** Log out: clear the mock session and go back to sign in (same language). A page, so it works on static hosting. */
export function Logout() {
  const router = useRouter()
  React.useEffect(() => {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
    router.replace("/login")
  }, [router])
  return null
}

/** Sign-in pages read ?next= in the browser (static pages have no request). Render under <Suspense>. */
export function LoginWithNext() {
  return <LoginForm next={useSearchParams().get("next") ?? undefined} />
}
export function VerifyLoginWithNext() {
  return <VerifyForm kind="login" next={useSearchParams().get("next") ?? undefined} />
}
