"use client"

import { useLocale } from "next-intl"

import { safeNext } from "@/lib/safe-next"

/**
 * After a real sign-in: a full page load of `next` (or the dashboard) in the current language. The cookie is already set; a
 * full load drops every in-memory sign-in step (temp tokens) and any stale client cache of a protected page.
 */
export function useFinishSignIn(next?: string) {
  const locale = useLocale()
  return () => window.location.replace(`/${locale}${safeNext(next) ?? "/dashboard"}`)
}
