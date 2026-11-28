import { cookies } from "next/headers"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { AppShell } from "@/components/shell/app-shell"
import { SIDEBAR_COOKIE } from "@/components/shell/constants"
import { AuthGate } from "@/components/auth/client-guards"
import { PermissionsGate } from "@/components/shell/permissions"
import { SessionProvider } from "@/components/shell/session"
import { authMode } from "@/lib/auth-mode"
import { STATIC_EXPORT } from "@/lib/static"

/** Signed-in area: every module page renders inside the responsive app shell. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  // Static export has no request: the sidebar starts expanded and the sign-in check runs in the browser.
  const collapsed = STATIC_EXPORT ? false : (await cookies()).get(SIDEBAR_COOKIE)?.value === "1"

  return (
    <SessionProvider mode={authMode()}>
      <PermissionsGate>
        <AppShell defaultCollapsed={collapsed}>
          {STATIC_EXPORT && <AuthGate />}
          {children}
        </AppShell>
      </PermissionsGate>
    </SessionProvider>
  )
}
