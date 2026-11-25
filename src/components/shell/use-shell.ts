"use client"

import { useLocale, useTranslations } from "next-intl"

import { usePathname, useRouter } from "@/i18n/navigation"
import { activeModule } from "@/lib/modules"
import type { ModuleDef } from "@/config/modules"

/** Switches EN ↔ AR on the same page (header button, user menu, More sheet; prototype: navigate to the twin frame). */
export function useLocaleSwitch() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const other = locale === "ar" ? "en" : "ar"
  return {
    other,
    switchLocale: () => {
      const query = typeof window !== "undefined" ? window.location.search : ""
      router.replace(`${pathname}${query}`, { locale: other })
    },
  }
}

/** Current module + translated labels for nav surfaces. */
export function useNav() {
  const pathname = usePathname()
  const t = useTranslations("shell")
  const current = activeModule(pathname)
  const label = (m: ModuleDef, short = false) => t(`nav.${(short && m.shortLabelKey) || m.labelKey}` as "nav.dashboard")
  const tabLabel = (m: ModuleDef, key: string) => t(`tabs.${m.id}.${key}` as "tabs.patients.list")
  /** Settings pages (not a branch module): the sidebar / rail footer item and the mobile More slot show as active. */
  const inSettings = pathname === "/settings" || pathname.startsWith("/settings/")
  return { pathname, current, label, tabLabel, t, inSettings }
}

export const isRtl = (locale: string) => locale === "ar"
