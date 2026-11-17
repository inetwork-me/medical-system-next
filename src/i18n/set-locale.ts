import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { routing } from "./routing"

/**
 * Static rendering: every server page, layout and generateMetadata sets the request locale from its [locale] param
 * (otherwise next-intl reads request headers, which a static export doesn't have).
 */
export async function setLocaleFrom(params: Promise<{ locale: string }>) {
  const { locale } = await params
  setRequestLocale(hasLocale(routing.locales, locale) ? locale : routing.defaultLocale)
}
