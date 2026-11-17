import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { AuthGate } from "@/components/auth/client-guards"
import { STATIC_EXPORT } from "@/lib/static"

/** Full-screen workspaces (Eyes & Dental exam screens): signed-in like the app, but without the sidebar and app header. */
export default async function WorkspaceLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <>
      {STATIC_EXPORT && <AuthGate />}
      {children}
    </>
  )
}
