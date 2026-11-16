import { cookies } from "next/headers"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { AppShell } from "@/components/shell/app-shell"
import { SIDEBAR_COOKIE } from "@/components/shell/constants"

/** Signed-in area: every module page renders inside the responsive app shell. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1"

  return <AppShell defaultCollapsed={collapsed}>{children}</AppShell>
}
