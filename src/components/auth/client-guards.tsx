"use client"

import * as React from "react"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"

import { useRouter, usePathname } from "@/i18n/navigation"
import { signOut } from "@/lib/api"
import type { AuthMode } from "@/lib/auth-mode"
import { clearSignedIn } from "@/lib/permissions"
import { SESSION_COOKIE } from "@/lib/session"
import { hasSessionCookie } from "@/lib/static"
import { BranchForm } from "./branch-form"
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

/**
 * Entry route. mode "api": go to the dashboard; the proxy sends a signed-out visitor to sign in (the real cookie is httpOnly,
 * the browser cannot read it). mode "mock": signed in (mock cookie) → dashboard, otherwise sign in; decided in the browser so it
 * also works as a static page.
 */
export function HomeRedirect({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  React.useEffect(() => {
    router.replace(mode === "api" || hasSessionCookie(SESSION_COOKIE) ? "/dashboard" : "/login")
  }, [router, mode])
  return null
}

/**
 * Log out. mode "api": POST /api/logout (the API deletes the token and clears the cookie), forget the cached copies of who the
 * user was, then a full load of sign-in. mode "mock": clear the mock cookie. A page, so it works on static hosting too.
 */
export function Logout({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const locale = useLocale()
  React.useEffect(() => {
    if (mode === "api") {
      signOut()
        .catch(() => undefined)
        .finally(() => {
          clearSignedIn()
          window.location.replace(`/${locale}/login`)
        })
      return
    }
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
    router.replace("/login")
  }, [router, mode, locale])
  return null
}

/** Sign-in pages read ?next= in the browser (static pages have no request). Render under <Suspense>. */
export function LoginWithNext({ mode }: { mode: AuthMode }) {
  return <LoginForm mode={mode} next={useSearchParams().get("next") ?? undefined} />
}
export function VerifyLoginWithNext({ mode }: { mode: AuthMode }) {
  return <VerifyForm kind="login" mode={mode} next={useSearchParams().get("next") ?? undefined} />
}
export function BranchWithNext() {
  return <BranchForm next={useSearchParams().get("next") ?? undefined} />
}
