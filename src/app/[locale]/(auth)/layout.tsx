import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { AuthFrame } from "@/components/auth/auth-frame"
import { AuthFlowProvider } from "@/components/auth/flow"

/** Signed-out area: sign in, 2-step code, sign up, password reset. The flow state persists across these pages. */
export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <AuthFlowProvider>
      <AuthFrame>{children}</AuthFrame>
    </AuthFlowProvider>
  )
}
